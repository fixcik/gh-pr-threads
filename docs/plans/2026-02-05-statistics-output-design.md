# Statistics Output Enhancement Design

**Date:** 2026-02-05
**Status:** Approved

## Overview

Enhance the plain text output to show detailed statistics when there are no unresolved threads to review, helping users understand the overall state of PR reviews.

## Current Behavior

When `processedThreads.length === 0`, the tool outputs only the header and an empty summary:
```
═══ PR #1: feat: add mark/reply/resolve commands ═══
Status: OPEN | Author: fixcik | Files: 41

═══ Summary: 0 threads, 0 nitpicks, 0 unresolved ═══
```

## New Behavior

### Case 1: No threads found at all
```
═══ PR #1: feat: add mark/reply/resolve commands ═══
Status: OPEN | Author: fixcik | Files: 41

ℹ️  No threads found in this PR

═══ Summary: 0 threads, 0 nitpicks, 0 unresolved ═══
```

### Case 2: All threads resolved/skipped
```
═══ PR #1: feat: add mark/reply/resolve commands ═══
Status: OPEN | Author: fixcik | Files: 41

✓ No unresolved threads to review

Total: 15 threads (12 resolved, 3 skipped)
By author: Alice (8), Bob (5), Charlie (2)

═══ Summary: 0 threads, 0 nitpicks, 0 unresolved ═══
```

## Implementation Details

### Location
Changes only in `src/output/plainFormatter.ts` → `formatPlainOutput` function

### Algorithm

```typescript
if (processedThreads.length === 0) {
  if (allThreads.length === 0) {
    // Case 1: No threads at all
    lines.push('ℹ️  No threads found in this PR');
    lines.push('');
  } else {
    // Case 2: Threads exist but all processed
    const state = loadState(options.statePath);

    let resolvedCount = 0;
    let skippedCount = 0;
    const authorStats = new Map<string, number>();

    allThreads.forEach(thread => {
      // Count status
      const threadState = state.threads[thread.id];
      if (threadState?.status === 'done') resolvedCount++;
      if (threadState?.status === 'skip') skippedCount++;

      // Count by author (first comment in thread)
      const author = thread.comments.nodes[0]?.author?.login || 'unknown';
      authorStats.set(author, (authorStats.get(author) || 0) + 1);
    });

    // Format output
    lines.push('✓ No unresolved threads to review');
    lines.push('');
    lines.push(`Total: ${allThreads.length} threads (${resolvedCount} resolved, ${skippedCount} skipped)`);

    // Sort authors by count (descending)
    const sortedAuthors = Array.from(authorStats.entries())
      .sort((a, b) => b[1] - a[1]);

    const authorLine = sortedAuthors
      .map(([author, count]) => `${author} (${count})`)
      .join(', ');
    lines.push(`By author: ${authorLine}`);
    lines.push('');
  }
}
```

### Data Sources

- **Resolved/Skipped counts:** Read from `state.threads[threadId]?.status`
- **Author stats:** Extract from `thread.comments.nodes[0]?.author?.login`
- **Total threads:** Use `allThreads.length`

### Edge Cases

1. **Nitpicks without threads:** Statistics shown for threads, nitpicks displayed normally
2. **Unknown authors:** Use `'unknown'` when `author?.login` is missing
3. **Empty state:** `resolvedCount = 0, skippedCount = 0` for first run
4. **Filters (`--only`):** Statistics always computed from full `allThreads` list

## What Doesn't Change

- JSON output (`formatOutput`) remains unchanged
- File grouping logic untouched
- Individual thread/nitpick formatting unchanged
- Summary line format stays the same

## Testing

Manual testing scenarios:
1. PR with no threads at all
2. PR with all threads resolved
3. PR with mix of resolved/skipped
4. PR with threads from multiple authors
5. PR with only nitpicks (no review threads)
