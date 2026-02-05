import { describe, it, expect } from 'vitest';
import type { ReactionGroup } from '../types.js';
import { formatReactionGroups } from './plainFormatter.js';

describe('plainFormatter reactions', () => {
  it('should format reaction groups with emoji and up to 3 users', () => {
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

    expect(result).toContain('👍 @user1, @user2, @user3');
    expect(result).toContain('❤️ @user4');
    expect(result).not.toContain('(3)');
    expect(result).not.toContain('(1)');
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

    expect(result).toContain('THUMBS_UP @user1, @user2');
    expect(result).not.toContain('👍');
    expect(result).not.toContain('(2)');
  });

  it('should show "and N more" for more than 3 users', () => {
    const groups: ReactionGroup[] = [
      {
        content: 'ROCKET',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 7,
          nodes: [
            { login: 'user1' },
            { login: 'user2' },
            { login: 'user3' },
            { login: 'user4' },
            { login: 'user5' },
            { login: 'user6' },
            { login: 'user7' }
          ]
        }
      }
    ];

    const result = formatReactionGroups(groups, true);

    expect(result).toContain('🚀 @user1, @user2, @user3 and 4 more');
    expect(result).not.toContain('@user4');
    expect(result).not.toContain('@user5');
  });

  it('should return empty string for empty reaction groups', () => {
    const result = formatReactionGroups([], true);
    expect(result).toBe('');
  });

  it('should respect custom indent parameter', () => {
    const groups: ReactionGroup[] = [
      {
        content: 'THUMBS_UP',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 1,
          nodes: [{ login: 'user1' }]
        }
      }
    ];

    const customIndent = '      '; // 6 spaces
    const result = formatReactionGroups(groups, true, customIndent);

    // Verify the custom indent is applied: indent (6 spaces) + 2 spaces + bar + 2 spaces
    expect(result).toMatch(/^ {8}│ {2}👍/); // 8 spaces total (6 + 2), then bar, then 2 spaces
    expect(result).toContain('@user1');
  });

  it('should filter out reactions with zero totalCount', () => {
    const groups: ReactionGroup[] = [
      {
        content: 'THUMBS_UP',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 0,
          nodes: []
        }
      },
      {
        content: 'HEART',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 2,
          nodes: [{ login: 'user1' }, { login: 'user2' }]
        }
      },
      {
        content: 'ROCKET',
        createdAt: '2026-02-05T10:00:00Z',
        viewerHasReacted: false,
        reactors: {
          totalCount: 0,
          nodes: []
        }
      }
    ];

    const result = formatReactionGroups(groups, true);

    expect(result).toContain('❤️ @user1, @user2');
    expect(result).not.toContain('👍');
    expect(result).not.toContain('🚀');
  });
});
