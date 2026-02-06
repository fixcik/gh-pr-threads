export interface ThreadIdValidationContext {
  threadId: string | undefined;
  resolvedThreadId: string | null;
  statePath: string;
  owner: string;
  repo: string;
  number: number;
}

/**
 * Validates that a thread ID exists in the state or is a valid GraphQL/path:line format
 * Exits with error if validation fails
 */
export function validateThreadId(ctx: ThreadIdValidationContext): void {
  // No thread ID provided - nothing to validate
  if (!ctx.threadId) {
    return;
  }

  // Thread ID was resolved to a different value (found in state) - valid
  if (ctx.resolvedThreadId && ctx.threadId !== ctx.resolvedThreadId) {
    return;
  }

  // Thread ID was not found in state - check if it's a valid format
  // (GraphQL ID or path:line format that can be used directly)
  const looksLikePath = ctx.threadId.includes(':') && ctx.threadId.includes('/');
  const looksLikeGraphql = /^PRR[CT]_/.test(ctx.threadId);

  if (!looksLikePath && !looksLikeGraphql) {
    console.error(`Error: Thread '${ctx.threadId}' not found in PR ${ctx.owner}/${ctx.repo}#${ctx.number}`);
    console.error(`State file: ${ctx.statePath}`);
    console.error(`Hint: Run without --thread first to populate thread IDs.`);
    process.exit(1);
  }
}
