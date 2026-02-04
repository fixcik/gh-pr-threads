#!/usr/bin/env node

import Debug from 'debug';
import { parseCliArgs } from './cli.js';
import { runGh } from './github/client.js';
import { fetchAllPages, fetchAllThreadComments } from './github/fetcher.js';
import { THREADS_QUERY, FILES_QUERY, REVIEWS_QUERY, COMMENTS_QUERY, META_QUERY } from './github/queries.js';
import { parseNitpicks } from './parsers/nitpicks.js';
import { cleanCommentBody } from './parsers/comments.js';
import { getStatePath, loadState, registerIds, saveState } from './state/manager.js';
import { formatOutput } from './output/formatter.js';
import { formatPlainOutput } from './output/plainFormatter.js';
import { setImageStoragePath } from './utils/images.js';
import type { ProcessedThread, BotSummary, Nitpick, Thread } from './types.js';
import type { PRMetaData, Author } from './github/apiTypes.js';

const debug = Debug('gh-pr-threads');
const debugTiming = Debug('gh-pr-threads:timing');

const DEFAULT_BOT_USERNAMES = [
  'coderabbitai',
  'github-actions',
  'sonarqubecloud',
  'dependabot',
  'renovate',
  'greenkeeper'
];

function isBot(author: { login: string; __typename?: string }): boolean {
  // 1. Check by GraphQL __typename field (most reliable)
  if (author.__typename === 'Bot') {
    return true;
  }

  // 2. Check against known bot usernames
  return DEFAULT_BOT_USERNAMES.includes(author.login.toLowerCase());
}

