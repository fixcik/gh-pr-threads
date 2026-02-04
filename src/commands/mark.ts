import { getStatePath, loadState, saveState, markItem, clearMark, resolveId } from '../state/manager.js';
import { detectPR } from '../utils/pr.js';

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
