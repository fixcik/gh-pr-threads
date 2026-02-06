import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION, RESOLVE_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData, ResolveMutationData } from '../github/apiTypes.js';
import {
  prepareThreadCommandContext,
  reportBatchResults,
  markSuccessfulItems,
  type BatchResult,
  type PROptions
} from './shared.js';

export function runResolveCommand(
  ids: string[],
  reply?: string,
  markAs?: 'done' | 'skip' | 'later',
  prOptions?: PROptions
): void {
  const { context, threads, nonThreads } = prepareThreadCommandContext(ids, prOptions);

  const result: BatchResult = { successful: [], failed: [] };

  // Execute resolve operations (sequentially via execSync)
  // Note: If reply succeeds but resolve fails, the reply is still posted
  Array.from(threads.entries()).forEach(([shortId, fullId]) => {
    try {
      // Optionally reply first
      if (reply) {
        const replyResult = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, {
          threadId: fullId,
          body: reply
        });
        const commentUrl = replyResult.addPullRequestReviewThreadReply?.comment?.url;
        console.log(`💬 Replied to thread ${shortId}`);
        if (commentUrl) {
          console.log(`   ${commentUrl}`);
        }
      }

      // Resolve the thread
      runGhMutation<ResolveMutationData>(RESOLVE_MUTATION, { threadId: fullId });
      result.successful.push(shortId);
      console.log(`🔒 Resolved thread ${shortId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed.push({ id: shortId, error: errorMessage });
    }
  });

  // Optionally mark successful items
  if (markAs) {
    markSuccessfulItems(context, threads, result.successful, markAs);
  }

  const allSucceeded = reportBatchResults(result, 'Resolve', context.invalidIds, nonThreads);

  if (!allSucceeded) {
    process.exit(1);
  }
}
