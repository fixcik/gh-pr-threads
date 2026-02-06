import { runGhMutation } from '../github/client.js';
import { ADD_REACTION_MUTATION } from '../github/mutations.js';
import type { AddReactionMutationData } from '../github/apiTypes.js';
import { normalizeReaction } from '../utils/reactions.js';
import {
  prepareBatchCommandContext,
  reportBatchResults,
  validateBatchContext,
  type BatchResult
} from './shared.js';

function handleReactionError(error: unknown, shortId: string, result: BatchResult): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('already reacted')) {
    result.failed.push({
      id: shortId,
      error: 'You have already reacted with this emoji'
    });
  } else if (errorMessage.includes('Not Found')) {
    result.failed.push({
      id: shortId,
      error: 'Comment not found or you don\'t have access'
    });
  } else {
    result.failed.push({ id: shortId, error: errorMessage });
  }
}

export function runReactCommand(
  ids: string[],
  reaction: string
): void {
  // Normalize reaction input
  const normalizedReaction = normalizeReaction(reaction);

  const context = prepareBatchCommandContext(ids);

  // Validate IDs
  validateBatchContext(context);

  const result: BatchResult = { successful: [], failed: [] };

  // Execute reactions (sequentially via execSync)
  for (const [shortId, fullId] of Array.from(context.resolvedIds.entries())) {
    try {
      const mutationResult = runGhMutation<AddReactionMutationData>(
        ADD_REACTION_MUTATION,
        {
          subjectId: fullId,
          content: normalizedReaction
        }
      );

      const reactionId = mutationResult.addReaction?.reaction?.id;
      result.successful.push(shortId);
      console.log(`✓ Added ${normalizedReaction} reaction to comment ${shortId}`);
      if (reactionId) {
        console.log(`   Reaction ID: ${reactionId}`);
      }
    } catch (error: unknown) {
      handleReactionError(error, shortId, result);
    }
  }

  const allSucceeded = reportBatchResults(result, 'React', context.invalidIds, []);

  if (!allSucceeded) {
    process.exit(1);
  }
}
