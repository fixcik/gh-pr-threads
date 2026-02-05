import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';
import { saveState, markItem } from '../state/manager.js';
import {
  prepareBatchCommandContext,
  filterThreadsOnly,
  reportBatchResults,
  type BatchResult
} from './shared.js';

export async function runReplyCommand(
  ids: string[],
  message: string,
  markAs?: 'done' | 'skip' | 'later'
): Promise<void> {
  const context = prepareBatchCommandContext(ids);

  // Check if all IDs are invalid
  if (context.resolvedIds.size === 0) {
    console.error(`❌ None of the provided IDs were found in state. Run gh-pr-threads first to fetch threads.`);
    for (const id of context.invalidIds) {
      console.error(`   - ${id}: Not found`);
    }
    process.exit(1);
  }

  // Filter to threads only
  const { threads, nonThreads } = filterThreadsOnly(context);

  if (threads.size === 0) {
    console.error(`❌ None of the provided IDs are review threads. Reply only works with threads.`);
    for (const id of nonThreads) {
      console.error(`   - ${id}: Is a nitpick, not a thread`);
    }
    process.exit(1);
  }

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
  if (markAs && result.successful.length > 0) {
    for (const shortId of result.successful) {
      const fullId = threads.get(shortId);
      if (fullId) {
        markItem(context.state, fullId, markAs);
      }
    }
    saveState(context.statePath, context.state);
    console.log(`📌 Marked ${result.successful.length} item(s) as ${markAs}`);
  }

  const allSucceeded = reportBatchResults(result, 'Reply', context.invalidIds, nonThreads);

  if (result.successful.length > 0 && markAs) {
    console.log(`💾 State saved to ${context.statePath}`);
  }

  if (!allSucceeded) {
    process.exit(1);
  }
}
