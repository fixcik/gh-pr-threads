import * as fs from 'fs';
import * as path from 'path';
import type { State } from '../types.js';

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
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
      // Ignore parse errors
    }
  }
  return { pr: '', updatedAt: '', threads: {}, nitpicks: {} };
}

export function saveState(statePath: string, state: State): void {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}
