# GitHub Reactions Support Design

**Date:** 2026-02-05
**Status:** Approved
**Author:** Design brainstorming session

## Overview

Add support for fetching and displaying GitHub reactions on PR review comments, plus a new `react` command to add reactions via CLI.

## Requirements

1. **Fetch reactions** from review thread comments via GitHub GraphQL API
2. **Display reactions** in both plain text and JSON output formats
3. **Show reactor usernames** for each reaction type (detailed format)
4. **Support all 8 GitHub reaction types**: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀
5. **New `react` command** to add reactions to comments
6. **Support both short ID and interactive modes** (like existing `reply`/`resolve`/`mark` commands)
7. **Smart emoji display**: show emoji in terminals that support it, fallback to text names

## Architecture

### 1. Data Types (`src/types.ts`)

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

// Extend ThreadComment with reactions
export interface ThreadComment {
  id: string;
  body: string;
  author: { login: string; __typename: string };
  url: string;
  createdAt: string;
  path?: string;
  line?: number;
  reactionGroups?: ReactionGroup[];  // NEW FIELD
}
```

### 2. GraphQL Queries (`src/github/queries.ts`)

Extend `THREADS_QUERY` and `THREAD_COMMENTS_QUERY`:

```graphql
comments(first: 50) {
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

**Note:** Using `reactors` with union type `Reactor` (not `users`) because reactors can be Users, Bots, Organizations, or Mannequins.

### 3. Output Formatting (`src/output/formatter.ts`)

**Emoji mapping:**

```typescript
const REACTION_EMOJI: Record<string, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};
```

**Terminal emoji detection:**

```typescript
function supportsEmoji(): boolean {
  const term = process.env.TERM || '';
  const lang = process.env.LANG || '';

  return lang.toLowerCase().includes('utf-8') ||
         term.includes('256color') ||
         process.platform === 'darwin'; // macOS always supports
}
```

**Output formats:**

```
Plain text (with emoji support):
  👍 (3): @user1, @user2, @user3
  ❤️ (1): @user4

Plain text (without emoji):
  THUMBS_UP (3): @user1, @user2, @user3
  HEART (1): @user4

JSON:
  "reactionGroups": [
    {
      "content": "THUMBS_UP",
      "totalCount": 3,
      "users": ["user1", "user2", "user3"],
      "viewerHasReacted": false
    }
  ]
```

**Formatting function:**

```typescript
function formatReaction(content: string, useEmoji: boolean): string {
  return useEmoji ? REACTION_EMOJI[content] || content : content;
}

function formatReactionGroups(groups: ReactionGroup[], useEmoji: boolean): string {
  return groups
    .map(group => {
      const icon = formatReaction(group.content, useEmoji);
      const users = group.reactors.nodes.map(r => `@${r.login}`).join(', ');
      return `  ${icon} (${group.reactors.totalCount}): ${users}`;
    })
    .join('\n');
}
```

Reactions are displayed after comment body, before the next comment in the thread. If no reactions exist, the block is skipped.

### 4. React Command (`src/commands/react.ts`)

**Usage patterns:**

```bash
# By short ID
gh-pr-threads react <short_id> <reaction_type>
gh-pr-threads react abc123 👍
gh-pr-threads react abc123 THUMBS_UP

# Interactive mode
gh-pr-threads react
```

**Reaction validation:**

```typescript
const VALID_REACTIONS = [
  'THUMBS_UP', 'THUMBS_DOWN', 'LAUGH', 'HOORAY',
  'CONFUSED', 'HEART', 'ROCKET', 'EYES'
] as const;

const EMOJI_TO_REACTION: Record<string, string> = {
  '👍': 'THUMBS_UP',
  '👎': 'THUMBS_DOWN',
  '😄': 'LAUGH',
  '🎉': 'HOORAY',
  '😕': 'CONFUSED',
  '❤️': 'HEART',
  '🚀': 'ROCKET',
  '👀': 'EYES',
};

function normalizeReaction(input: string): string {
  const upper = input.toUpperCase();
  if (VALID_REACTIONS.includes(upper)) return upper;
  if (EMOJI_TO_REACTION[input]) return EMOJI_TO_REACTION[input];
  throw new Error(`Invalid reaction: ${input}`);
}
```

**GitHub API mutation:**

```typescript
async function addReaction(commentId: string, reaction: string): Promise<void> {
  await execCommand(`gh api graphql -f query='
    mutation {
      addReaction(input: {
        subjectId: "${commentId}",
        content: ${reaction}
      }) {
        reaction { id content }
      }
    }'
  `);
}
```

**Command implementation:**

```typescript
export async function reactCommand(id?: string, reaction?: string) {
  try {
    // 1. Interactive mode if no arguments
    if (!id || !reaction) {
      const result = await interactiveReact();
      id = result.id;
      reaction = result.reaction;
    }

    // 2. Validate and normalize reaction
    const normalizedReaction = normalizeReaction(reaction);

    // 3. Get command context (reuse from shared.ts)
    const context = await prepareCommandContext();

    // 4. Resolve short ID to GitHub comment ID
    const githubId = resolveShortId(id, context);
    if (!githubId) {
      throw new Error(`Comment with ID ${id} not found`);
    }

    // 5. Add reaction via GitHub API
    await addReaction(githubId, normalizedReaction);

    console.log(`✓ Added ${normalizedReaction} reaction to comment ${id}`);

  } catch (error) {
    if (error.message.includes('already reacted')) {
      console.error(`You have already reacted with this emoji`);
    } else if (error.message.includes('Not Found')) {
      console.error(`Comment not found or you don't have access`);
    } else {
      console.error(`Failed to add reaction: ${error.message}`);
    }
    process.exit(1);
  }
}
```

### 5. CLI Integration (`src/cli.ts`)

```typescript
program
  .command('react')
  .description('Add reaction to a comment')
  .argument('[id]', 'Short ID of the comment')
  .argument('[reaction]', 'Reaction type (THUMBS_UP, ❤️, etc.)')
  .action(async (id?: string, reaction?: string) => {
    const { reactCommand } = await import('./commands/react.js');
    await reactCommand(id, reaction);
  });
