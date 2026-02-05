#!/usr/bin/env node

import Debug from 'debug';
import { parseCliArgs } from './cli.js';
import { getStatePath, loadState, registerIds, saveState } from './state/manager.js';
import { formatOutput } from './output/formatter.js';
import { formatPlainOutput } from './output/plainFormatter.js';
import { setImageStoragePath } from './utils/images.js';
import { resolveThreadId } from './core/threadResolver.js';
import { filterThreadById } from './core/threadFilter.js';
import { filterNitpicksById } from './core/nitpickFilter.js';
import { fetchPRData } from './core/dataFetcher.js';
import { processThreads } from './core/threadProcessor.js';
import { processBotSummaries } from './core/botProcessor.js';
import type { ProcessedThread, BotSummary, Thread } from './types.js';
import type { PRMetadata } from './core/dataFetcher.js';

const debug = Debug('gh-pr-threads');
const debugTiming = Debug('gh-pr-threads:timing');

interface OutputOptions {
  format: string;
  prMeta: PRMetadata;
  statePath: string;
  processedThreads: ProcessedThread[];
  botSummaries: BotSummary[];
  allThreads: Thread[];
  filter: (key: string) => boolean;
}

async function main() {
  const startTime = Date.now();
  const args = parseCliArgs();

  // parseCliArgs() calls program.parse() which handles subcommands.
  // Subcommands call process.exit(), so if we reach here, it's the default fetch command.
  // However, if parseCliArgs returns an empty object (for subcommands), we should not continue.
  if (!args.owner || !args.repo || !args.number) {
    // Subcommand was executed, nothing more to do
    return;
  }

  const { owner, repo, number, showAll, only, includeDone, withResolved, format, ignoreBots, threadId, noCache, cacheTtl } = args;

  debug(`Fetching PR ${owner}/${repo}#${number}`);
  debug(`Options: showAll=${showAll}, includeDone=${includeDone}, withResolved=${withResolved}, ignoreBots=${ignoreBots}, only=${only ? only.join(',') : 'all'}, format=${format}, threadId=${threadId || 'none'}`);

  // Create filter function
  const filter = createFilterFunction(only || []);

  // Initialize state
  const statePath = getStatePath(owner, repo, number);
  const state = loadState(statePath);
  setImageStoragePath(statePath);
  debug(`State loaded from ${statePath}`);

  // Resolve target thread ID if specified
  const targetThreadId = resolveThreadId(threadId, state);

  // Validate unknown short IDs to avoid silent "zero threads" output
  if (threadId && targetThreadId === threadId) {
    const looksLikePath = threadId.includes(':') && threadId.includes('/');
    const looksLikeGraphql = /^PRR[CT]_/.test(threadId);
    if (!looksLikePath && !looksLikeGraphql) {
      console.error(`Error: Thread '${threadId}' not found in PR ${owner}/${repo}#${number}`);
      console.error(`State file: ${statePath}`);
      console.error(`Hint: Run without --thread first to populate thread IDs.`);
      process.exit(1);
    }
  }

  // Fetch all PR data in parallel
  debug('Fetching PR data in parallel: threads, files, reviews, comments...');
  const prData = await fetchPRData({
    owner,
    repo,
    number,
    targetThreadId,
    shouldFetchFiles: filter('files'),
    cursorCache: noCache ? undefined : state.cursorCache,
    cacheTtl
  });

  // Filter threads if targeting specific thread
  const threadsToProcess = targetThreadId 
    ? filterThreadById(prData.threads, targetThreadId)
    : prData.threads;

  debug(`Filtered to ${threadsToProcess.length} threads from ${prData.threads.length} total`);

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
  const { botSummaries, allNitpicks } = !ignoreBots && (filter('summaries') || filter('nitpicks'))
    ? processBotSummaries({
        comments: prData.comments,
        reviews: prData.reviews,
        state,
        shouldIncludeSummaries: filter('summaries'),
        shouldIncludeNitpicks: filter('nitpicks'),
        includeDone
      })
    : { botSummaries: [], allNitpicks: [] };

  // Filter nitpicks if targeting specific thread/nitpick
  const nitpicksToDisplay = targetThreadId
    ? filterNitpicksById(allNitpicks, targetThreadId)
    : allNitpicks;

  // Register IDs and save state with updated cursor cache
  registerIds(state, processedThreads, allNitpicks);
  state.cursorCache = prData.updatedCursorCache;
  state.updatedAt = new Date().toISOString();
  saveState(statePath, state);

  const totalTime = Date.now() - startTime;
  debugTiming(`Total execution time: ${totalTime}ms`);
  debug('Output ready');

  // Output results in selected format (use filtered nitpicks in bot summaries)
  const botSummariesToDisplay = targetThreadId && nitpicksToDisplay.length > 0 && botSummaries.length > 0
    ? botSummaries.map(summary => ({
        ...summary,
        nitpicks: summary.nitpicks?.filter(n => nitpicksToDisplay.some(fn => fn.id === n.id))
      })).filter(summary => summary.nitpicks && summary.nitpicks.length > 0)
    : botSummaries;

  outputResults({
    format,
    prMeta: prData.metadata,
    statePath,
    processedThreads,
    botSummaries: botSummariesToDisplay,
    allThreads: prData.threads,
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
