# gh-pr-threads

CLI tool to fetch and filter GitHub Pull Request review threads, comments, and nitpicks.

## Features

- 🔍 Fetch all review threads with comments
- 🤖 Parse nitpicks from CodeRabbit and other bots
- 👥 Filter user comments (exclude bots)
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
# Show only unresolved items (default)
npx gh-pr-threads <PR_URL> --only=userComments

# Include resolved threads/comments
npx gh-pr-threads <PR_URL> --only=userComments --with-resolved

# Show all threads (including resolved review threads)
npx gh-pr-threads <PR_URL> --all

# Include threads/nitpicks marked as done/skip
npx gh-pr-threads <PR_URL> --include-done

# Get only specific data types
npx gh-pr-threads <PR_URL> --only=threads,nitpicks
npx gh-pr-threads <PR_URL> --only=summaries,files

# Combine options
npx gh-pr-threads <PR_URL> --all --include-done --with-resolved --only=threads,userComments
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

- `threads` - Review threads with comments
- `nitpicks` - Nitpicks from CodeRabbit
- `summaries` - Full summaries from bots
- `files` - List of changed files
- `userComments` - Only comments from real users

### Resolved Status

- **Default**: Only unresolved items are returned
- `--with-resolved` - Include resolved threads and comments
- `--all` - Show all review threads (resolved and unresolved)
- `--include-done` - Include items marked as done or skip in state

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
