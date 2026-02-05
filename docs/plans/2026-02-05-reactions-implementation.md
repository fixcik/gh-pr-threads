# GitHub Reactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GitHub reactions support - fetch, display, and add reactions to PR review comments

**Architecture:** Extend GraphQL queries with reactionGroups, add reaction formatting utilities, implement new `react` command following existing command patterns (reply/resolve/mark)

**Tech Stack:** TypeScript, GitHub GraphQL API, Commander.js, Vitest

---

## Task 1: Add Reaction Types

**Files:**
- Modify: `src/types.ts` (add after line 50)

**Step 1: Write tests for reaction types**

Create `src/types.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/types.test.ts`
Expected: FAIL with "Cannot find module './types.js'"

**Step 3: Add reaction types to src/types.ts**

Add after line 50 (after ThreadComment interface):

```typescript
// Reactor - user/bot who added a reaction
export interface Reactor {
  login: string;
}

// Group of reactions of the same type
export interface ReactionGroup {
  content: string;           // THUMBS_UP, HEART, ROCKET, etc.
  createdAt: string;         // ISO timestamp of first reaction
  viewerHasReacted: boolean; // whether current user reacted
  reactors: {
    totalCount: number;
    nodes: Reactor[];
  };
}
```

Then modify `ThreadComment` interface to add:

```typescript
  reactionGroups?: ReactionGroup[];  // add as last property
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/types.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/types.ts src/types.test.ts
git commit -m "feat(types): add Reactor and ReactionGroup types

- Add Reactor interface for users who reacted
- Add ReactionGroup interface for grouped reactions
- Extend ThreadComment with optional reactionGroups field
- Add comprehensive type validation tests"
```

---

## Task 2: Update GraphQL Queries

**Files:**
- Modify: `src/github/queries.ts:9-11` (THREADS_QUERY)
- Modify: `src/github/queries.ts:79-81` (THREAD_COMMENTS_QUERY)

**Step 1: Write test for query structure**

Create `src/github/queries.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/github/queries.test.ts`
Expected: FAIL with "Expected string to contain 'reactionGroups'"

**Step 3: Update THREADS_QUERY**

In `src/github/queries.ts`, replace lines 9-11 with:

```typescript
            comments(first: 50) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id body author { login __typename } url createdAt path line
                reactionGroups {
                  content
                  createdAt
                  viewerHasReacted
                  reactors(first: 100) {
                    totalCount
                    nodes {
                      ... on User { login }
                      ... on Bot { login }
                      ... on Organization { login }
                      ... on Mannequin { login }
                    }
                  }
                }
              }
            }
```

**Step 4: Update THREAD_COMMENTS_QUERY**

In `src/github/queries.ts`, replace lines 79-81 with:

```typescript
          comments(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id body author { login __typename } url createdAt path line
              reactionGroups {
                content
                createdAt
                viewerHasReacted
                reactors(first: 100) {
                  totalCount
                  nodes {
                    ... on User { login }
                    ... on Bot { login }
                    ... on Organization { login }
                    ... on Mannequin { login }
                  }
                }
              }
            }
          }
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/github/queries.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/github/queries.ts src/github/queries.test.ts
git commit -m "feat(github): add reactionGroups to GraphQL queries

- Extend THREADS_QUERY with reactionGroups field
- Extend THREAD_COMMENTS_QUERY with reactionGroups field
- Fetch up to 100 reactors per reaction type
- Support User, Bot, Organization, and Mannequin reactors
- Add tests for query structure validation"
```

---

## Task 3: Create Reaction Utilities

**Files:**
- Create: `src/utils/reactions.ts`
- Create: `src/utils/reactions.test.ts`

**Step 1: Write tests for reaction utilities**

