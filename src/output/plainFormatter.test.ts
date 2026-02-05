import { describe, it, expect } from 'vitest';
import type { ReactionGroup } from '../types.js';
import { formatReactionGroups } from './plainFormatter.js';

describe('plainFormatter reactions', () => {
  it('should format reaction groups with emoji', () => {
    const groups: ReactionGroup[] = [
      {
        content: 'THUMBS_UP',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 3,
          nodes: [
            { login: 'user1' },
            { login: 'user2' },
            { login: 'user3' }
          ]
        }
      },
      {
        content: 'HEART',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: true,
        reactors: {
          totalCount: 1,
          nodes: [{ login: 'user4' }]
        }
      }
    ];

    const result = formatReactionGroups(groups, true);

    expect(result).toContain('👍 (3): @user1, @user2, @user3');
    expect(result).toContain('❤️ (1): @user4');
  });

  it('should format reaction groups without emoji', () => {
    const groups: ReactionGroup[] = [
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

    const result = formatReactionGroups(groups, false);

    expect(result).toContain('THUMBS_UP (2): @user1, @user2');
    expect(result).not.toContain('👍');
  });

  it('should return empty string for empty reaction groups', () => {
    const result = formatReactionGroups([], true);
    expect(result).toBe('');
  });
});
