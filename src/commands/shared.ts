/**
 * Shared utilities for command implementations
 */
import { getStatePath, loadState, saveState, markItem, resolveId } from '../state/manager.js';
import { detectPR } from '../utils/pr.js';
import type { State } from '../types.js';

export interface CommandContext {
  state: State;
  statePath: string;
  fullId: string;
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
