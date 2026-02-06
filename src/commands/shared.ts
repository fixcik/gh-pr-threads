/**
 * Shared utilities for command implementations
 */
import { getStatePath, loadState, saveState, markItem, clearMark, resolveId } from '../state/manager.js';
import { detectPR } from '../utils/pr.js';
import type { State } from '../types.js';

export interface BatchCommandContext {
  state: State;
  statePath: string;
  resolvedIds: Map<string, string>;  // shortId -> fullId
  invalidIds: string[];
}

export interface BatchResult {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Prepares batch command context by loading state and resolving all short IDs
 */
export function prepareBatchCommandContext(shortIds: string[]): BatchCommandContext {
  const pr = detectPR();
  const statePath = getStatePath(pr.owner, pr.repo, pr.number);
  const state = loadState(statePath);

  const resolvedIds = new Map<string, string>();
  const invalidIds: string[] = [];

  for (const shortId of shortIds) {
    const fullId = resolveId(state, shortId);
    if (fullId) {
      resolvedIds.set(shortId, fullId);
    } else {
      invalidIds.push(shortId);
    }
  }

  return { state, statePath, resolvedIds, invalidIds };
}

/**
 * Filters batch context to only include threads (not nitpicks)
 * Returns thread IDs and list of non-thread IDs that were filtered out
 */
export function filterThreadsOnly(context: BatchCommandContext): {
  threads: Map<string, string>;
  nonThreads: string[];
} {
  const threads = new Map<string, string>();
  const nonThreads: string[] = [];

  Array.from(context.resolvedIds.entries()).forEach(([shortId, fullId]) => {
    if (fullId.startsWith('PRRT_')) {
      threads.set(shortId, fullId);
    } else {
      nonThreads.push(shortId);
    }
  });

  return { threads, nonThreads };
}

/**
 * Generic batch operation helper that processes items and saves state once
 */
function processBatchOperation(
  context: BatchCommandContext,
  shortIds: string[],
  operation: (state: State, fullId: string) => boolean,
  errorMessage: string
): BatchResult {
  const result: BatchResult = { successful: [], failed: [] };

  for (const shortId of shortIds) {
    const fullId = context.resolvedIds.get(shortId);
    if (fullId) {
      const success = operation(context.state, fullId);
      if (success) {
        result.successful.push(shortId);
      } else {
        result.failed.push({ id: shortId, error: errorMessage });
      }
    } else {
      result.failed.push({ id: shortId, error: 'Not found in state' });
    }
  }

  if (result.successful.length > 0) {
    saveState(context.statePath, context.state);
  }

  return result;
}

/**
 * Marks multiple items in batch and saves state once
 */
export function markBatchAndSave(
  context: BatchCommandContext,
  shortIds: string[],
  status: 'done' | 'skip' | 'later',
  note?: string
): BatchResult {
  return processBatchOperation(
    context,
    shortIds,
    (state, fullId) => markItem(state, fullId, status, note),
    'Failed to mark item'
  );
}

/**
 * Clears marks for multiple items in batch and saves state once
 */
export function clearBatchAndSave(
  context: BatchCommandContext,
  shortIds: string[]
): BatchResult {
  return processBatchOperation(
    context,
    shortIds,
    (state, fullId) => clearMark(state, fullId),
    'Failed to clear mark'
  );
}

/**
 * Reports batch operation results to console
 */
/**
 * Validates batch command context and throws if all IDs are invalid
 */
export function validateBatchContext(context: BatchCommandContext): void {
  if (context.resolvedIds.size === 0) {
    const details = context.invalidIds.map(id => `   - ${id}: Not found`).join('\n');
    throw new Error(`None of the provided IDs were found in state. Run gh-pr-threads first to fetch threads.\n${details}`);
  }
}

/**
 * Validates that context contains only threads and throws if no threads found
 */
export function validateThreadsOnly(
  threads: Map<string, string>,
  nonThreads: string[]
): void {
  if (threads.size === 0) {
    const details = nonThreads.map(id => `   - ${id}: Is a nitpick, not a thread`).join('\n');
    throw new Error(`None of the provided IDs are review threads. This command only works with threads.\n${details}`);
  }
}

/**
 * Prepares and validates thread-only context for commands
 * Combines prepareBatchCommandContext, validateBatchContext, filterThreadsOnly, and validateThreadsOnly
 */
export function prepareThreadCommandContext(shortIds: string[]): {
  context: BatchCommandContext;
  threads: Map<string, string>;
  nonThreads: string[];
} {
  const context = prepareBatchCommandContext(shortIds);
  validateBatchContext(context);
  
  const { threads, nonThreads } = filterThreadsOnly(context);
  validateThreadsOnly(threads, nonThreads);
  
  return { context, threads, nonThreads };
}

/**
 * Marks successful items and saves state
 */
export function markSuccessfulItems(
  context: BatchCommandContext,
  threads: Map<string, string>,
  successfulIds: string[],
  markAs: 'done' | 'skip' | 'later'
): void {
  if (successfulIds.length === 0) return;

  for (const shortId of successfulIds) {
    const fullId = threads.get(shortId);
    if (fullId) {
      markItem(context.state, fullId, markAs);
    }
  }
  saveState(context.statePath, context.state);
  console.log(`📌 Marked ${successfulIds.length} item(s) as ${markAs}`);
}

export function reportBatchResults(
  result: BatchResult,
  operation: string,
  invalidIds: string[] = [],
  nonThreadIds: string[] = []
): boolean {
  // Report successful items
  if (result.successful.length > 0) {
    console.log(`✅ ${operation} succeeded for: ${result.successful.join(', ')}`);
  }

  // Report non-thread IDs (for thread-only operations)
  for (const id of nonThreadIds) {
    console.log(`⚠️  Skipped ${id}: not a review thread (nitpicks cannot be replied to or resolved)`);
  }

  // Report invalid IDs
  for (const id of invalidIds) {
    console.log(`❌ ${operation} failed for ${id}: Not found in state`);
  }

  // Report failed items
  for (const { id, error } of result.failed) {
    console.log(`❌ ${operation} failed for ${id}: ${error}`);
  }

  // Summary
  const totalAttempted = result.successful.length + result.failed.length + invalidIds.length + nonThreadIds.length;
  const totalSuccessful = result.successful.length;

  if (totalAttempted > 1) {
    console.log(`📊 Summary: ${totalSuccessful}/${totalAttempted} succeeded`);
  }

  // Return true if all items succeeded
  return result.failed.length === 0 && invalidIds.length === 0 && nonThreadIds.length === 0;
}
