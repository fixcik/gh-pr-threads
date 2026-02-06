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
  if (!ctx.threadId || !ctx.resolvedThreadId || ctx.threadId !== ctx.resolvedThreadId) {
    return;
  }

  const looksLikePath = ctx.threadId.includes(':') && ctx.threadId.includes('/');
  const looksLikeGraphql = /^PRR[CT]_/.test(ctx.threadId);

  if (!looksLikePath && !looksLikeGraphql) {
    console.error(`Error: Thread '${ctx.threadId}' not found in PR ${ctx.owner}/${ctx.repo}#${ctx.number}`);
    console.error(`State file: ${ctx.statePath}`);
    console.error(`Hint: Run without --thread first to populate thread IDs.`);
    process.exit(1);
  }
}