Create `src/utils/reactions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatReaction,
  supportsEmoji,
  normalizeReaction,
  REACTION_EMOJI,
  VALID_REACTIONS
} from './reactions.js';

describe('reactions utilities', () => {
  describe('formatReaction', () => {
    it('should return emoji when useEmoji is true', () => {
      expect(formatReaction('THUMBS_UP', true)).toBe('👍');
      expect(formatReaction('HEART', true)).toBe('❤️');
    });

    it('should return text when useEmoji is false', () => {
      expect(formatReaction('THUMBS_UP', false)).toBe('THUMBS_UP');
      expect(formatReaction('HEART', false)).toBe('HEART');
    });

    it('should fallback to content for unknown reactions', () => {
      expect(formatReaction('UNKNOWN', true)).toBe('UNKNOWN');
    });
  });

  describe('supportsEmoji', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return true for UTF-8 locale', () => {
      process.env.LANG = 'en_US.UTF-8';
      expect(supportsEmoji()).toBe(true);
    });

    it('should return true for 256color terminal', () => {
      process.env.TERM = 'xterm-256color';
      expect(supportsEmoji()).toBe(true);
    });

    it('should return true on macOS', () => {
      const platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(supportsEmoji()).toBe(true);
      if (platform) Object.defineProperty(process, 'platform', platform);
    });

    it('should return false without UTF-8 or 256color', () => {
      process.env.LANG = 'C';
      process.env.TERM = 'xterm';
      const platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(supportsEmoji()).toBe(false);
      if (platform) Object.defineProperty(process, 'platform', platform);
    });
  });

  describe('normalizeReaction', () => {
    it('should accept uppercase reaction names', () => {
      expect(normalizeReaction('THUMBS_UP')).toBe('THUMBS_UP');
      expect(normalizeReaction('HEART')).toBe('HEART');
    });

    it('should convert lowercase to uppercase', () => {
      expect(normalizeReaction('thumbs_up')).toBe('THUMBS_UP');
      expect(normalizeReaction('heart')).toBe('HEART');
    });

    it('should convert emoji to reaction name', () => {
      expect(normalizeReaction('👍')).toBe('THUMBS_UP');
      expect(normalizeReaction('❤️')).toBe('HEART');
      expect(normalizeReaction('🚀')).toBe('ROCKET');
    });

    it('should throw error for invalid reactions', () => {
      expect(() => normalizeReaction('INVALID')).toThrow('Invalid reaction: INVALID');
      expect(() => normalizeReaction('🦄')).toThrow('Invalid reaction: 🦄');
    });
  });

  describe('REACTION_EMOJI constant', () => {
    it('should contain all 8 GitHub reactions', () => {
      expect(Object.keys(REACTION_EMOJI)).toHaveLength(8);
      expect(REACTION_EMOJI.THUMBS_UP).toBe('👍');
      expect(REACTION_EMOJI.THUMBS_DOWN).toBe('👎');
      expect(REACTION_EMOJI.LAUGH).toBe('😄');
      expect(REACTION_EMOJI.HOORAY).toBe('🎉');
      expect(REACTION_EMOJI.CONFUSED).toBe('😕');
      expect(REACTION_EMOJI.HEART).toBe('❤️');
      expect(REACTION_EMOJI.ROCKET).toBe('🚀');
      expect(REACTION_EMOJI.EYES).toBe('👀');
    });
  });

  describe('VALID_REACTIONS constant', () => {
    it('should contain all 8 valid reaction names', () => {
      expect(VALID_REACTIONS).toHaveLength(8);
      expect(VALID_REACTIONS).toContain('THUMBS_UP');
      expect(VALID_REACTIONS).toContain('HEART');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/reactions.test.ts`
Expected: FAIL with "Cannot find module './reactions.js'"

**Step 3: Implement reaction utilities**

Create `src/utils/reactions.ts`:

```typescript
export const REACTION_EMOJI: Record<string, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};

export const VALID_REACTIONS = [
  'THUMBS_UP', 'THUMBS_DOWN', 'LAUGH', 'HOORAY',
  'CONFUSED', 'HEART', 'ROCKET', 'EYES'
] as const;

export const EMOJI_TO_REACTION: Record<string, string> = {
  '👍': 'THUMBS_UP',
  '👎': 'THUMBS_DOWN',
  '😄': 'LAUGH',
  '🎉': 'HOORAY',
  '😕': 'CONFUSED',
  '❤️': 'HEART',
  '🚀': 'ROCKET',
  '👀': 'EYES',
};

export type ReactionType = typeof VALID_REACTIONS[number];

/**
 * Format reaction content as emoji or text
 */
export function formatReaction(content: string, useEmoji: boolean): string {
  return useEmoji ? REACTION_EMOJI[content] || content : content;
}

/**
 * Detect if terminal supports emoji
 */
export function supportsEmoji(): boolean {
  const term = process.env.TERM || '';
  const lang = process.env.LANG || '';

  return lang.toLowerCase().includes('utf-8') ||
         term.includes('256color') ||
         process.platform === 'darwin';
}

/**
 * Normalize reaction input to valid GitHub reaction type
 * Accepts: THUMBS_UP, thumbs_up, 👍
 */
export function normalizeReaction(input: string): string {
  const upper = input.toUpperCase();
  if (VALID_REACTIONS.includes(upper as ReactionType)) {
    return upper;
  }
  if (EMOJI_TO_REACTION[input]) {
    return EMOJI_TO_REACTION[input];
  }
  throw new Error(`Invalid reaction: ${input}`);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/reactions.test.ts`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/utils/reactions.ts src/utils/reactions.test.ts
