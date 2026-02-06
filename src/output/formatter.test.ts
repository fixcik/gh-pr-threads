import { describe, it, expect } from 'vitest';
import { formatOutput } from './formatter.js';
import type { ProcessedThread, ReactionGroup } from '../types.js';

describe('formatter reactions', () => {
  it('should include reactionGroups in JSON output', () => {
    const reactionGroups: ReactionGroup[] = [
      {
        content: 'THUMBS_UP',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 2,
          nodes: [{ login: 'user1' }, { login: 'user2' }]
        }
      }
    ];

    const threads: ProcessedThread[] = [
      {
        thread_id: 'thread1',
        path: 'test.ts',
        line: 10,
        isResolved: false,
        isOutdated: false,
        status: 'active',
        comments: [
          {
            id: 'comment1',
            body: 'Test comment',
            author: 'testuser',
            isBot: false,
            url: 'https://github.com/test',
            createdAt: '2026-02-05T10:00:00Z',
            reactionGroups
          }
        ]
      }
    ];

    const output = formatOutput({
      prMeta: {
        number: 1,
        title: 'Test PR',
        state: 'OPEN',
        author: 'author',
        isDraft: false,
        mergeable: 'MERGEABLE',
        files: [],
        totalAdditions: 0,
        totalDeletions: 0
      },
      statePath: '/tmp/state.json',
      processedThreads: threads,
      botSummaries: [],
      allThreads: [],
      filter: () => true
    });

    expect(output.threads).toBeDefined();
    expect(output.threads![0].comments[0].reactionGroups).toBeDefined();
    expect(output.threads![0].comments[0].reactionGroups![0].content).toBe('THUMBS_UP');
  });

  it('should handle comments without reactions', () => {
    const threads: ProcessedThread[] = [
      {
        thread_id: 'thread1',
        path: 'test.ts',
        line: 10,
        isResolved: false,
        isOutdated: false,
        status: 'active',
        comments: [
          {
            id: 'comment1',
            body: 'Test comment',
            author: 'testuser',
            isBot: false,
            url: 'https://github.com/test',
            createdAt: '2026-02-05T10:00:00Z'
          }
        ]
      }
    ];

    const output = formatOutput({
      prMeta: {
        number: 1,
        title: 'Test PR',
        state: 'OPEN',
        author: 'author',
        isDraft: false,
        mergeable: 'MERGEABLE',
        files: [],
        totalAdditions: 0,
        totalDeletions: 0
      },
      statePath: '/tmp/state.json',
      processedThreads: threads,
      botSummaries: [],
      allThreads: [],
      filter: () => true
    });

    expect(output.threads).toBeDefined();
    expect(output.threads![0].comments[0].reactionGroups).toBeUndefined();
  });
});
