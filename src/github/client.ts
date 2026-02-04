import { execSync } from 'child_process';
import type { GraphQLResponse } from './apiTypes.js';

export function runGh<T = unknown>(args: string[]): T {
  try {
    const command = `gh ${args.join(' ')}`;
    const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(output) as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error running gh command: ${message}`);
    process.exit(1);
  }
}

/**
 * Execute a GraphQL mutation via gh api
 */
export function runGhMutation<T = unknown>(query: string, variables: Record<string, unknown>): T {
  try {
    const input = JSON.stringify({ query, variables });
    const output = execSync(`gh api graphql --input -`, {
      encoding: 'utf8',
      input,
      maxBuffer: 10 * 1024 * 1024
    });
    const result = JSON.parse(output) as GraphQLResponse<T>;
    if (result.errors) {
      throw new Error(result.errors.map((e) => e.message).join(', '));
    }
    if (!result.data) {
      throw new Error('GraphQL response missing data field');
    }
    return result.data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GraphQL mutation failed: ${message}`);
  }
}
