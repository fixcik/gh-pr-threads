import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';
import {
  prepareThreadCommandContext,
  reportBatchResults,
  markSuccessfulItems,
  type BatchResult
} from './shared.js';

export function runReplyCommand(
  ids: string[],
  message: string,
  markAs?: 'done' | 'skip' | 'later'
): void {
  const { context, threads, nonThreads } = prepareThreadCommandContext(ids);

  const result: BatchResult = { successful: [], failed: [] };

  // Execute replies (sequentially via execSync)
  Array.from(threads.entries()).forEach(([shortId, fullId]) => {
    try {
      const mutationResult = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, {
        threadId: fullId,
        body: message
      });
      const commentUrl = mutationResult.addPullRequestReviewThreadReply?.comment?.url;
      result.successful.push(shortId);
      console.log(`💬 Replied to thread ${shortId}`);
      if (commentUrl) {
        console.log(`   ${commentUrl}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed.push({ id: shortId, error: errorMessage });
    }
  });

  // Optionally mark successful items
  if (markAs) {
    markSuccessfulItems(context, threads, result.successful, markAs);
  }

  const allSucceeded = reportBatchResults(result, 'Reply', context.invalidIds, nonThreads);

  if (!allSucceeded) {
    process.exit(1);
  }
}
