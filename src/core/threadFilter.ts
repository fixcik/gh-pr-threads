import Debug from 'debug';
import type { Thread } from '../types.js';

const debug = Debug('gh-pr-threads');

/**
 * Filters threads by target thread ID (GraphQL ID or path:line format)
 */
interface PathLineMatch {
  path: string;
  startLine: number;
  endLine?: number;
}

function parsePathLineId(targetThreadId: string): PathLineMatch | null {
  const lastColonIdx = targetThreadId.lastIndexOf(':');
  const path = targetThreadId.slice(0, lastColonIdx);
  const lineRange = targetThreadId.slice(lastColonIdx + 1);
  const [startRaw, endRaw] = lineRange.split('-');
  const startLine = Number(startRaw);
  const endLine = endRaw !== undefined && endRaw !== '' ? Number(endRaw) : undefined;

  if (Number.isNaN(startLine) || (endRaw !== undefined && (endRaw === '' || Number.isNaN(endLine)))) {
    debug(`Invalid line number in targetThreadId: ${targetThreadId}`);
    return null;
  }

  return { path, startLine, endLine };
}

function matchesPathLine(thread: Thread, match: PathLineMatch): boolean {
  if (thread.path !== match.path) {
    return false;
  }

  if (match.endLine !== undefined) {
    return thread.line !== null && thread.line !== undefined && thread.line >= match.startLine && thread.line <= match.endLine;
  }
  
  return thread.line === match.startLine;
}

export function filterThreadById(threads: Thread[], targetThreadId: string): Thread[] {
  return threads.filter(thread => {
    // Support both GraphQL ID format (PRRT_xxx) and old path:line format
    if (thread.id === targetThreadId) {
      debug(`Thread matched by GraphQL ID: ${thread.id}`);
      return true;
    }

    // Check if targetThreadId is in path:line format
    if (targetThreadId.includes(':') && targetThreadId.includes('/')) {
      const match = parsePathLineId(targetThreadId);
      if (!match) {
        return false;
      }

      debug(`Checking thread: path=${thread.path}, line=${thread.line} against path=${match.path}, lineRange=${match.startLine}${match.endLine ? `-${match.endLine}` : ''}`);

      if (matchesPathLine(thread, match)) {
        debug(`Thread matched by path:line${match.endLine ? ' range' : ''}`);
        return true;
      }
    }

    return false;
  });
}
