import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';
import { prepareCommandContext, ensureIsThread, markAndSave } from './shared.js';

export async function runReplyCommand(
  id: string,
  message: string,
  markAs?: 'done' | 'skip' | 'later'
): Promise<void> {
  const context = prepareCommandContext(id);
  ensureIsThread(id, context.fullId);

  try {
    // Send reply via GraphQL
    const result = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, { threadId: context.fullId, body: message });
    const commentUrl = result.addPullRequestReviewThreadReply?.comment?.url;
    console.log(`💬 Replied to thread ${id}`);
    if (commentUrl) {
      console.log(`   ${commentUrl}`);
    }

    // Optionally mark
    if (markAs) {
      markAndSave(context, markAs);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to reply: ${errorMessage}`);
    process.exit(1);
  }
}
