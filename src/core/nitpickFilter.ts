import Debug from 'debug';
import type { Nitpick } from '../types.js';

const debug = Debug('gh-pr-threads');

/**
 * Filters nitpicks by target ID (path:line or path:startLine-endLine format)
 */
export function filterNitpicksById(nitpicks: Nitpick[], targetId: string): Nitpick[] {
  return nitpicks.filter(nitpick => {
    // Direct ID match
    if (nitpick.id === targetId) {
      debug(`Nitpick matched by exact ID: ${nitpick.id}`);
      return true;
    }

    // Check if targetId is in path:line format
    if (targetId.includes(':') && targetId.includes('/')) {
      const lastColonIdx = targetId.lastIndexOf(':');
      const targetPath = targetId.slice(0, lastColonIdx);
      const lineRange = targetId.slice(lastColonIdx + 1);

      // Parse line range (e.g., "13-26" or just "13")
      const [startLine, endLine] = lineRange.split('-').map(Number);

      if (Number.isNaN(startLine)) {
        debug(`Invalid line number in targetId: ${targetId}`);
        return false;
      }

      // Parse nitpick line (may be a range like "13-26" or single line "13")
      const nitpickLine = nitpick.line;
      const [nitpickStart, nitpickEnd] = nitpickLine.split('-').map(Number);

      if (Number.isNaN(nitpickStart)) {
        debug(`Skipping nitpick with invalid line format: ${nitpickLine}`);
        return false;
      }

      debug(`Checking nitpick: path=${nitpick.path}, line=${nitpickLine} against path=${targetPath}, line=${lineRange}`);

      // Check if paths match
      if (nitpick.path !== targetPath) {
        return false;
      }

      // Check if lines match or overlap
      if (endLine) {
        // Target is a range (e.g., "13-26")
        // Match if nitpick range overlaps with target range
        const nitpickEndResolved = nitpickEnd || nitpickStart;
        const hasOverlap = nitpickStart <= endLine && nitpickEndResolved >= startLine;

        if (hasOverlap) {
          debug(`Nitpick matched by overlapping range`);
          return true;
        }
      } else {
        // Target is a single line (e.g., "13")
        // Match if nitpick line equals target or nitpick range contains target
        const nitpickEndResolved = nitpickEnd || nitpickStart;
        const contains = startLine >= nitpickStart && startLine <= nitpickEndResolved;

        if (contains) {
          debug(`Nitpick matched by containing line`);
          return true;
        }
      }
    }

    return false;
  });
}
