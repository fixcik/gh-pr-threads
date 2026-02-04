import { execSync } from 'child_process';
import { getStatePath, loadState, saveState, markItem, clearMark, resolveId } from '../state/manager.js';

interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

function detectPR(): PRInfo {
  try {
    const prInfo = JSON.parse(execSync('gh pr view --json number,url', { encoding: 'utf8' }));
    const parts = prInfo.url.replace('https://github.com/', '').split('/');
    return {
      owner: parts[0],
      repo: parts[1],
      number: prInfo.number
    };
  } catch {
    throw new Error('Could not detect PR. Make sure you are in a git repository with an open PR.');
  }
}

export type MarkStatus = 'done' | 'skip' | 'later' | 'clear';

export async function runMarkCommand(
  id: string,
  status: MarkStatus,
  note?: string
): Promise<void> {
  const pr = detectPR();
  const statePath = getStatePath(pr.owner, pr.repo, pr.number);
  const state = loadState(statePath);

  // Resolve short ID to full ID
  const fullId = resolveId(state, id);

  if (!fullId) {
    console.error(`❌ ID '${id}' not found in state. Run gh-pr-threads first to fetch threads.`);
    process.exit(1);
  }

  if (status === 'clear') {
    const success = clearMark(state, fullId);
    if (success) {
      console.log(`✅ Cleared mark for ${id}`);
    } else {
      console.error(`❌ Failed to clear mark for ${id}`);
      process.exit(1);
    }
  } else {
    const success = markItem(state, fullId, status, note);
    if (success) {
      console.log(`✅ Marked ${id} as ${status}${note ? ` (note: ${note})` : ''}`);
    } else {
      console.error(`❌ Failed to mark ${id}`);
      process.exit(1);
    }
  }

  saveState(statePath, state);
  console.log(`💾 State saved to ${statePath}`);
}
