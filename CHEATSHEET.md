# gh-pr-threads - Cheat Sheet

## Installation and Setup

```bash
# After publishing
npx gh-pr-threads <PR_URL>

# Locally (right now)
~/projects/ai/gh-pr-threads/dist/index.js <PR_URL>

# Use npm link for global access
cd ~/projects/ai/gh-pr-threads
npm link
gh-pr-threads <PR_URL>
```

## Basic Commands

```bash
# Help
gh-pr-threads --help

# Version
gh-pr-threads --version

# Auto-detect PR (in git repo)
gh-pr-threads

# With specific URL
gh-pr-threads https://github.com/owner/repo/pull/123

# Clear state (reset done/skip marks)
gh-pr-threads clear

# Clear state for specific PR
gh-pr-threads clear https://github.com/owner/repo/pull/123
```

## Filters (--only)

```bash
--only=threads        # Review threads
--only=nitpicks       # CodeRabbit nitpicks
--only=summaries      # Bot summaries
--only=files          # Changed files
--only=userComments   # User comments only

# Combine multiple
--only=threads,nitpicks,files
```

## Options

```bash
--all              # Include resolved threads
--include-done     # Include done/skip statuses
```

## Common Scenarios

```bash
# 1. All unresolved comments
gh-pr-threads <URL> --only=threads

# 2. Only human comments (no bots)
gh-pr-threads <URL> --only=userComments

# 3. All CodeRabbit nitpicks
gh-pr-threads <URL> --only=nitpicks

# 4. Full information
gh-pr-threads <URL>

# 5. Including processed items
gh-pr-threads <URL> --include-done
```

## Processing with jq

```bash
# Summary only
gh-pr-threads <URL> | jq '.summary'

# Comment counts by author
gh-pr-threads <URL> --only=userComments | jq '.summary.userCommentsByAuthor'

# List unresolved files
gh-pr-threads <URL> --only=threads | \
  jq -r '.threads[] | select(.isResolved == false) | .path' | sort -u

# All nitpicks for a file
gh-pr-threads <URL> --only=nitpicks | \
  jq '.botSummaries[].nitpicks[] | select(.path == "src/index.ts")'
```

## State

File: `~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json`

```json
{
  "threads": {
    "thread-id": { "status": "done", "note": "Fixed" }
  },
  "nitpicks": {
    "file.ts:42": { "status": "skip", "note": "Won't fix" }
  }
}
```

Statuses: `done`, `skip`, or not present

## Development

```bash
# Install dependencies
npm install

# Dev mode
npm run dev -- <PR_URL> [options]

# Build
npm run build

# Verification
./verify.sh

# Publish
npm publish
```

## Project Files

```
README.md          - Full documentation
QUICKSTART.md      - Quick start guide
EXAMPLES.md        - Usage examples
CHEATSHEET.md      - This cheat sheet
PROJECT_SUMMARY.md - Implementation details
CHANGELOG.md       - Version history
CONTRIBUTING.md    - For contributors
```

## Tips

💡 Use `--only` for speed (fewer GraphQL requests)
💡 State is saved automatically
💡 `--include-done` shows already processed items
💡 jq is your friend for JSON processing
💡 Can run without arguments in git repo with PR
