import Debug from 'debug';
import type { State } from '../types.js';

const debug = Debug('gh-pr-threads');

/**
 * Resolves a thread ID from short format, path:line format, or GraphQL ID
 */
export function resolveThreadId(threadId: string | undefined, state: State): string | null {
  if (!threadId) {
    return null;
  }

  // Check if threadId is in path:line format
  if (threadId.includes(':') && threadId.includes('/')) {
    debug(`Using path:line format directly: ${threadId}`);
    return threadId;
  }

  // Try to resolve from short ID map
  if (state.idMap[threadId]) {
    const fullId = state.idMap[threadId];
    debug(`Resolved short ID '${threadId}' to full ID '${fullId}'`);
    return fullId;
  }

  // Otherwise, assume it's a full GraphQL ID and use as-is
  debug(`Using thread ID directly (assuming GraphQL ID): ${threadId}`);
  return threadId;
}