```

## Testing Strategy

### Unit Tests

**`src/parsers/reactions.test.ts`:**
- `formatReaction()` - converts THUMBS_UP to emoji
- `formatReactionGroups()` - formats reaction list output
- `normalizeReaction()` - validates and normalizes input
- `supportsEmoji()` - detects terminal emoji support

**`src/commands/react.test.ts`:**
- `reactCommand()` with valid short IDs
- `reactCommand()` with invalid reaction types
- `resolveShortId()` for comments with reactions
- API error handling (already reacted, not found)

### Integration Tests

- Fetch PR with reactions and verify output format
- Add reaction via CLI and verify it appears in next fetch
- Test emoji fallback in non-UTF8 terminals

## Backward Compatibility

- ✅ Reactions are optional (`reactionGroups?: ReactionGroup[]`)
- ✅ Old PRs without reactions work unchanged
- ✅ JSON output extended but preserves existing fields
- ✅ No breaking changes to existing commands

## Documentation Updates

### README.md

Add new command section:

```markdown
### Add reaction to comment
gh-pr-threads react <short_id> <reaction>
gh-pr-threads react abc123 👍
gh-pr-threads react abc123 THUMBS_UP

# Interactive mode
gh-pr-threads react

Supported reactions: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀
```

### CLAUDE.md

Update commands section:

```markdown
### react.ts
Adds GitHub reactions to review comments.
- Supports short ID and interactive selection
- Validates reaction types (8 GitHub reactions)
- Uses gh api graphql mutation addReaction
- Handles duplicate reaction errors
```

## Implementation Phases

### Phase 1: Data Fetching
1. Update TypeScript types in `src/types.ts`
2. Extend GraphQL queries in `src/github/queries.ts`
3. Test data fetching with real PRs

### Phase 2: Output Formatting
1. Add emoji mapping and detection logic
2. Implement `formatReactionGroups()` for plain text
3. Update JSON formatter
4. Add tests for formatting functions

### Phase 3: React Command
1. Implement `src/commands/react.ts`
2. Add CLI integration in `src/cli.ts`
3. Implement interactive mode
4. Add command tests

### Phase 4: Documentation & Polish
1. Update README.md
2. Update CLAUDE.md
3. Add integration tests
4. Test on different terminal types

## Open Questions

✅ All questions resolved during design phase

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Terminal emoji support varies | Auto-detect via env vars, fallback to text |
| Reactor list can be large (>100) | Fetch first 100, add pagination if needed |
| Already reacted error | Handle gracefully with clear message |
| Short ID collision with reactions | Reuse existing short ID system unchanged |

## Success Criteria

- ✅ Reactions display in both JSON and plain text output
- ✅ Emoji shown in supporting terminals, text fallback otherwise
- ✅ `react` command works with short ID
- ✅ `react` command works in interactive mode
- ✅ All 8 GitHub reaction types supported
- ✅ Test coverage >90% for new code
- ✅ No breaking changes to existing functionality