async function main() {
  const startTime = Date.now();
  const { owner, repo, number, showAll, only, includeDone, withResolved, format, ignoreBots, threadId } = parseCliArgs();
  debug(`Fetching PR ${owner}/${repo}#${number}`);
  debug(`Options: showAll=${showAll}, includeDone=${includeDone}, withResolved=${withResolved}, ignoreBots=${ignoreBots}, only=${only.join(',') || 'all'}, format=${format}, threadId=${threadId || 'none'}`);

  const filter = (key: string) => {
    // Ignore userComments option (removed in v0.3.0)
    if (key === 'userComments') return false;
    return only.length === 0 || only.includes(key);
  };
  const statePath = getStatePath(owner, repo, number);
  const state = loadState(statePath);
  setImageStoragePath(statePath);
  debug(`State loaded from ${statePath}`);

  // Resolve thread ID if specified
  let targetThreadId: string | null = null;
  if (threadId) {
    const resolved = state.idMap[threadId];
    if (!resolved) {
      console.error(`Error: Thread '${threadId}' not found in PR ${owner}/${repo}#${number}`);
      console.error(`State file: ${statePath}`);
      process.exit(1);
    }
    targetThreadId = resolved;
    debug(`Resolved thread ID '${threadId}' to full ID '${targetThreadId}'`);
  }

  // Parallel fetch of initial data (1-4)
  debug('Fetching PR data in parallel: threads, files, reviews, comments...');
  const parallelStartTime = Date.now();

  const [allThreads, allFiles, allReviews, allComments] = await Promise.all([
    // 1. Fetch review threads
    (async () => {
      const t1 = Date.now();
      const threads = await fetchAllPages(
        owner,
        repo,
        number,
        THREADS_QUERY,
        pr => pr.reviewThreads?.nodes || [],
        pr => pr.reviewThreads?.pageInfo || { hasNextPage: false, endCursor: null }
      );
      debugTiming(`Threads fetched: ${threads.length} threads in ${Date.now() - t1}ms`);
      return threads;
    })(),

    // 2. Fetch files
    (async () => {
      // Skip files when targeting specific thread
      if (targetThreadId || !filter('files')) return [];
      const t1 = Date.now();
      const files = await fetchAllPages(owner, repo, number, FILES_QUERY, pr => pr.files?.nodes || [], pr => pr.files?.pageInfo || { hasNextPage: false, endCursor: null });
      debugTiming(`Files fetched: ${files.length} files in ${Date.now() - t1}ms`);
      return files;
    })(),

    // 3. Fetch reviews
    (async () => {
      // Skip reviews when targeting specific thread (only needed for bot summaries)
      if (targetThreadId) return [];
      const t1 = Date.now();
      const reviews = await fetchAllPages(
        owner,
        repo,
        number,
        REVIEWS_QUERY,
        pr => pr.reviews?.nodes || [],
        pr => pr.reviews?.pageInfo || { hasNextPage: false, endCursor: null }
      );
      debugTiming(`Reviews fetched: ${reviews.length} reviews in ${Date.now() - t1}ms`);
      return reviews;
    })(),

    // 4. Fetch general comments
    (async () => {
      // Skip comments when targeting specific thread (only needed for bot summaries)
      if (targetThreadId) return [];
      const t1 = Date.now();
      const comments = await fetchAllPages(
        owner,
        repo,
        number,
        COMMENTS_QUERY,
        pr => pr.comments?.nodes || [],
        pr => pr.comments?.pageInfo || { hasNextPage: false, endCursor: null }
      );
      debugTiming(`Comments fetched: ${comments.length} comments in ${Date.now() - t1}ms`);
      return comments;
    })()
  ]);

  debugTiming(`All parallel fetches completed in ${Date.now() - parallelStartTime}ms`);

  // 5. Get PR Meta
  debug('Fetching PR metadata...');
  let t1 = Date.now();
  const metaResult = runGh<PRMetaData>([
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
  // Cache to avoid fetching same thread comments twice
  const threadCommentsCache = new Map<string, unknown>();

  if (filter('threads') || targetThreadId) {
    // If targetThreadId is set, filter to only that thread
    let threadsToProcess: Thread[];
    if (targetThreadId) {
      const target = targetThreadId;
      threadsToProcess = (allThreads as Thread[]).filter(t => {
        // Support both GraphQL ID format (PRRT_xxx) and old path:line format
        if (t.id === target) {
          debug(`Thread matched by GraphQL ID: ${t.id}`);
          return true;
        }
        // Check if targetThreadId is in path:line format
        if (target.includes(':') && target.includes('/')) {
          const lastColonIdx = target.lastIndexOf(':');
          const path = target.slice(0, lastColonIdx);
          const lineRange = target.slice(lastColonIdx + 1);
          const [startLine] = lineRange.split('-').map(Number);
          debug(`Checking thread: path=${t.path}, line=${t.line} against path=${path}, startLine=${startLine}`);
          if (t.path === path && t.line === startLine) {
            debug(`Thread matched by path:line`);
            return true;
          }
        }
        return false;
      });
    } else {
      threadsToProcess = allThreads as Thread[];
    }

    debug(`Filtered to ${threadsToProcess.length} threads from ${allThreads.length} total`);

    let skipped = 0;
    for (const t of threadsToProcess as Thread[]) {
      // Skip filters if targeting specific thread
      if (!targetThreadId) {
        if (!showAll && t.isResolved) {
          skipped++;
          continue;
        }
        const threadStatus = state.threads[t.id]?.status;
        if (!includeDone && (threadStatus === 'done' || threadStatus === 'skip')) {
          skipped++;
          continue;
        }
      }

      const comments = await fetchAllThreadComments(owner, repo, number, t);
      threadCommentsCache.set(t.id, comments);
      const threadStatus = state.threads[t.id]?.status;
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
  // Skip bot summaries when targeting specific thread
  if (!targetThreadId && !ignoreBots && (filter('summaries') || filter('nitpicks'))) {
    const candidates = [...allComments, ...allReviews].filter((c): c is { author: Author; body: string; url: string } => {
      const comment = c as { author?: Author; body?: string; url?: string };
      return !!comment.author && isBot(comment.author);
    });
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

  // Collect all nitpicks for ID registration
  const allNitpicks: Nitpick[] = [];
  botSummaries.forEach((summary) => {
    if (summary.nitpicks) {
      allNitpicks.push(...summary.nitpicks);
    }
  });

  // Register IDs for short hash lookup
  registerIds(state, processedThreads, allNitpicks);
  saveState(statePath, state);

  const totalTime = Date.now() - startTime;
  debugTiming(`Total execution time: ${totalTime}ms`);
  debug('Output ready');

  // Output in selected format
  if (format === 'json') {
    const output = formatOutput(prMeta, statePath, processedThreads, botSummaries, allThreads as Array<{ isResolved: boolean }>, filter);
    console.log(JSON.stringify(output, null, 2));
  } else {
    const output = formatPlainOutput(prMeta, statePath, processedThreads, botSummaries, allThreads as Array<{ isResolved: boolean }>, filter);
    console.log(output);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
