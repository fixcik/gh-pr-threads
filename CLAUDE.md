# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`gh-pr-threads` is a CLI tool and SDK library that fetches and filters GitHub Pull Request review threads, comments, and nitpicks using the GitHub CLI (`gh`). It extracts review threads, bot summaries (especially CodeRabbit nitpicks), and user comments, maintaining a persistent state for tracking which items have been addressed.

## Development Commands

### Building & Running
```bash
# Build the project (compiles TypeScript to dist/)
npm run build

# Development mode with hot-reload
npm run dev -- <PR_URL>

# Run the built version
node dist/index.js <PR_URL>

# Test the CLI locally (link globally)
npm link
gh-pr-threads --help
npm unlink -g gh-pr-threads  # to unlink
```

### Debugging & Performance Testing

The project uses the `debug` library for logging and performance profiling:

```bash
# Enable all debug logs
DEBUG=gh-pr-threads npm run dev -- <PR_URL>

# Enable only timing logs
DEBUG=gh-pr-threads:timing npm run dev -- <PR_URL>

# Enable fetcher logs
DEBUG=gh-pr-threads:fetcher npm run dev -- <PR_URL>

# Combine multiple namespaces
DEBUG=gh-pr-threads:* npm run dev -- <PR_URL>

# Test the built binary with logs
DEBUG=gh-pr-threads npx gh-pr-threads <PR_URL>
```

Timing logs show:
- API fetch times for each page
- Processing time for threads, comments, and bot summaries
- Total execution time

### Testing

The project uses Vitest for unit testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- src/utils/shortId.test.ts
```

**Test Coverage Status:**
- **src/parsers**: 98.3% (nitpicks, comments parsing)
- **src/state**: 100% (state management, persistence)
- **src/utils**: High coverage (shortId, PR detection)
- **src/output**: 100% (formatter)

Tests are co-located with source files using the `.test.ts` suffix. The project uses `vitest-mock-extended` for type-safe mocking.

## Code Standards

### Language & Comments
- **All code comments MUST be in English only**
- Variable names, function names, and type names use English
- Error messages and user-facing text use English
- Documentation (README, CLAUDE.md) is in English

### Code Quality Tools
```bash
# Run archlint to check architectural quality
npx @archlinter/cli scan

# Check TypeScript compilation
npm run typecheck

# Run linter
npm run lint
npm run lint:fix

