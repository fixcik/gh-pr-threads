import Debug from 'debug';
import { parseCliArgs } from '../cli.js';
import { getStatePath, loadState, registerIds, saveState } from '../state/manager.js';
import { setImageStoragePath } from '../utils/images.js';
import { resolveThreadId } from './threadResolver.js';
import { filterThreadById } from './threadFilter.js';
import { filterNitpicksById } from './nitpickFilter.js';
import { fetchPRData } from './dataFetcher.js';
import { processThreads } from './threadProcessor.js';
import { createFilterFunction, filterBotSummariesByNitpicks } from './filterHelpers.js';
import { validateThreadId } from './validationHelpers.js';
import { processBotData } from './processingHelpers.js';
import { outputResults } from './outputHelpers.js';

const debug = Debug('gh-pr-threads');
const debugTiming = Debug('gh-pr-threads:timing');

export async function main() {
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
  validateThreadId({ threadId, resolvedThreadId: targetThreadId, statePath, owner, repo, number });

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
  const { botSummaries, allNitpicks } = processBotData(prData, ignoreBots, filter, state, includeDone);

  // Filter nitpicks if targeting specific thread/nitpick
  const nitpicksToDisplay = targetThreadId
    ? filterNitpicksById(allNitpicks, targetThreadId)
    : allNitpicks;

  // Register IDs and save state with updated cursor cache
  registerIds(state, processedThreads, allNitpicks);
  if (!noCache) {
    state.cursorCache = prData.updatedCursorCache;
  }
  state.owner = prData.metadata.owner;
  state.updatedAt = new Date().toISOString();
  saveState(statePath, state);

  const totalTime = Date.now() - startTime;
  debugTiming(`Total execution time: ${totalTime}ms`);
  debug('Output ready');

  // Output results in selected format (use filtered nitpicks in bot summaries)
  const nitpickIdSet = new Set(nitpicksToDisplay.map(n => n.id));
  const botSummariesToDisplay = targetThreadId && botSummaries.length > 0
    ? filterBotSummariesByNitpicks(botSummaries, nitpickIdSet)
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
