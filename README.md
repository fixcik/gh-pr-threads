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

### Working from Git Worktrees

All batch commands (`mark`, `reply`, `resolve`, `react`) support `--pr` option for explicit PR specification. This is useful when working from git worktrees or directories where auto-detection doesn't work:

```bash
# Specify PR explicitly with --pr
gh-pr-threads resolve abc123 --pr https://github.com/owner/repo/pull/123
gh-pr-threads mark done abc123 --pr https://github.com/owner/repo/pull/123
gh-pr-threads reply "Fixed" abc123 --pr https://github.com/owner/repo/pull/123
gh-pr-threads react 👍 abc123 --pr https://github.com/owner/repo/pull/123

# Or use --owner/--repo/--number
gh-pr-threads resolve abc123 --owner owner --repo repo --number 123
```

If `--pr` is not provided, the tool auto-detects the PR from the current git repository.

### Mark Command

Mark threads or nitpicks with a status:

```bash
# Mark single item
gh-pr-threads mark done abc123
gh-pr-threads mark skip abc123

# Mark multiple items (batch)
gh-pr-threads mark done abc123 def456 ghi789
gh-pr-threads mark skip abc123 def456 --note "Out of scope"

# Clear mark
gh-pr-threads mark clear abc123
```

Available statuses:
- `done` - Mark as completed
- `skip` - Mark to skip (won't appear in default output)
- `later` - Mark to address later
- `clear` - Remove any existing mark

### Reply Command

Reply to review threads:

```bash
# Reply to single thread
gh-pr-threads reply "Your reply message" abc123

# Reply to multiple threads with same message (batch)
gh-pr-threads reply "Acknowledged, will fix in follow-up PR" abc123 def456

# Reply and mark as done
gh-pr-threads reply "Fixed" abc123 --mark done
```

**Note:** Reply only works with review threads, not nitpicks.

### Resolve Command

Resolve review threads on GitHub:

```bash
# Resolve single thread
gh-pr-threads resolve abc123

# Resolve multiple threads (batch)
gh-pr-threads resolve abc123 def456 ghi789

# Resolve with reply
gh-pr-threads resolve abc123 --reply "Fixed in commit xyz"

# Resolve multiple with same reply
gh-pr-threads resolve abc123 def456 --reply "Addressed in refactoring"

# Resolve, reply, and mark
gh-pr-threads resolve abc123 --reply "Done" --mark done
```

**Note:** Resolve only works with review threads, not nitpicks.

### React Command

Add reactions to review comments:

```bash
# Add reaction to single comment
gh-pr-threads react THUMBS_UP abc123
gh-pr-threads react 👍 abc123

# Add reaction to multiple comments (batch)
gh-pr-threads react ❤️ abc123 def456 ghi789

# All supported reactions
gh-pr-threads react THUMBS_UP abc123    # 👍
gh-pr-threads react THUMBS_DOWN abc123  # 👎
gh-pr-threads react LAUGH abc123        # 😄
gh-pr-threads react HOORAY abc123       # 🎉
gh-pr-threads react CONFUSED abc123     # 😕
gh-pr-threads react HEART abc123        # ❤️
gh-pr-threads react ROCKET abc123       # 🚀
gh-pr-threads react EYES abc123         # 👀
```

Supported reaction formats:
- Uppercase names: `THUMBS_UP`, `HEART`, `ROCKET`
- Lowercase names: `thumbs_up`, `heart`, `rocket`
- Emoji: `👍`, `❤️`, `🚀`

**Note:** Reactions work with any review comment ID.

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

### CodeRabbit Nitpicks Extraction

The tool automatically extracts nitpicks from CodeRabbit bot comments by parsing structured HTML `<details>` blocks:

**How it works:**
1. Searches for `<details>` blocks with summary matching "Nitpick comments" or "Additional comments"
2. Within these blocks, finds nested `<details>` blocks for each file (e.g., `src/file.ts (5)`)
3. Extracts individual nitpicks formatted as `` `10-15`: Fix this issue``
4. Generates unique IDs based on file path and line number for state tracking

**Example CodeRabbit comment structure:**
```html
<details>
  <summary>Nitpick comments (10)</summary>
  <details>
    <summary>src/index.ts (3)</summary>
    <blockquote>
      `45-47`: Consider using const instead of let
      `89`: Add JSDoc comment
      `120-125`: Extract this logic into a helper function
    </blockquote>
  </details>
</details>
```

**Access nitpicks:**
```bash
# Get all CodeRabbit nitpicks
gh-pr-threads <PR_URL> --only=nitpicks

# Exclude nitpicks already marked as done
gh-pr-threads <PR_URL> --only=nitpicks

# Include processed nitpicks
gh-pr-threads <PR_URL> --only=nitpicks --include-done
```

Each nitpick includes:
- **path**: File path (e.g., `src/index.ts`)
- **line**: Line number or range (e.g., `45` or `45-47`)
- **content**: Nitpick description
- **id**: Unique identifier for state tracking
- **status**: Current processing status (if marked)

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
