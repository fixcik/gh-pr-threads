#!/usr/bin/env node

import Debug from 'debug';
import { parseCliArgs } from './cli.js';
import { runGh } from './github/client.js';
import { fetchAllPages, fetchAllThreadComments } from './github/fetcher.js';
import { THREADS_QUERY, FILES_QUERY, REVIEWS_QUERY, COMMENTS_QUERY, META_QUERY } from './github/queries.js';
import { parseNitpicks } from './parsers/nitpicks.js';
import { cleanCommentBody } from './parsers/comments.js';
import { getStatePath, loadState } from './state/manager.js';
import { formatOutput } from './output/formatter.js';
import type { Thread, ProcessedThread, BotSummary, UserComment } from './types.js';

const debug = Debug('gh-pr-threads');
const debugTiming = Debug('gh-pr-threads:timing');

async function main() {
  const startTime = Date.now();
  const { owner, repo, number, showAll, only, includeDone, withResolved } = parseCliArgs();
  debug(`Fetching PR ${owner}/${repo}#${number}`);
  debug(`Options: showAll=${showAll}, includeDone=${includeDone}, withResolved=${withResolved}, only=${only.join(',') || 'all'}`);

  const filter = (key: string) => only.length === 0 || only.includes(key);
  const statePath = getStatePath(owner, repo, number);
  const state = loadState(statePath);
  debug(`State loaded from ${statePath}`);

  // Parallel fetch of initial data (1-4)
  debug('Fetching PR data in parallel: threads, files, reviews, comments...');
  const parallelStartTime = Date.now();

  const [allThreads, allFiles, allReviews, allComments] = await Promise.all([
    // 1. Fetch review threads
    (async () => {
      let t1 = Date.now();
      const threads = await fetchAllPages(
        owner,
        repo,
        number,
        THREADS_QUERY,
        pr => pr.reviewThreads.nodes,
        pr => pr.reviewThreads.pageInfo
      );
      debugTiming(`Threads fetched: ${threads.length} threads in ${Date.now() - t1}ms`);
      return threads;
    })(),

    // 2. Fetch files
    (async () => {
      if (!filter('files')) return [];
      let t1 = Date.now();
      const files = await fetchAllPages(owner, repo, number, FILES_QUERY, pr => pr.files.nodes, pr => pr.files.pageInfo);
      debugTiming(`Files fetched: ${files.length} files in ${Date.now() - t1}ms`);
      return files;
    })(),

    // 3. Fetch reviews
    (async () => {
      let t1 = Date.now();
      const reviews = await fetchAllPages(
        owner,
        repo,
        number,
        REVIEWS_QUERY,
        pr => pr.reviews.nodes,
        pr => pr.reviews.pageInfo
      );
      debugTiming(`Reviews fetched: ${reviews.length} reviews in ${Date.now() - t1}ms`);
      return reviews;
    })(),

    // 4. Fetch general comments
    (async () => {
      let t1 = Date.now();
      const comments = await fetchAllPages(
        owner,
        repo,
        number,
        COMMENTS_QUERY,
        pr => pr.comments.nodes,
        pr => pr.comments.pageInfo
      );
      debugTiming(`Comments fetched: ${comments.length} comments in ${Date.now() - t1}ms`);
      return comments;
    })()
  ]);

  debugTiming(`All parallel fetches completed in ${Date.now() - parallelStartTime}ms`);

  // 5. Get PR Meta
  debug('Fetching PR metadata...');
  let t1 = Date.now();
  const metaResult = runGh([
    'api',
    'graphql',
    `-F owner="${owner}"`,
    `-F repo="${repo}"`,
    `-F number=${number}`,
    `-f query='${META_QUERY}'`
  ]);
  debugTiming(`PR metadata fetched in ${Date.now() - t1}ms`);

  const pr = metaResult.data.repository.pullRequest;
  const prMeta = { ...pr, author: pr.author.login, files: allFiles };

  // 6. Process Threads
  debug('Processing review threads...');
  t1 = Date.now();
  const processedThreads: ProcessedThread[] = [];
  if (filter('threads')) {
    let skipped = 0;
    for (const t of allThreads) {
      if (!showAll && t.isResolved) {
        skipped++;
        continue;
      }
      const threadStatus = state.threads[t.id]?.status;
      if (!includeDone && (threadStatus === 'done' || threadStatus === 'skip')) {
        skipped++;
        continue;
      }

      const comments = await fetchAllThreadComments(owner, repo, number, t);
      processedThreads.push({
        thread_id: t.id,
        isResolved: t.isResolved,
        isOutdated: t.isOutdated,
        path: t.path,
        line: t.line,
        status: threadStatus,
        comments: comments.map(c => ({
          id: c.id,
          author: c.author.login,
          body: cleanCommentBody(c.body),
          url: c.url,
          createdAt: c.createdAt
        }))
      });
    }
    debugTiming(`Threads processed: ${processedThreads.length} / ${allThreads.length} (${skipped} skipped) in ${Date.now() - t1}ms`);
  }

  // 7. Process Bot Summaries
  debug('Processing bot summaries...');
  t1 = Date.now();
  const botSummaries: BotSummary[] = [];
  if (filter('summaries') || filter('nitpicks')) {
    const bots = ['coderabbitai', 'github-actions', 'sonarqubecloud'];
    const candidates = [...allComments, ...allReviews].filter(c => bots.includes(c.author?.login));
    debug(`Found ${candidates.length} bot comments`);

    let totalNitpicks = 0;
    for (const c of candidates) {
      let nitpicks = parseNitpicks(c.body);
      totalNitpicks += nitpicks.length;
      if (filter('nitpicks')) {
        nitpicks = nitpicks
          .map(n => ({ ...n, status: state.nitpicks[n.id]?.status }))
          .filter(n => includeDone || (n.status !== 'done' && n.status !== 'skip'));
      }
      const result: BotSummary = { author: c.author.login, url: c.url };
      if (filter('summaries')) result.body = cleanCommentBody(c.body);
      if (filter('nitpicks')) result.nitpicks = nitpicks;
      if (result.body || (result.nitpicks && result.nitpicks.length > 0)) botSummaries.push(result);
    }
    debugTiming(`Bot summaries processed: ${botSummaries.length} summaries, ${totalNitpicks} total nitpicks in ${Date.now() - t1}ms`);
  }

  // 8. Process User Comments
  debug('Processing user comments...');
  t1 = Date.now();
  const userComments: UserComment[] = [];
  if (filter('userComments')) {
    const bots = ['coderabbitai', 'github-actions', 'sonarqubecloud', 'dependabot'];
    let resolvedSkipped = 0;
    for (const t of allThreads) {
      // Filter resolved threads unless --with-resolved is set
      if (!withResolved && t.isResolved) {
        resolvedSkipped++;
        continue;
      }

      const comments = await fetchAllThreadComments(owner, repo, number, t);
      for (const c of comments) {
        if (!bots.includes(c.author?.login)) {
          userComments.push({
            id: c.id,
            author: c.author?.login,
            body: c.body,
            url: c.url,
            createdAt: c.createdAt,
            thread_id: t.id,
            file: t.path,
            line: t.line,
            isResolved: t.isResolved,
            isOutdated: t.isOutdated
          });
        }
      }
    }
    userComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    debugTiming(`User comments processed: ${userComments.length} comments (${resolvedSkipped} threads skipped) in ${Date.now() - t1}ms`);
  }

  const output = formatOutput(prMeta, statePath, processedThreads, botSummaries, userComments, allThreads, filter);

  const totalTime = Date.now() - startTime;
  debugTiming(`Total execution time: ${totalTime}ms`);
  debug('Output ready');

  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
