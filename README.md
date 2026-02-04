# gh-pr-threads

[![CI](https://github.com/fixcik/gh-pr-threads/actions/workflows/ci.yml/badge.svg)](https://github.com/fixcik/gh-pr-threads/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/gh-pr-threads.svg)](https://www.npmjs.com/package/gh-pr-threads)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI tool to fetch and filter GitHub Pull Request review threads, comments, and nitpicks.

## Features

- 🔍 Fetch all review threads with comments (from all users)
- 🤖 Parse nitpicks from CodeRabbit and other bots
- 🚫 Optional bot filtering with `--ignore-bots`
- 💾 Save comment processing state
- 🎯 Flexible filtering by data types
- 📊 Detailed PR statistics

## Prerequisites

Before using `gh-pr-threads`, ensure you have:

1. **GitHub CLI (`gh`)** installed and authenticated:
   ```bash
   # Install gh (macOS with Homebrew)
   brew install gh
   
   # Or download from https://github.com/cli/cli#installation
   
   # Authenticate with GitHub
   gh auth login
   
   # Verify authentication
   gh auth status
   ```

2. **Node.js >= 18**

## Installation

```bash
npx gh-pr-threads <PR_URL>
```

Or globally:

```bash
npm install -g gh-pr-threads
gh-pr-threads <PR_URL>
```

## Usage

### Basic Usage

```bash
# From PR URL
npx gh-pr-threads https://github.com/owner/repo/pull/123

# Auto-detect PR in current directory
cd your-repo
npx gh-pr-threads
```

### Options

```bash
# Show only threads (default shows everything)
npx gh-pr-threads <PR_URL> --only=threads

# Include resolved threads/comments
npx gh-pr-threads <PR_URL> --only=threads --with-resolved

# Show all threads (including resolved review threads)
npx gh-pr-threads <PR_URL> --all

# Include threads/nitpicks marked as done/skip
npx gh-pr-threads <PR_URL> --include-done

# Get only specific data types
npx gh-pr-threads <PR_URL> --only=threads,nitpicks
npx gh-pr-threads <PR_URL> --only=summaries,files

# Exclude all bot comments and summaries
npx gh-pr-threads <PR_URL> --ignore-bots

# Combine options
npx gh-pr-threads <PR_URL> --all --include-done --with-resolved --only=threads --ignore-bots
```

### Manual PR Specification

```bash
npx gh-pr-threads --owner=owner --repo=repo-name --number=123
```

### Clear Command

Clear all marked items (done/skip) from state:

```bash
# Clear state for current PR
gh-pr-threads clear

# Clear state for specific PR URL
gh-pr-threads clear https://github.com/owner/repo/pull/123

# Clear state with manual specification
gh-pr-threads clear --owner=owner --repo=repo-name --number=123
```

This removes the state file, allowing you to restart review processing from scratch.

## Filtering Options

### Data Types (--only)

- `threads` - Review threads with all comments (from users and bots)
- `nitpicks` - Nitpicks extracted from CodeRabbit comments
- `summaries` - Full summaries from bots (CodeRabbit, GitHub Actions, etc.)
- `files` - List of changed files in PR

**Note:** To see only user comments without bots, use `--only=threads --ignore-bots`

### Bot Filtering

- `--ignore-bots` - Exclude all bot comments, summaries, and nitpicks from output
- Detects bots by:
  - GitHub GraphQL API `__typename: "Bot"` field (most reliable)
  - Known bot usernames: `coderabbitai`, `github-actions`, `sonarqubecloud`, `dependabot`, `renovate`, `greenkeeper`

### Resolved Status

- **Default**: Only unresolved items are returned
- `--with-resolved` - Include resolved threads and comments
- `--all` - Show all review threads (resolved and unresolved)
- `--include-done` - Include items marked as done or skip in state

## Output Format

### JSON Format (--json)

```json
{
  "pr": {
    "number": 123,
    "title": "Fix bug",
    "state": "OPEN",
    "author": "username",
    "isDraft": false,
    "mergeable": "MERGEABLE",
    "files": [...]
  },
  "statePath": "/Users/user/.cursor/reviews/owner-repo-123/pr-state.json",
  "threads": [...],
  "botSummaries": [...],
  "summary": {
    "totalThreads": 10,
    "filteredCount": 5,
    "unresolvedCount": 3,
    "botSummariesCount": 2,
    "nitpicksCount": 15
  }
}
```

### Plain Text Format (default)

Grouped by file with syntax highlighting, thread IDs, and clickable URLs.

## State

The tool saves processing state in:
```
~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json
```

This allows marking threads and nitpicks as completed and filtering them on subsequent runs.

## Requirements

- **Node.js >= 18**
- **GitHub CLI (`gh`)** - See Prerequisites section above for installation and authentication

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with hot-reload
npm run dev -- <PR_URL>

# Run built version
node dist/index.js <PR_URL>
```

### Quality Assurance

The project includes automated quality checks:

```bash
# Run all checks (typecheck, lint, tests)
npm run check

# Individual checks
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint code quality
npm run lint:fix         # Auto-fix linting issues
npm test                 # Run tests
npm run test:coverage    # Test coverage report
```

### Git Hooks

Pre-commit hooks automatically run before each commit:
- **ESLint** with auto-fix on staged TypeScript files
- **TypeScript** type checking on the entire project

Hooks are automatically installed on `npm install` via the `prepare` script.

#### Skip Hooks (when needed)

```bash
# Skip pre-commit hook for a specific commit
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "message"

# Or use --no-verify flag
git commit --no-verify -m "message"
```

### Continuous Integration

GitHub Actions automatically run on every pull request and push to master:
- **Tests** on Node.js 18.x, 20.x, 22.x
- **Type checking** with TypeScript
- **Linting** with ESLint
- **Build** verification
- **Coverage** reporting (PR only)

See workflow status: [CI Badge](https://github.com/fixcik/gh-pr-threads/actions/workflows/ci.yml)

## Publishing

### Prepare for Publishing

1. Update version in `package.json`:
```bash
npm version patch  # or minor, major
```

2. Build the project:
```bash
npm run build
```

3. Publish to npm:
```bash
npm publish
```

### Local Testing Before Publishing

```bash
# In project directory
npm link

# Command is now available globally
gh-pr-threads --help

# To unlink
npm unlink -g gh-pr-threads
```

## License

MIT
