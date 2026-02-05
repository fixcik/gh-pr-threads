/**
 * Shared utilities for command implementations
 */
import { getStatePath, loadState, saveState, markItem, clearMark, resolveId } from '../state/manager.js';
import { detectPR } from '../utils/pr.js';
import type { State } from '../types.js';

export interface CommandContext {
  state: State;
  statePath: string;
  fullId: string;
}

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
 * Prepares command context by loading state and resolving the short ID
 */
export function prepareCommandContext(shortId: string): CommandContext {
  const pr = detectPR();
  const statePath = getStatePath(pr.owner, pr.repo, pr.number);
  const state = loadState(statePath);

  const fullId = resolveId(state, shortId);

  if (!fullId) {
    console.error(`❌ ID '${shortId}' not found in state. Run gh-pr-threads first to fetch threads.`);
    process.exit(1);
  }

  return { state, statePath, fullId };
}

/**
 * Validates that the ID is a thread (not a nitpick)
 */
export function ensureIsThread(shortId: string, fullId: string): void {
  if (!fullId.startsWith('PRRT_')) {
    console.error(`❌ Cannot perform this operation on nitpick '${shortId}'. Only review threads are supported.`);
    process.exit(1);
  }
}

/**
 * Marks an item and saves state
 */
export function markAndSave(
  context: CommandContext,
  status: 'done' | 'skip' | 'later'
): void {
  markItem(context.state, context.fullId, status);
  console.log(`📌 Marked as ${status}`);
  saveState(context.statePath, context.state);
  console.log(`💾 State saved`);
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

  for (const [shortId, fullId] of context.resolvedIds) {
    if (fullId.startsWith('PRRT_')) {
      threads.set(shortId, fullId);
    } else {
      nonThreads.push(shortId);
    }
  }

  return { threads, nonThreads };
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
  const result: BatchResult = { successful: [], failed: [] };

  for (const shortId of shortIds) {
    const fullId = context.resolvedIds.get(shortId);
    if (fullId) {
      const success = markItem(context.state, fullId, status, note);
      if (success) {
        result.successful.push(shortId);
      } else {
        result.failed.push({ id: shortId, error: 'Failed to mark item' });
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
 * Clears marks for multiple items in batch and saves state once
 */
export function clearBatchAndSave(
  context: BatchCommandContext,
  shortIds: string[]
): BatchResult {
  const result: BatchResult = { successful: [], failed: [] };

  for (const shortId of shortIds) {
    const fullId = context.resolvedIds.get(shortId);
    if (fullId) {
      const success = clearMark(context.state, fullId);
      if (success) {
        result.successful.push(shortId);
      } else {
        result.failed.push({ id: shortId, error: 'Failed to clear mark' });
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
 * Reports batch operation results to console
 */
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
