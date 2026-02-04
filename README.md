# pr-comment-fetcher

CLI tool to fetch and filter GitHub Pull Request comments.

## Features

- 🔍 Fetch all review threads with comments
- 🤖 Parse nitpicks from CodeRabbit and other bots
- 👥 Filter user comments (exclude bots)
- 💾 Save comment processing state
- 🎯 Flexible filtering by data types
- 📊 Detailed PR statistics

## Installation

```bash
npx pr-comment-fetcher <PR_URL>
```

Or globally:

```bash
npm install -g pr-comment-fetcher
pr-comment-fetcher <PR_URL>
```

## Usage

### Basic Usage

```bash
# From PR URL
npx pr-comment-fetcher https://github.com/owner/repo/pull/123

# Auto-detect PR in current directory
cd your-repo
npx pr-comment-fetcher
```

### Options

```bash
# Show all threads (including resolved)
npx pr-comment-fetcher <PR_URL> --all

# Include threads/nitpicks marked as done/skip
npx pr-comment-fetcher <PR_URL> --include-done

# Get only specific data types
npx pr-comment-fetcher <PR_URL> --only=threads,nitpicks
npx pr-comment-fetcher <PR_URL> --only=userComments
npx pr-comment-fetcher <PR_URL> --only=summaries,files

# Combine options
npx pr-comment-fetcher <PR_URL> --all --include-done --only=threads
```

### Manual PR Specification

```bash
npx pr-comment-fetcher --owner=superprotocol --repo=sp-swarm-services --number=35
```

## Data Types (--only)

- `threads` - Review threads with comments
- `nitpicks` - Nitpicks from CodeRabbit
- `summaries` - Full summaries from bots
- `files` - List of changed files
- `userComments` - Only comments from real users

## Output Format

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
  "userComments": [...],
  "summary": {
    "totalThreads": 10,
    "filteredCount": 5,
    "unresolvedCount": 3,
    "botSummariesCount": 2,
    "nitpicksCount": 15,
    "userCommentsCount": 8,
    "userCommentsByAuthor": {
      "reviewer1": 5,
      "reviewer2": 3
    }
  }
}
```

## State

The tool saves processing state in:
```
~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json
```

This allows marking threads and nitpicks as completed and filtering them on subsequent runs.

## Requirements

- Node.js >= 18
- GitHub CLI (`gh`) installed and authenticated

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
pr-comment-fetcher --help

# To unlink
npm unlink -g pr-comment-fetcher
```

## License

MIT
