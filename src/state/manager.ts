import * as fs from 'fs';
import * as path from 'path';
import type { State, ProcessedThread, Nitpick } from '../types.js';
import { shortId } from '../utils/shortId.js';

export function getStatePath(owner: string, repo: string, number: number): string {
  const dir = path.join(process.env.HOME || '', '.cursor', 'reviews', `${owner}-${repo}-${number}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'pr-state.json');
}

export function loadState(statePath: string): State {
  if (fs.existsSync(statePath)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      // Ensure idMap exists for backward compatibility
      if (!loaded.idMap) {
        loaded.idMap = {};
      }
      // Ensure cursorCache is explicitly undefined if not present (backward compatibility)
      if (!loaded.cursorCache) {
        loaded.cursorCache = undefined;
      }
      return loaded;
    } catch {
      // Ignore parse errors
    }
  }
  return { pr: '', updatedAt: '', threads: {}, nitpicks: {}, idMap: {} };
}

export function saveState(statePath: string, state: State): void {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Clears all done/skip markers from state
 */
export function clearState(state: State): void {
  state.threads = {};
  state.nitpicks = {};
  state.idMap = {};
}

/**
 * Registers mapping shortId → fullId for threads and nitpicks in state
 */
export function registerIds(
  state: State,
  threads: ProcessedThread[],
  nitpicks: Nitpick[]
): void {
  threads.forEach((thread) => {
    const short = shortId(thread.thread_id);
    state.idMap[short] = thread.thread_id;
  });

  nitpicks.forEach((nitpick) => {
    const short = shortId(nitpick.id);
    state.idMap[short] = nitpick.id;
  });
}

/**
 * Resolves full ID by short hash
 * @returns full ID or undefined if not found
 */
export function resolveId(state: State, shortOrFullId: string): string | undefined {
  // If it's already a full ID
  if (shortOrFullId.length > 6) {
    return shortOrFullId;
  }

  // Search in mapping
  return state.idMap[shortOrFullId];
}

/**
 * Marks a thread or nitpick with a status
 * @param shortOrFullId short or full ID
 * @param status 'done', 'skip', or 'later'
 * @param note optional note
 */
export function markItem(
  state: State,
  shortOrFullId: string,
  status: 'done' | 'skip' | 'later',
  note?: string
): boolean {
  const fullId = resolveId(state, shortOrFullId);

  if (!fullId) {
    return false;
  }

  // Determine type by ID format and mark
  if (fullId.startsWith('PRRT_') || fullId.includes('/comments/')) {
    state.threads[fullId] = { status, note };
  } else {
    state.nitpicks[fullId] = { status, note };
  }

  return true;
}

/**
 * Clears the mark from a thread or nitpick
 * @param shortOrFullId short or full ID
 */
export function clearMark(state: State, shortOrFullId: string): boolean {
  const fullId = resolveId(state, shortOrFullId);

  if (!fullId) {
    return false;
  }

  // Remove from both collections
  delete state.threads[fullId];
  delete state.nitpicks[fullId];

  return true;
}

/**
 * @deprecated Use markItem instead
 */
export function markResolved(
  state: State,
  shortOrFullId: string,
  status: 'done' | 'skip',
  note?: string
): boolean {
  return markItem(state, shortOrFullId, status, note);
}
