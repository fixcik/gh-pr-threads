import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION, RESOLVE_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData, ResolveMutationData } from '../github/apiTypes.js';
import {
  prepareBatchCommandContext,
  filterThreadsOnly,
  reportBatchResults,
  validateBatchContext,
  validateThreadsOnly,
  markSuccessfulItems,
  type BatchResult
} from './shared.js';

export async function runResolveCommand(
  ids: string[],
  reply?: string,
  markAs?: 'done' | 'skip' | 'later'
): Promise<void> {
  const context = prepareBatchCommandContext(ids);

  // Validate IDs
  validateBatchContext(context);

  // Filter to threads only
  const { threads, nonThreads } = filterThreadsOnly(context);
  validateThreadsOnly(threads, nonThreads);

  const result: BatchResult = { successful: [], failed: [] };

  // Execute resolve operations (sequentially via execSync, but processed as batch)
  // Note: If reply succeeds but resolve fails, the reply is still posted
  const resolvePromises = Array.from(threads.entries()).map(async ([shortId, fullId]) => {
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
      return { shortId, fullId, success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { shortId, fullId, success: false, error: errorMessage };
    }
  });

  const resolveResults = await Promise.all(resolvePromises);

  // Process results
  for (const res of resolveResults) {
    if (res.success) {
      result.successful.push(res.shortId);
      console.log(`🔒 Resolved thread ${res.shortId}`);
    } else {
      result.failed.push({ id: res.shortId, error: res.error || 'Unknown error' });
    }
  }

  // Optionally mark successful items
  if (markAs) {
    markSuccessfulItems(context, threads, result.successful, markAs);
  }

  const allSucceeded = reportBatchResults(result, 'Resolve', context.invalidIds, nonThreads);

  if (result.successful.length > 0 && markAs) {
    console.log(`💾 State saved to ${context.statePath}`);
  }

  if (!allSucceeded) {
    process.exit(1);
  }
}
