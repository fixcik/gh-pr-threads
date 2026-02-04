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

### No Tests or Linting
This project currently has no test suite or linter configured. Manual testing is done via `npm run dev` or the built binary.

## Architecture

### Data Flow
1. **CLI parsing** (`src/cli.ts`): Parses arguments, auto-detects PR from `gh pr view` if URL not provided
2. **GitHub API** (`src/github/`):
   - `client.ts`: Wraps `gh api graphql` calls
   - `queries.ts`: GraphQL query definitions for threads, files, reviews, comments, metadata
   - `fetcher.ts`: Pagination logic (`fetchAllPages`, `fetchAllThreadComments`)
3. **Parsing** (`src/parsers/`):
   - `nitpicks.ts`: Extracts CodeRabbit nitpick items from bot comments
   - `comments.ts`: Cleans comment bodies (strips HTML, etc.)
4. **State management** (`src/state/manager.ts`): Loads/saves PR processing state to `~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json`
5. **Output** (`src/output/formatter.ts`): Builds final JSON output with summary statistics
6. **Main** (`src/index.ts`): Orchestrates the entire flow

### Key Design Decisions

- **State Persistence**: The tool stores which threads/nitpicks have been marked as `done` or `skip` in a local JSON file, allowing incremental review workflows
- **GraphQL Pagination**: All PR data is fetched via GitHub GraphQL API with cursor-based pagination to handle large PRs
- **Bot Detection**: Hardcoded list of bot usernames (`coderabbitai`, `github-actions`, `sonarqubecloud`, `dependabot`) for filtering
- **Filtering Modes**: `--only` option allows selecting specific data types (`threads`, `nitpicks`, `files`, `summaries`, `userComments`)

### Type System (`src/types.ts`)

- **State**: Persistent storage schema for threads/nitpicks status
- **Thread**: Review thread with comments from GitHub API
- **PRData**: Full GraphQL response shape
- **ProcessedThread**: Cleaned thread with status from state
- **BotSummary**: Bot comment with optional nitpicks array
- **UserComment**: Comment from non-bot user with thread context
- **Output**: Final JSON output structure

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