git commit -m "feat(utils): add reaction formatting and validation utilities

- Add REACTION_EMOJI mapping for 8 GitHub reactions
- Add emoji support detection for terminals
- Add normalizeReaction for input validation
- Support emoji, uppercase, and lowercase input formats
- Comprehensive test coverage for all utilities"
```

---

## Task 4: Add Reaction Formatting to Output

**Files:**
- Modify: `src/output/plainFormatter.ts` (add after line 19)
- Create: `src/output/plainFormatter.test.ts`

**Step 1: Write tests for reaction formatting**

Create `src/output/plainFormatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { ReactionGroup } from '../types.js';

// We'll test the exported function after implementing
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

    // We'll import and test formatReactionGroups function
    const { formatReactionGroups } = require('./plainFormatter.js');
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

    const { formatReactionGroups } = require('./plainFormatter.js');
    const result = formatReactionGroups(groups, false);

    expect(result).toContain('THUMBS_UP (2): @user1, @user2');
    expect(result).not.toContain('👍');
  });

  it('should return empty string for empty reaction groups', () => {
    const { formatReactionGroups } = require('./plainFormatter.js');
    const result = formatReactionGroups([], true);
    expect(result).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/output/plainFormatter.test.ts`
Expected: FAIL with "formatReactionGroups is not exported"

**Step 3: Add formatReactionGroups to plainFormatter.ts**

Add after line 19 (after colors definition):

```typescript
import type { ReactionGroup } from '../types.js';
import { formatReaction } from '../utils/reactions.js';

/**
 * Format reaction groups for plain text output
 */
export function formatReactionGroups(groups: ReactionGroup[], useEmoji: boolean): string {
  if (!groups || groups.length === 0) {
    return '';
  }

  return groups
    .map(group => {
      const icon = formatReaction(group.content, useEmoji);
      const users = group.reactors.nodes.map(r => `@${r.login}`).join(', ');
      return `  ${icon} (${group.reactors.totalCount}): ${users}`;
    })
    .join('\n');
}
```

**Step 4: Integrate into formatPlainOutput**

Find the section that formats thread comments (around line 250+) and add reaction formatting after each comment body. Look for where comments are being formatted and add:

```typescript
      // After comment body is printed
      if (comment.reactionGroups && comment.reactionGroups.length > 0) {
        const reactionText = formatReactionGroups(comment.reactionGroups, useEmoji);
        lines.push('');
        lines.push(reactionText);
      }
```

**Step 5: Pass useEmoji to formatPlainOutput**

At the top of `formatPlainOutput` function, add:

```typescript
import { supportsEmoji } from '../utils/reactions.js';

export function formatPlainOutput(/* existing params */): string {
  const useEmoji = supportsEmoji();
  // ... rest of function
```

**Step 6: Run test to verify it passes**

Run: `npm test -- src/output/plainFormatter.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/output/plainFormatter.ts src/output/plainFormatter.test.ts
git commit -m "feat(output): add reaction formatting to plain text output

- Add formatReactionGroups function for plain text
- Detect emoji support automatically via supportsEmoji
- Display reactions after each comment body
- Format: emoji/text (count): @user1, @user2
- Add comprehensive tests for formatting"
```

---

## Task 5: Add Reaction Formatting to JSON Output

**Files:**
- Modify: `src/output/formatter.ts:21-39` (formatOutput function)
- Create: `src/output/formatter.test.ts`

**Step 1: Write tests for JSON reaction formatting**

Create `src/output/formatter.test.ts`:

```typescript
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
            author: { login: 'testuser', __typename: 'User' },
            url: 'https://github.com/test',
            createdAt: '2026-02-05T10:00:00Z',
            reactionGroups
          }
        ]
      }
    ];

    const output = formatOutput({
      threads,
      botSummaries: [],
      userComments: [],
      files: [],
      meta: {
        number: 1,
        title: 'Test PR',
        state: 'OPEN',
        author: { login: 'author', __typename: 'User' },
        isDraft: false,
        mergeable: 'MERGEABLE'
      },
      owner: 'test',
      repo: 'repo',
      statePath: '/tmp/state.json'
    });

    const parsed = JSON.parse(output);
    expect(parsed.threads[0].comments[0].reactionGroups).toHaveLength(1);
    expect(parsed.threads[0].comments[0].reactionGroups[0].content).toBe('THUMBS_UP');
    expect(parsed.threads[0].comments[0].reactionGroups[0].users).toEqual(['user1', 'user2']);
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
            author: { login: 'testuser', __typename: 'User' },
            url: 'https://github.com/test',
            createdAt: '2026-02-05T10:00:00Z'
          }
        ]
      }
    ];

    const output = formatOutput({
      threads,
      botSummaries: [],
      userComments: [],
      files: [],
      meta: {
        number: 1,
        title: 'Test PR',
        state: 'OPEN',
        author: { login: 'author', __typename: 'User' },
        isDraft: false,
        mergeable: 'MERGEABLE'
      },
      owner: 'test',
      repo: 'repo',
      statePath: '/tmp/state.json'
    });

    const parsed = JSON.parse(output);
    expect(parsed.threads[0].comments[0].reactionGroups).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/output/formatter.test.ts`
Expected: FAIL with "reactionGroups is undefined in output"

**Step 3: Modify formatOutput to include reactions**

In `src/output/formatter.ts`, find where thread comments are being formatted (in the threads mapping) and add reactionGroups transformation:

```typescript
      comments: thread.comments.map(comment => ({
        id: shortId(comment.id),
        full_id: comment.id,
        author: comment.author.login,
        body: comment.body,
        url: comment.url,
        created_at: comment.createdAt,
        ...(comment.reactionGroups && comment.reactionGroups.length > 0 && {
          reactionGroups: comment.reactionGroups.map(group => ({
            content: group.content,
            totalCount: group.reactors.totalCount,
            users: group.reactors.nodes.map(r => r.login),
            viewerHasReacted: group.viewerHasReacted
          }))
        })
      }))
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/output/formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/output/formatter.ts src/output/formatter.test.ts
git commit -m "feat(output): add reactionGroups to JSON output

