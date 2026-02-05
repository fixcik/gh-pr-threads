import Debug from 'debug';
import type { Thread } from '../types.js';

const debug = Debug('gh-pr-threads');

/**
 * Filters threads by target thread ID (GraphQL ID or path:line format)
 */
export function filterThreadById(threads: Thread[], targetThreadId: string): Thread[] {
  return threads.filter(thread => {
    // Support both GraphQL ID format (PRRT_xxx) and old path:line format
    if (thread.id === targetThreadId) {
      debug(`Thread matched by GraphQL ID: ${thread.id}`);
      return true;
    }

    // Check if targetThreadId is in path:line format
    if (targetThreadId.includes(':') && targetThreadId.includes('/')) {
      const lastColonIdx = targetThreadId.lastIndexOf(':');
      const path = targetThreadId.slice(0, lastColonIdx);
      const lineRange = targetThreadId.slice(lastColonIdx + 1);
      const [startLine, endLine] = lineRange.split('-').map(Number);

      if (Number.isNaN(startLine)) {
        debug(`Invalid line number in targetThreadId: ${targetThreadId}`);
        return false;
      }

      debug(`Checking thread: path=${thread.path}, line=${thread.line} against path=${path}, lineRange=${lineRange}`);

      // Check if path matches
      if (thread.path !== path) {
        return false;
      }

      // Check if thread line falls within the range or matches exactly
      if (endLine) {
        // Range specified (e.g., "13-26")
        if (thread.line && thread.line >= startLine && thread.line <= endLine) {
          debug(`Thread matched by path:line range`);
          return true;
        }
      } else {
        // Single line specified (e.g., "13")
        if (thread.line === startLine) {
          debug(`Thread matched by path:line`);
          return true;
        }
      }
    }

    return false;
  });
}
