import { getStatePath, loadState, saveState, markItem, resolveId } from '../state/manager.js';
import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION } from '../github/mutations.js';
import { detectPR } from '../utils/pr.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';

export async function runReplyCommand(
  id: string,
  message: string,
  markAs?: 'done' | 'skip' | 'later'
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

  // Check if it's a thread (can reply) or nitpick (cannot reply)
  if (!fullId.startsWith('PRRT_')) {
    console.error(`❌ Cannot reply to nitpick '${id}'. Only review threads support replies.`);
    process.exit(1);
  }

  try {
    // Send reply via GraphQL
    const result = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, { threadId: fullId, body: message });
    const commentUrl = result.addPullRequestReviewThreadReply?.comment?.url;
    console.log(`💬 Replied to thread ${id}`);
    if (commentUrl) {
      console.log(`   ${commentUrl}`);
    }

    // Optionally mark
    if (markAs) {
      markItem(state, fullId, markAs);
      console.log(`📌 Marked as ${markAs}`);
    }

    saveState(statePath, state);
    console.log(`💾 State saved`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to reply: ${errorMessage}`);
    process.exit(1);
  }
}
