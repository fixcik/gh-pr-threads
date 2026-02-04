import { getStatePath, loadState, saveState, markItem, resolveId } from '../state/manager.js';
import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION, RESOLVE_MUTATION } from '../github/mutations.js';
import { detectPR } from '../utils/pr.js';
import type { AddReplyMutationData, ResolveMutationData } from '../github/apiTypes.js';

export async function runResolveCommand(
  id: string,
  reply?: string,
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

  // Check if it's a thread (can resolve) or nitpick (cannot resolve)
  if (!fullId.startsWith('PRRT_')) {
    console.error(`❌ Cannot resolve nitpick '${id}'. Only review threads can be resolved.`);
    process.exit(1);
  }

  try {
    // Optionally reply first
    if (reply) {
      const replyResult = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, { threadId: fullId, body: reply });
      const commentUrl = replyResult.addPullRequestReviewThreadReply?.comment?.url;
      console.log(`💬 Replied to thread ${id}`);
      if (commentUrl) {
        console.log(`   ${commentUrl}`);
      }
    }

    // Resolve the thread
    runGhMutation<ResolveMutationData>(RESOLVE_MUTATION, { threadId: fullId });
    console.log(`🔒 Resolved thread ${id}`);

    // Optionally mark
    if (markAs) {
      markItem(state, fullId, markAs);
      console.log(`📌 Marked as ${markAs}`);
    }

    saveState(statePath, state);
    console.log(`💾 State saved`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to resolve: ${errorMessage}`);
    process.exit(1);
  }
}
