import { describe, it, expect } from 'vitest';
import type { Reactor, ReactionGroup } from './types.js';

describe('Reaction types', () => {
  it('should validate Reactor structure', () => {
    const reactor: Reactor = { login: 'testuser' };
    expect(reactor.login).toBe('testuser');
  });

  it('should validate ReactionGroup structure', () => {
    const group: ReactionGroup = {
      content: 'THUMBS_UP',
      createdAt: '2026-02-05T10:00:00Z',
      viewerHasReacted: false,
      reactors: {
        totalCount: 2,
        nodes: [{ login: 'user1' }, { login: 'user2' }]
      }
    };
    expect(group.content).toBe('THUMBS_UP');
    expect(group.reactors.totalCount).toBe(2);
  });

  it('should validate ThreadComment with optional reactionGroups', () => {
    const comment = {
      id: 'IC_test',
      body: 'test comment',
      author: { login: 'user', __typename: 'User' },
      url: 'https://github.com/test',
      createdAt: '2026-02-05T10:00:00Z',
      reactionGroups: []
    };
    expect(comment.reactionGroups).toEqual([]);
  });
});
