#!/usr/bin/env node

import Debug from 'debug';
import { parseCliArgs } from './cli.js';
import { runGh } from './github/client.js';
import { META_QUERY } from './github/queries.js';
import { getStatePath, loadState, registerIds, saveState } from './state/manager.js';
import { formatOutput } from './output/formatter.js';
import { formatPlainOutput } from './output/plainFormatter.js';
import { setImageStoragePath } from './utils/images.js';
import { resolveThreadId } from './core/threadResolver.js';
import { filterThreadById } from './core/threadFilter.js';
import { fetchPRData } from './core/dataFetcher.js';
import { processThreads } from './core/threadProcessor.js';
import { processBotSummaries } from './core/botProcessor.js';
import type { PRMetaData } from './github/apiTypes.js';
import type { ProcessedThread, BotSummary } from './types.js';

const debug = Debug('gh-pr-threads');
const debugTiming = Debug('gh-pr-threads:timing');

async function main() {
  const startTime = Date.now();
  const { owner, repo, number, showAll, only, includeDone, withResolved, format, ignoreBots, threadId } = parseCliArgs();
  
  debug(`Fetching PR ${owner}/${repo}#${number}`);
  debug(`Options: showAll=${showAll}, includeDone=${includeDone}, withResolved=${withResolved}, ignoreBots=${ignoreBots}, only=${only.join(',') || 'all'}, format=${format}, threadId=${threadId || 'none'}`);

  // Create filter function
  const filter = createFilterFunction(only);

  // Initialize state
  const statePath = getStatePath(owner, repo, number);
  const state = loadState(statePath);
  setImageStoragePath(statePath);
  debug(`State loaded from ${statePath}`);

  // Resolve target thread ID if specified
  const targetThreadId = resolveThreadId(threadId, state);

  // Fetch all PR data in parallel
  debug('Fetching PR data in parallel: threads, files, reviews, comments...');
  const prData = await fetchPRData({
    owner,
    repo,
    number,
    targetThreadId,
    shouldFetchFiles: filter('files')
  });

  // Filter threads if targeting specific thread
  const threadsToProcess = targetThreadId 
    ? filterThreadById(prData.threads, targetThreadId)
    : prData.threads;

  debug(`Filtered to ${threadsToProcess.length} threads from ${prData.threads.length} total`);

  // Fetch PR metadata
  debug('Fetching PR metadata...');
  const metaFetchStartTime = Date.now();
  const metaResult = runGh<PRMetaData>([
    'api',
    'graphql',
    `-F owner="${owner}"`,
    `-F repo="${repo}"`,
    `-F number=${number}`,
    `-f query='${META_QUERY}'`
  ]);
  debugTiming(`PR metadata fetched in ${Date.now() - metaFetchStartTime}ms`);

  const pr = metaResult.data.repository.pullRequest;
  const prMeta = { ...pr, author: pr.author.login, files: prData.files };

  // Process threads
  debug('Processing review threads...');
  const { processedThreads } = await processThreads({
    threads: threadsToProcess,
    owner,
    repo,
    number,
    state,
    targetThreadId,
    showAll,
    withResolved,
    includeDone
  });

  // Process bot summaries
  debug('Processing bot summaries...');
  const { botSummaries, allNitpicks } = !targetThreadId && !ignoreBots && (filter('summaries') || filter('nitpicks'))
    ? processBotSummaries({
        comments: prData.comments,
        reviews: prData.reviews,
        state,
        shouldIncludeSummaries: filter('summaries'),
        shouldIncludeNitpicks: filter('nitpicks'),
        includeDone
      })
    : { botSummaries: [], allNitpicks: [] };

  // Register IDs and save state
  registerIds(state, processedThreads, allNitpicks);
  saveState(statePath, state);

  const totalTime = Date.now() - startTime;
  debugTiming(`Total execution time: ${totalTime}ms`);
  debug('Output ready');

  // Output results in selected format
  outputResults({
    format,
    prMeta,
    statePath,
    processedThreads,
    botSummaries,
    allThreads: prData.threads as Array<{ isResolved: boolean }>,
    filter
  });
}

/**
 * Creates a filter function based on the 'only' option
 */
function createFilterFunction(only: string[]): (key: string) => boolean {
  return (key: string) => {
    // Ignore userComments option (removed in v0.3.0)
    if (key === 'userComments') return false;
    return only.length === 0 || only.includes(key);
  };
}

interface OutputOptions {
  format: string;
  prMeta: {
    number: number;
    title: string;
    state: string;
    author: string;
    files: unknown[];
    isDraft: boolean;
    mergeable: string;
  };
  statePath: string;
  processedThreads: ProcessedThread[];
  botSummaries: BotSummary[];
  allThreads: Array<{ isResolved: boolean }>;
  filter: (key: string) => boolean;
}

/**
 * Outputs results in the specified format (JSON or plain text)
 */
function outputResults(options: OutputOptions): void {
  const { format, prMeta, statePath, processedThreads, botSummaries, allThreads, filter } = options;

  if (format === 'json') {
    const output = formatOutput({
      prMeta,
      statePath,
      processedThreads,
      botSummaries,
      allThreads,
      filter
    });
    console.log(JSON.stringify(output, null, 2));
  } else {
    const output = formatPlainOutput({
      prMeta,
      statePath,
      processedThreads,
      botSummaries,
      allThreads,
      filter
    });
    console.log(output);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
