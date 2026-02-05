import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION, RESOLVE_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData, ResolveMutationData } from '../github/apiTypes.js';
import { saveState, markItem } from '../state/manager.js';
import {
  prepareBatchCommandContext,
  filterThreadsOnly,
  reportBatchResults,
  type BatchResult
} from './shared.js';

export async function runResolveCommand(
  ids: string[],
  reply?: string,
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
    console.error(`❌ None of the provided IDs are review threads. Resolve only works with threads.`);
    for (const id of nonThreads) {
      console.error(`   - ${id}: Is a nitpick, not a thread`);
    }
    process.exit(1);
  }

  const result: BatchResult = { successful: [], failed: [] };

  // Execute resolve operations in parallel
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

  const allSucceeded = reportBatchResults(result, 'Resolve', context.invalidIds, nonThreads);

  if (result.successful.length > 0 && markAs) {
    console.log(`💾 State saved to ${context.statePath}`);
  }

  if (!allSucceeded) {
    process.exit(1);
  }
}
