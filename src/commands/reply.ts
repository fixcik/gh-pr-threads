import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';
import {
  prepareBatchCommandContext,
  filterThreadsOnly,
  reportBatchResults,
  validateBatchContext,
  validateThreadsOnly,
  markSuccessfulItems,
  type BatchResult
} from './shared.js';

export async function runReplyCommand(
  ids: string[],
  message: string,
  markAs?: 'done' | 'skip' | 'later'
): Promise<void> {
  const context = prepareBatchCommandContext(ids);

  // Validate IDs
  validateBatchContext(context);

  // Filter to threads only
  const { threads, nonThreads } = filterThreadsOnly(context);
  validateThreadsOnly(threads, nonThreads);

  const result: BatchResult = { successful: [], failed: [] };

  // Execute replies (sequentially via execSync, but processed as batch)
  const replyPromises = Array.from(threads.entries()).map(async ([shortId, fullId]) => {
    try {
      const mutationResult = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, {
        threadId: fullId,
        body: message
      });
      const commentUrl = mutationResult.addPullRequestReviewThreadReply?.comment?.url;
      return { shortId, fullId, success: true, url: commentUrl };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { shortId, fullId, success: false, error: errorMessage };
    }
  });

  const replyResults = await Promise.all(replyPromises);

  // Process results
  for (const res of replyResults) {
    if (res.success) {
      result.successful.push(res.shortId);
      console.log(`💬 Replied to thread ${res.shortId}`);
      if (res.url) {
        console.log(`   ${res.url}`);
      }
    } else {
      result.failed.push({ id: res.shortId, error: res.error || 'Unknown error' });
    }
  }

  // Optionally mark successful items
  if (markAs) {
    markSuccessfulItems(context, threads, result.successful, markAs);
  }

  const allSucceeded = reportBatchResults(result, 'Reply', context.invalidIds, nonThreads);

  if (result.successful.length > 0 && markAs) {
    console.log(`💾 State saved to ${context.statePath}`);
  }

  if (!allSucceeded) {
    process.exit(1);
  }
}
