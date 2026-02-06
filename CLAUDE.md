# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`gh-pr-threads` is a CLI tool for fetching and filtering review threads, comments, and nitpicks from GitHub Pull Requests. Uses GitHub CLI (`gh`) for authentication and GraphQL API for data retrieval.

## Development Commands

```bash
# Development with hot-reload
npm run dev -- <PR_URL>

# Build project
npm run build

# Run all quality checks (typecheck + lint + tests)
npm run check

# Individual checks
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm test                 # Run tests
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Coverage report

# Run built version
node dist/index.js <PR_URL>
```

### Testing

To test a specific test:
```bash
npm test -- src/path/to/file.test.ts
npm test -- -t "test name pattern"
```

## Architecture

### Entry Point Flow

1. **CLI Parsing** (`src/cli.ts`) - parses command-line arguments, supports subcommands (mark, reply, resolve, react, clear)
2. **Main Logic** (`src/index.ts`) - coordinates data fetching, filtering, and output
3. **Output** - formats result as plain text (with syntax highlighting) or JSON

### Core Components

#### Data Fetching Layer (`src/github/`)
- **client.ts** - GitHub API client via `gh` CLI
- **queries.ts** - GraphQL queries for fetching PR data, threads, comments
- **mutations.ts** - GraphQL mutations for reply, resolve, react
- **fetcher.ts** - high-level wrapper for pagination and caching

**Important:** Uses cursor-based pagination with state caching to optimize repeated requests.

#### Processing Layer (`src/core/`)
- **dataFetcher.ts** - coordinates fetching all PR data
- **threadProcessor.ts** - processes threads, applies statuses from state
- **threadFilter.ts** - filters threads by resolved/outdated status
- **nitpickFilter.ts** - filters nitpicks by status
- **botProcessor.ts** - processes bot summaries
- **botDetector.ts** - detects bots by `__typename: "Bot"` and known usernames
- **constants.ts** - global constants (bot list, statuses)

#### Parsing Layer (`src/parsers/`)
- **comments.ts** - parses bot comments
- **nitpicks.ts** - extracts nitpicks from CodeRabbit comments via HTML parsing of `<details>` blocks

**CodeRabbit nitpicks format:**
```html
<details>
  <summary>Nitpick comments (10)</summary>
  <details>
    <summary>src/file.ts (3)</summary>
    `45-47`: Description of the issue
  </details>
</details>
```

#### State Management (`src/state/`)
- **manager.ts** - manages PR state (marked threads/nitpicks, cursor cache)
- Stores data in `~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json`
- Supports cursor caching for pagination optimization

#### Output Layer (`src/output/`)
- **formatter.ts** - common formatting interface
- **plainFormatter.ts** - plain text output with:
  - Grouping by files
  - Syntax highlighting (cli-highlight)
  - File type icons (getFileIcon)
  - Status badges for threads (resolved/outdated)
  - Reaction groups with formatting

#### Commands (`src/commands/`)
Subcommands for working with threads:
- **mark.ts** - marks threads/nitpicks with statuses (done/skip/later/clear)
- **reply.ts** - replies to review threads
- **resolve.ts** - resolves threads on GitHub
- **react.ts** - adds reactions to comments
- **shared.ts** - common utilities: `PROptions` interface, `prepareBatchCommandContext()`, `prepareThreadCommandContext()`

All batch commands support `--pr <url>` and `--owner/--repo/--number` for explicit PR specification (useful when working from git worktrees).

#### Utilities (`src/utils/`)
- **pr.ts** - PR URL parsing and repository detection
- **shortId.ts** - short ID generation (6 characters) for threads/comments
- **reactions.ts** - reaction normalization (emoji ↔ GitHub format)
- **images.ts** - inline image handling in comments

### Types (`src/types.ts`)

Main data types:
- **Thread** - review thread with comments
- **ThreadComment** - individual comment in thread
- **Nitpick** - extracted nitpick from CodeRabbit
- **State** - saved state structure
- **Args** - CLI arguments
- **Output** - output data format

## Code Style

### Comments
- Don't write obvious code comments
- Comment only complex logic, non-obvious decisions, or business requirements
- Good code should be self-documenting through clear variable and function names

### Constants and Magic Numbers
- Extract magic numbers into constants
- Prefer creating a `constants.ts` file in the appropriate directory
- Constants should have descriptive names in UPPER_SNAKE_CASE
- Group related constants together

Example:
```typescript
// ❌ Bad
if (items.length > 100) {
  processInBatches(items, 50);
}

// ✅ Good
const MAX_ITEMS_THRESHOLD = 100;
const BATCH_SIZE = 50;

if (items.length > MAX_ITEMS_THRESHOLD) {
  processInBatches(items, BATCH_SIZE);
}
```

## Testing

- Uses Vitest with vitest-mock-extended for mocking
- Tests are located next to code: `file.ts` → `file.test.ts`
- Uses factory functions from `src/__fixtures__/factories.ts` for creating test data
- Check edge cases: empty arrays, null values, boundary conditions

## Git Hooks

Pre-commit hooks run automatically via simple-git-hooks:
- ESLint with auto-fix on staged TypeScript files
- TypeScript type checking on entire project

To skip hooks in exceptional cases:
```bash
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "message"
```

## Development Workflow

### Feature Development with Worktrees

For developing new features, use git worktrees:

```bash
# Use skill to create worktree
/using-git-worktrees
```

**Worktrees location:** `.worktrees/` (added to .gitignore)

**Worktrees advantages:**
- Isolation of work from current branch
- Ability to switch between tasks without stash
- Independent dependency installation for each feature
- Convenient testing in clean environment

Skill `/using-git-worktrees` automatically:
- Creates new branch from master/main
- Sets up worktree in `.worktrees/<branch-name>/`
- Installs dependencies
- Opens new terminal in worktree

### Planning Changes

When creating implementation plan, always check:

1. **Changes in API or CLI interface** - require README.md update:
   - New commands or arguments
   - Output format changes (JSON structure, plain text format)
   - New env variables or configuration
   - Behavior changes in existing options

2. **New functionality** - may require README.md update:
   - Usage examples
   - Description of new capabilities
   - Updates to Features or Use Cases sections

3. **Changes in requirements** - require README.md update:
   - Minimum Node.js version change
   - New dependencies or system requirements
   - Changes in installation process

**Rule:** Always include "Update README.md" task in plan if changes affect user experience or documentation.

## Key Design Patterns

### Short IDs
- All threads and comments have short ID (6 characters) for CLI convenience
- Generated from full GitHub ID via SHA-256 hash
- Mapping short ID → full ID stored in state.idMap

### Cursor Caching
- GraphQL cursor-based pagination is cached in state
- Default TTL: 60 minutes
- Optimizes repeated requests for large PRs
- Can be disabled via `--no-cache`

### Bot Detection
- Priority: GraphQL API field `__typename: "Bot"`
- Fallback: list of known bot usernames in `src/core/constants.ts`
- Used for filtering with `--ignore-bots`

### State Management
- State stored locally in `~/.cursor/reviews/`
- Contains: marked items, ID mappings, cursor cache
- Updated atomically via JSON.stringify + fs.writeFileSync