# Run all checks
npm run check  # typecheck + lint + test
```

**Archlint Configuration:**
- Configured in `.archlint.yaml`
- Current quality score: **8.8/10** (Good)
- Ignores test files and generated code
- Enforces: no dead code, no cyclic dependencies, low coupling, manageable complexity

### Best Practices
- Use options objects for functions with 4+ parameters
- Break down functions with high cognitive complexity (>20) into helpers
- Extract duplicated code into shared utilities
- Keep function cyclomatic complexity below 30
- Write tests for all new features and bug fixes

## Architecture

### Data Flow
1. **CLI parsing** (`src/cli.ts`): Parses arguments, auto-detects PR from `gh pr view` if URL not provided
   - Uses shared `parsePRInfo` utility to eliminate code duplication
2. **GitHub API** (`src/github/`):
   - `client.ts`: Wraps `gh api graphql` calls
   - `queries.ts`: GraphQL query definitions for threads, files, reviews, comments, metadata
   - `fetcher.ts`: Pagination logic with options pattern (`FetchPagesOptions` interface)
3. **Parsing** (`src/parsers/`):
   - `nitpicks.ts`: Extracts CodeRabbit nitpick items from bot comments
     - `findBalancedDetails`: Parses nested HTML `<details>` tags (refactored into smaller functions)
     - `findBalancedDetailsEnd`: Handles nested tag balancing
     - `extractDetailsBlock`: Extracts summary and content
   - `comments.ts`: Cleans comment bodies (strips HTML, etc.)
4. **State management** (`src/state/manager.ts`): Loads/saves PR processing state
5. **Output** (`src/output/`):
   - `formatter.ts`: Builds JSON output (uses `FormatOutputOptions` interface)
   - `plainFormatter.ts`: Formats plain text output with syntax highlighting
     - `formatSuggestionBlock`: Handles code suggestions
     - `formatMainContent`: Processes diff blocks and markdown
     - `formatDetailBlock`: Formats HTML details as quotes
6. **Commands** (`src/commands/`):
   - `reply.ts`, `resolve.ts`, `mark.ts`: Thread management commands
   - `shared.ts`: Common utilities for command context and validation
7. **Main** (`src/index.ts`): Orchestrates the entire flow with parallel API fetching

### Key Design Decisions

- **State Persistence**: The tool stores which threads/nitpicks have been marked as `done` or `skip` in a local JSON file, allowing incremental review workflows
- **GraphQL Pagination**: All PR data is fetched via GitHub GraphQL API with cursor-based pagination to handle large PRs
- **Bot Detection**: Hardcoded list of bot usernames (`coderabbitai`, `github-actions`, `sonarqubecloud`, `dependabot`) for filtering
- **Filtering Modes**: `--only` option allows selecting specific data types (`threads`, `nitpicks`, `files`, `summaries`, `userComments`)
- **Options Pattern**: Functions with many parameters use options objects for better readability and maintainability
- **Shared Utilities**: Common logic extracted into `src/utils/pr.ts` and `src/commands/shared.ts` to eliminate duplication
- **Function Decomposition**: Complex functions broken down into smaller, focused helpers for better cognitive complexity

### Architecture Quality

The project maintains high architectural standards with **8.8/10 quality score** from archlint:
- ✅ No code duplication
- ✅ No dead code or unused symbols
- ✅ No cyclic dependencies
- ✅ Low coupling between modules
- ✅ Options pattern for complex function signatures
- ✅ Helper functions for complex logic decomposition

### Type System

**Core Types (`src/types.ts`):**
- **State**: Persistent storage schema for threads/nitpicks status
- **Thread**: Review thread with comments from GitHub API
- **PRData**: Full GraphQL response shape
- **ProcessedThread**: Cleaned thread with status from state
- **BotSummary**: Bot comment with optional nitpicks array
- **UserComment**: Comment from non-bot user with thread context
- **Output**: Final JSON output structure
- **Nitpick**: Extracted nitpick item from bot comments

**Options Interfaces:**
- **`FetchPagesOptions<T>`** (`src/github/fetcher.ts`): Parameters for GraphQL pagination
- **`FormatOutputOptions`** (`src/output/formatter.ts`): Parameters for JSON output formatting
- **`FormatPlainOutputOptions`** (`src/output/plainFormatter.ts`): Parameters for plain text formatting

**Utility Types:**
- **`PRInfo`** (`src/utils/pr.ts`): Owner, repo, and PR number tuple
- **`CommandContext`** (`src/commands/shared.ts`): Shared context for command execution
- **`DetailsBlock`** (`src/parsers/nitpicks.ts`): Parsed HTML `<details>` block structure

## GitHub CLI Dependency

The tool requires `gh` CLI to be installed and authenticated:
```bash
gh auth status  # check authentication
```

All API calls are made via `gh api graphql` with a 10MB buffer limit for large PR responses.

## State File Location

State is stored at: `~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json`

This path is hardcoded in `src/state/manager.ts:6` using `.cursor` directory (originally designed for Cursor IDE integration, but works independently).

## Publishing

The package is published to npm under the name `gh-pr-threads`. Use the following process for manual publishing:

### Publish a New Version

```bash
# 1. Make sure all changes are committed
git status

# 2. Update version in package.json (automatically commits & creates tag)
npm version patch    # for bug fixes (0.1.0 -> 0.1.1)
npm version minor    # for new features (0.1.0 -> 0.2.0)
npm version major    # for breaking changes (0.1.0 -> 1.0.0)

# 3. Build the project
npm run build

# 4. Publish to npm
npm publish

# 5. Push version tag and commits to GitHub
git push origin master
git push origin --tags
```

### Before Publishing Checklist

- [ ] All code changes are committed to `master`
- [ ] README.md is up-to-date
- [ ] CHANGELOG.md documents the changes
- [ ] Version number in package.json is updated with `npm version`
- [ ] Built successfully with `npm run build`
- [ ] Tested locally with `npm link` and `gh-pr-threads --help`

### Check Published Package

```bash
# View package on npm
npm view gh-pr-threads

# Install and test the published version
npm install -g gh-pr-threads@latest
gh-pr-threads --help
```

The `prepublishOnly` script ensures the project is built before publishing.
