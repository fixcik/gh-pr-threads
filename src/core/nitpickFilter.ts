import Debug from 'debug';
import type { Nitpick } from '../types.js';

const debug = Debug('gh-pr-threads');

/**
 * Filters nitpicks by target ID (path:line or path:startLine-endLine format)
 */
interface LineRange {
  start: number;
  end: number;
}

function parseLineRange(lineStr: string): LineRange | null {
  const [start, end] = lineStr.split('-').map(Number);
  if (Number.isNaN(start)) {
    return null;
  }
  return { start, end: Number.isNaN(end) ? start : end };
}

function rangesOverlap(range1: LineRange, range2: LineRange): boolean {
  return range1.start <= range2.end && range1.end >= range2.start;
}

function parsePathLineTarget(targetId: string): { path: string; lineRange: LineRange } | null {
  const lastColonIdx = targetId.lastIndexOf(':');
  const targetPath = targetId.slice(0, lastColonIdx);
  const lineRangeStr = targetId.slice(lastColonIdx + 1);
  
  const lineRange = parseLineRange(lineRangeStr);
  if (!lineRange) {
    debug(`Invalid line number in targetId: ${targetId}`);
    return null;
  }
  
  return { path: targetPath, lineRange };
}

export function filterNitpicksById(nitpicks: Nitpick[], targetId: string): Nitpick[] {
  return nitpicks.filter(nitpick => {
    // Direct ID match
    if (nitpick.id === targetId) {
      debug(`Nitpick matched by exact ID: ${nitpick.id}`);
      return true;
    }

    // Check if targetId is in path:line format
    if (targetId.includes(':') && targetId.includes('/')) {
      const target = parsePathLineTarget(targetId);
      if (!target) {
        return false;
      }

      // Parse nitpick line range
      const nitpickRange = parseLineRange(nitpick.line);
      if (!nitpickRange) {
        debug(`Skipping nitpick with invalid line format: ${nitpick.line}`);
        return false;
      }

      debug(`Checking nitpick: path=${nitpick.path}, line=${nitpick.line} against path=${target.path}, line=${target.lineRange.start}${target.lineRange.end !== target.lineRange.start ? `-${target.lineRange.end}` : ''}`);

      // Check if paths match
      if (nitpick.path !== target.path) {
        return false;
      }

      // Check if lines overlap
      if (rangesOverlap(nitpickRange, target.lineRange)) {
        debug(`Nitpick matched by overlapping range`);
        return true;
      }
    }

    return false;
  });
}
