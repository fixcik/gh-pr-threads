# gh-pr-threads Usage Examples

## Basic Examples

### 1. Get all unresolved threads
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --only=threads
```

### 2. Get only comments from real users
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --only=userComments
```

### 3. Get nitpicks from CodeRabbit
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --only=nitpicks
```

### 4. Get full summaries from bots
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --only=summaries
```

## Combinations

### Get threads and nitpicks
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --only=threads,nitpicks
```

### Show everything including resolved threads
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --all
```

### Include threads marked as done/skip
```bash
gh-pr-threads https://github.com/owner/repo/pull/123 --include-done
```

## Processing Output with jq

### Get only summary
```bash
gh-pr-threads <PR_URL> | jq '.summary'
```

### Get list of changed files
```bash
gh-pr-threads <PR_URL> --only=files | jq '.pr.files[] | {path, additions, deletions}'
```

### Get comment count by author
```bash
gh-pr-threads <PR_URL> --only=userComments | jq '.summary.userCommentsByAuthor'
```

### Get all unresolved threads with files
```bash
gh-pr-threads <PR_URL> --only=threads | jq '.threads[] | {path, line, status: .isResolved}'
```

### Get all nitpicks for a specific file
```bash
gh-pr-threads <PR_URL> --only=nitpicks | \
  jq '.botSummaries[].nitpicks[] | select(.path == "src/index.ts")'
```

## Clear State Command

### Clear all marks for a specific PR

```bash
# Clear state for current PR (auto-detect)
gh-pr-threads clear

# Clear state for specific PR URL
gh-pr-threads clear https://github.com/owner/repo/pull/123

# Clear state with manual PR specification
gh-pr-threads clear --owner=fixcik --repo=gh-pr-threads --number=123
```

This removes the state file completely, allowing you to reset all `done` and `skip` marks. Next time you run the tool, all items will be shown as unprocessed.

## Working with State

After the first run, a state file is created:
```
~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json
```

You can manually edit it to mark threads/nitpicks as processed:

```json
{
  "pr": "https://github.com/owner/repo/pull/123",
  "updatedAt": "2024-01-15T10:30:00Z",
  "threads": {
    "PRRT_kwDOK...": { "status": "done", "note": "Fixed in commit abc123" },
    "PRRT_kwDOK...": { "status": "skip", "note": "Won't fix - by design" }
  },
  "nitpicks": {
    "src/index.ts:42": { "status": "done" },
    "abc12345": { "status": "skip" }
  }
}
```

Then use `--include-done` to see processed items or omit it to hide them.

## Script Integration

### Script to check for unresolved comments
```bash
#!/bin/bash
PR_URL="$1"
UNRESOLVED=$(gh-pr-threads "$PR_URL" --only=threads | jq '.summary.unresolvedCount')

if [ "$UNRESOLVED" -gt 0 ]; then
  echo "❌ PR has $UNRESOLVED unresolved comments"
  exit 1
else
  echo "✅ All comments resolved"
fi
```

### Get list of files requiring attention
```bash
gh-pr-threads <PR_URL> --only=threads | \
  jq -r '.threads[] | select(.isResolved == false) | .path' | \
  sort -u
```

### Export comments to Markdown
```bash
gh-pr-threads <PR_URL> --only=userComments | \
  jq -r '.userComments[] | "## [\(.author)](\(.url))\n\n\(.body)\n\n---\n"'
```
