import {
  prepareBatchCommandContext,
  markBatchAndSave,
  clearBatchAndSave,
  reportBatchResults,
  type PROptions
} from './shared.js';

export type MarkStatus = 'done' | 'skip' | 'later' | 'clear';

export function runMarkCommand(
  ids: string[],
  status: MarkStatus,
  note?: string,
  prOptions?: PROptions
): void {
  const context = prepareBatchCommandContext(ids, prOptions);

  // Check if all IDs are invalid
  if (context.resolvedIds.size === 0) {
    console.error(`❌ None of the provided IDs were found in state. Run gh-pr-threads first to fetch threads.`);
    for (const id of context.invalidIds) {
      console.error(`   - ${id}: Not found`);
    }
    process.exit(1);
  }

  let result;
  const operation = status === 'clear' ? 'Clear mark' : `Mark as ${status}`;

  if (status === 'clear') {
    result = clearBatchAndSave(context, ids.filter(id => context.resolvedIds.has(id)));
  } else {
    result = markBatchAndSave(context, ids.filter(id => context.resolvedIds.has(id)), status, note);
  }

  const allSucceeded = reportBatchResults(result, operation, context.invalidIds);

  if (result.successful.length > 0) {
    console.log(`💾 State saved to ${context.statePath}`);
  }

  if (!allSucceeded) {
    process.exit(1);
  }
}