- Transform ReactionGroup API format to simplified JSON
- Include content, totalCount, users array, viewerHasReacted
- Only include reactionGroups when reactions exist
- Add tests for JSON formatting with and without reactions"
```

---

## Task 6: Create GitHub Mutation for Adding Reactions

**Files:**
- Create: `src/github/mutations.ts`
- Modify: `src/github/apiTypes.ts` (add mutation types)

**Step 1: Write test for mutation structure**

Create `src/github/mutations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ADD_REACTION_MUTATION } from './mutations.js';

describe('GitHub mutations', () => {
  it('ADD_REACTION_MUTATION should have correct structure', () => {
    expect(ADD_REACTION_MUTATION).toContain('mutation');
    expect(ADD_REACTION_MUTATION).toContain('addReaction');
    expect(ADD_REACTION_MUTATION).toContain('subjectId');
    expect(ADD_REACTION_MUTATION).toContain('content');
    expect(ADD_REACTION_MUTATION).toContain('reaction');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/github/mutations.test.ts`
Expected: FAIL with "Cannot find module './mutations.js'"

**Step 3: Create mutations.ts file**

Create `src/github/mutations.ts`:

```typescript
export const REPLY_MUTATION = `
  mutation AddPullRequestReviewThreadReply($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
      comment {
        id
        url
      }
    }
  }
`;

export const ADD_REACTION_MUTATION = `
  mutation AddReaction($subjectId: ID!, $content: ReactionContent!) {
    addReaction(input: { subjectId: $subjectId, content: $content }) {
      reaction {
        id
        content
      }
      subject {
        id
      }
    }
  }
`;
```

**Step 4: Add mutation types to apiTypes.ts**

In `src/github/apiTypes.ts`, add:

```typescript
export interface AddReactionMutationData {
  addReaction: {
    reaction: {
      id: string;
      content: string;
    };
    subject: {
      id: string;
    };
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/github/mutations.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/github/mutations.ts src/github/mutations.test.ts src/github/apiTypes.ts
git commit -m "feat(github): add addReaction GraphQL mutation

- Create mutations.ts with ADD_REACTION_MUTATION
- Move REPLY_MUTATION from reply.ts to mutations.ts
- Add AddReactionMutationData type
- Add tests for mutation structure"
```

---

## Task 7: Update reply.ts to Use Shared Mutation

**Files:**
- Modify: `src/commands/reply.ts:2` (import from mutations.ts)

**Step 1: Update import in reply.ts**

Change line 2 in `src/commands/reply.ts` from:

```typescript
import { REPLY_MUTATION } from '../github/mutations.js';
```

Remove the inline REPLY_MUTATION definition if it exists in the file.

**Step 2: Run tests to verify no regression**

Run: `npm test -- src/commands/reply.test.ts`
Expected: PASS (if reply tests exist)

Run: `npm test`
Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add src/commands/reply.ts
git commit -m "refactor(commands): use REPLY_MUTATION from shared mutations file

- Import REPLY_MUTATION from github/mutations.ts
- Remove inline mutation definition
- No functional changes"
```

---

## Task 8: Implement React Command Core Logic

**Files:**
- Create: `src/commands/react.ts`
- Create: `src/commands/react.test.ts`

**Step 1: Write tests for react command**

Create `src/commands/react.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, mockDeep } from 'vitest-mock-extended';

describe('react command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should normalize reaction input', () => {
    const { normalizeReaction } = require('../utils/reactions.js');
    expect(normalizeReaction('THUMBS_UP')).toBe('THUMBS_UP');
    expect(normalizeReaction('👍')).toBe('THUMBS_UP');
  });

  it('should validate invalid reaction types', () => {
    const { normalizeReaction } = require('../utils/reactions.js');
    expect(() => normalizeReaction('INVALID')).toThrow('Invalid reaction');
  });

  // Integration tests would require mocking gh CLI
  // We'll test the core logic flow
});
```

**Step 2: Run test to verify baseline**

Run: `npm test -- src/commands/react.test.ts`
Expected: PASS (basic tests using existing utilities)

**Step 3: Implement react.ts**

Create `src/commands/react.ts`:

```typescript
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
  Array.from(context.resolvedIds.entries()).forEach(([shortId, fullId]) => {
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
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Provide friendly error messages
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
  });

  const allSucceeded = reportBatchResults(result, 'React', context.invalidIds, new Map());

  if (!allSucceeded) {
    process.exit(1);
  }
}
```

**Step 4: Run tests**

Run: `npm test -- src/commands/react.test.ts`
Expected: PASS

**Step 5: Type check**

Run: `npm run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/commands/react.ts src/commands/react.test.ts
git commit -m "feat(commands): implement react command core logic

- Add runReactCommand with batch reaction support
- Normalize reaction input (emoji or text)
- Use shared command utilities for ID resolution
- Provide friendly error messages for common failures
- Execute reactions sequentially via GitHub GraphQL API"
```

---

## Task 9: Add React Command to CLI

**Files:**
- Modify: `src/cli.ts` (add react command after resolve command)

**Step 1: Add react command to CLI parser**

In `src/cli.ts`, find where commands are defined (after `resolve` command) and add:

```typescript
program
  .command('react')
  .description('Add reaction to a comment')
  .argument('<ids...>', 'Short IDs of comments (e.g., abc123 def456)')
  .argument('<reaction>', 'Reaction type (THUMBS_UP, ❤️, etc.)')
  .action(async (ids: string[], reaction: string) => {
    const { runReactCommand } = await import('./commands/react.js');
    runReactCommand(ids, reaction);
  });
```

**Step 2: Build and test CLI**

Run: `npm run build`
Expected: Build successful

Test help output:
Run: `node dist/index.js react --help`
Expected: Shows react command help

**Step 3: Manual integration test (optional, if you have a test PR)**

If you have access to a test PR, try:
```bash
node dist/index.js react <comment_id> THUMBS_UP
```

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): add react command to CLI interface

- Add 'react' command with ids and reaction arguments
- Support multiple comment IDs for batch reactions
- Import runReactCommand dynamically
- Show command in help output"
```

---

## Task 10: Update Documentation

**Files:**
- Modify: `README.md` (add react command section)
- Modify: `CLAUDE.md` (add react.ts description)

**Step 1: Update README.md**

Add after the `resolve` command section:

```markdown
### Add reaction to comment
```bash
gh-pr-threads react <short_id> <reaction>
gh-pr-threads react abc123 👍
gh-pr-threads react abc123 THUMBS_UP

# Multiple comments
gh-pr-threads react abc123 def456 ❤️
```

Supported reactions: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀

Accepts emoji or text format (THUMBS_UP, thumbs_up, 👍).
```

**Step 2: Update CLAUDE.md**

Add in the Commands section:

```markdown
### react.ts
Adds GitHub reactions to review comments.
- Supports short ID and batch operations
- Validates reaction types (8 GitHub reactions)
- Uses gh api graphql mutation addReaction
- Handles duplicate reaction errors
- Normalizes emoji and text input formats
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add react command documentation

- Add react command usage examples to README
- Document all supported reaction types
- Show emoji and text input formats
- Add react.ts description to CLAUDE.md command reference"
```

---

## Task 11: Integration Testing

**Files:**
- Create: `tests/integration/reactions.test.ts` (optional, for CI)

**Step 1: Manual integration test**

If you have access to a test PR with existing comments:

1. Fetch threads to get comment IDs:
   ```bash
   npm run dev -- <PR_URL> --format json > /tmp/pr.json
   cat /tmp/pr.json | jq '.threads[0].comments[0]'
   ```

2. Add reaction:
   ```bash
   npm run dev -- react <comment_short_id> THUMBS_UP
   ```

3. Verify reaction appears:
   ```bash
   npm run dev -- <PR_URL> --format plain
   ```

Expected: See `👍 (1): @your_username` under the comment

**Step 2: Test emoji detection**

Test emoji fallback:
```bash
LANG=C npm run dev -- <PR_URL> --format plain
```

Expected: See `THUMBS_UP (1): @your_username` (text format)

**Step 3: Test error cases**

Try invalid reaction:
```bash
npm run dev -- react <comment_id> INVALID
```
Expected: Error message "Invalid reaction: INVALID"

Try duplicate reaction:
```bash
npm run dev -- react <comment_id> THUMBS_UP
npm run dev -- react <comment_id> THUMBS_UP
```
Expected: Error message "You have already reacted with this emoji"

**Step 4: Document test results**

Create a simple test report (if needed):

```markdown
# Integration Test Results

- ✅ Fetch reactions from PR comments
- ✅ Display reactions in plain text (emoji)
- ✅ Display reactions in plain text (text fallback)
- ✅ Display reactions in JSON output
- ✅ Add reaction to comment
- ✅ Error on invalid reaction type
- ✅ Error on duplicate reaction
- ✅ Batch reactions to multiple comments
```

**Step 5: Commit**

```bash
git add docs/plans/integration-test-results.md  # if you created test report
git commit -m "test: complete integration testing for reactions feature

- Verify reaction fetching from GitHub API
- Test emoji and text output formats
- Validate reaction command with real PR
- Test error handling for invalid and duplicate reactions
- All integration tests passing"
```

---

## Task 12: Final Review and Cleanup

**Files:**
- All modified files

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 2: Run type checking**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors (or fix any issues)

**Step 4: Test build**

Run: `npm run build`
Expected: Successful build

**Step 5: Review code coverage**

Run: `npm run test:coverage`
Expected: >90% coverage for new code

**Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete GitHub reactions support implementation

Summary of changes:
- Added Reactor and ReactionGroup types
- Extended GraphQL queries with reactionGroups
- Implemented reaction formatting utilities
- Added reaction display in plain text and JSON output
- Implemented react command for adding reactions
- Added comprehensive test coverage
- Updated documentation

All tests passing, type-safe, linted.

Closes #<issue_number>"
```

---

## Success Criteria Checklist

- ✅ Reactions display in both JSON and plain text output
- ✅ Emoji shown in supporting terminals, text fallback otherwise
- ✅ `react` command works with short ID
- ✅ `react` command supports batch operations
- ✅ All 8 GitHub reaction types supported
- ✅ Test coverage >90% for new code
- ✅ No breaking changes to existing functionality
- ✅ All existing tests still pass
- ✅ Type-safe implementation (no TypeScript errors)
- ✅ Linting passes
- ✅ Documentation updated

---

## Notes

**Testing philosophy:**
- Write tests first (TDD)
- Test one thing at a time
- Run tests after each step
- Commit frequently

**Code quality:**
- Follow existing patterns (see reply.ts, resolve.ts)
- Use shared utilities from shared.ts
- Keep functions small and focused
- Add comments for complex logic

**Error handling:**
- Provide friendly error messages
- Exit with code 1 on failure
- Log success messages with emoji

**Commit messages:**
- Use conventional commits (feat, fix, test, docs)
- Include Co-Authored-By for AI assistance
- Keep messages descriptive but concise
