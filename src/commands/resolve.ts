import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION, RESOLVE_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData, ResolveMutationData } from '../github/apiTypes.js';
import { prepareCommandContext, ensureIsThread, markAndSave } from './shared.js';

export async function runResolveCommand(
  id: string,
  reply?: string,
  markAs?: 'done' | 'skip' | 'later'
): Promise<void> {
  const context = prepareCommandContext(id);
  ensureIsThread(id, context.fullId);

  try {
    // Optionally reply first
    if (reply) {
      const replyResult = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, { threadId: context.fullId, body: reply });
      const commentUrl = replyResult.addPullRequestReviewThreadReply?.comment?.url;
      console.log(`💬 Replied to thread ${id}`);
      if (commentUrl) {
        console.log(`   ${commentUrl}`);
      }
    }

    // Resolve the thread
    runGhMutation<ResolveMutationData>(RESOLVE_MUTATION, { threadId: context.fullId });
    console.log(`🔒 Resolved thread ${id}`);

    // Optionally mark
    if (markAs) {
      markAndSave(context, markAs);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to resolve: ${errorMessage}`);
    process.exit(1);
  }
}
