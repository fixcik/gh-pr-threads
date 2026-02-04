#!/usr/bin/env node

import { parseCliArgs } from './cli.js';
import { runGh } from './github/client.js';
import { fetchAllPages, fetchAllThreadComments } from './github/fetcher.js';
import { THREADS_QUERY, FILES_QUERY, REVIEWS_QUERY, COMMENTS_QUERY, META_QUERY } from './github/queries.js';
import { parseNitpicks } from './parsers/nitpicks.js';
import { cleanCommentBody } from './parsers/comments.js';
import { getStatePath, loadState } from './state/manager.js';
import { formatOutput } from './output/formatter.js';
import type { Thread, ProcessedThread, BotSummary, UserComment } from './types.js';

async function main() {
  const { owner, repo, number, showAll, only, includeDone } = parseCliArgs();
  const filter = (key: string) => only.length === 0 || only.includes(key);
  const statePath = getStatePath(owner, repo, number);
  const state = loadState(statePath);

  // 1. Fetch review threads
  const allThreads: Thread[] = await fetchAllPages(
    owner,
    repo,
    number,
    THREADS_QUERY,
    pr => pr.reviewThreads.nodes,
    pr => pr.reviewThreads.pageInfo
  );

  // 2. Fetch files
  const allFiles = filter('files')
    ? await fetchAllPages(owner, repo, number, FILES_QUERY, pr => pr.files.nodes, pr => pr.files.pageInfo)
    : [];

  // 3. Fetch reviews
  const allReviews = await fetchAllPages(
    owner,
    repo,
    number,
    REVIEWS_QUERY,
    pr => pr.reviews.nodes,
    pr => pr.reviews.pageInfo
  );

  // 4. Fetch general comments
  const allComments = await fetchAllPages(
    owner,
    repo,
    number,
    COMMENTS_QUERY,
    pr => pr.comments.nodes,
    pr => pr.comments.pageInfo
  );

  // 5. Get PR Meta
  const metaResult = runGh([
    'api',
    'graphql',
    `-F owner="${owner}"`,
    `-F repo="${repo}"`,
    `-F number=${number}`,
    `-f query='${META_QUERY}'`
  ]);
  const pr = metaResult.data.repository.pullRequest;
  const prMeta = { ...pr, author: pr.author.login, files: allFiles };

  // 6. Process Threads
  const processedThreads: ProcessedThread[] = [];
  if (filter('threads')) {
    for (const t of allThreads) {
      if (!showAll && t.isResolved) continue;
      const threadStatus = state.threads[t.id]?.status;
      if (!includeDone && (threadStatus === 'done' || threadStatus === 'skip')) continue;

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
  }

  // 7. Process Bot Summaries
  const botSummaries: BotSummary[] = [];
  if (filter('summaries') || filter('nitpicks')) {
    const bots = ['coderabbitai', 'github-actions', 'sonarqubecloud'];
    const candidates = [...allComments, ...allReviews].filter(c => bots.includes(c.author?.login));
    for (const c of candidates) {
      let nitpicks = parseNitpicks(c.body);
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
  }

  // 8. Process User Comments
  const userComments: UserComment[] = [];
  if (filter('userComments')) {
    const bots = ['coderabbitai', 'github-actions', 'sonarqubecloud', 'dependabot'];
    for (const t of allThreads) {
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
  }

  const output = formatOutput(prMeta, statePath, processedThreads, botSummaries, userComments, allThreads, filter);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
