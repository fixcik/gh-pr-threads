import { describe, it, expect } from 'vitest';
import { THREADS_QUERY, THREAD_COMMENTS_QUERY } from './queries.js';

describe('GraphQL queries', () => {
  it('THREADS_QUERY should include reactionGroups', () => {
    expect(THREADS_QUERY).toContain('reactionGroups');
    expect(THREADS_QUERY).toContain('reactors');
    expect(THREADS_QUERY).toContain('... on User { login }');
  });

  it('THREAD_COMMENTS_QUERY should include reactionGroups', () => {
    expect(THREAD_COMMENTS_QUERY).toContain('reactionGroups');
    expect(THREAD_COMMENTS_QUERY).toContain('reactors');
  });
});
