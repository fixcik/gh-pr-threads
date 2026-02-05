# Improve Header and Footer Design

**Date:** 2026-02-05
**Status:** Approved
**Author:** User requirements with Claude design

## Overview

Improve the visual appearance of PR output by enhancing the header and footer with emoji, double-line separators, and displaying file change statistics (additions/deletions) both in the PR summary and per-file basis.

## User Requirements

- Make header and footer more visually appealing ("модно-молодежно")
- Add line change statistics to the second line of header (additions in green, deletions in red/orange)
- Use emoji and modern styling

## Design Decisions

### 1. Visual Style

**Chosen:** Variant B - Double-line with emoji

```
═══════════════════════════════════════════════════════════════════
🔍 PR #2: feat(reactions): add support for fetch reactions...
📊 Status: OPEN | Author: fixcik | Files: 28 | +245 -120
═══════════════════════════════════════════════════════════════════
```

**Rationale:**
- Bright emoji attract attention
- Simpler to implement
- More casual and friendly style
- Works well in all terminal environments

### 2. Detail Level for Additions/Deletions

**Chosen:** Variant B - Both in PR header and per-file

```
═══════════════════════════════════════════════════════════════════
🔍 PR #2: feat(reactions): add support for fetch reactions...
📊 Status: OPEN | Author: fixcik | Files: 28 | +245 -120
═══════════════════════════════════════════════════════════════════

─────────────────────────────────────────────
📁 src/commands/react.ts (+45 -12)
─────────────────────────────────────────────
```

**Rationale:**
- Provides both overview and detailed breakdown
- Helps understand where major changes are
- More informative without being overwhelming

### 3. Color Scheme

**Chosen:** Variant B - Soft palette

- Additions: `greenBright` (light green)
- Deletions: `yellow` (orange-ish, less aggressive than red)

**Rationale:**
- Less contrasting, easier on the eyes
- Orange instead of red is less aggressive
- Better for long terminal sessions

## Implementation Plan

### Part 1: Data Structure Changes

**File:** `src/types.ts`

1. Add fields to `PRFile` interface:
   ```typescript
   additions: number;  // Lines added
   deletions: number;  // Lines deleted
   ```

2. Add fields to PR metadata object:
   ```typescript
   totalAdditions: number;  // Sum of all file additions
   totalDeletions: number;  // Sum of all file deletions
   ```

**Data Source:**
- GraphQL query already returns `additions` and `deletions` per file (see `src/github/queries.ts:42`)
- Need to add these fields to TypeScript interfaces
- Calculate totals when building metadata in `src/github/fetcher.ts` (`fetchPRData` function)

### Part 2: Output Formatting

**File:** `src/output/plainFormatter.ts`

#### 2.1 PR Header (lines ~668-670)

**Current:**
```typescript
const headerLine = `═══ PR #${prMeta.number}: ${prMeta.title} ═══`;
lines.push(colors.bold(headerLine));
lines.push(`Status: ${prMeta.state} | Author: ${prMeta.author} | Files: ${prMeta.files.length}`);
```

**New:**
```typescript
// Top separator line
const separator = '═'.repeat(terminalWidth);
lines.push(colors.dim(separator));

// Title with emoji
lines.push(`🔍 ${colors.bold(`PR #${prMeta.number}: ${prMeta.title}`)}`);

// Stats with colored additions/deletions
const additions = colors.greenBright(`+${prMeta.totalAdditions}`);
const deletions = colors.yellow(`-${prMeta.totalDeletions}`);
lines.push(`📊 Status: ${prMeta.state} | Author: ${prMeta.author} | Files: ${prMeta.files.length} | ${additions} ${deletions}`);

// Bottom separator line
lines.push(colors.dim(separator));
```

#### 2.2 File Header (lines ~691-694)

**Add additions/deletions to file path:**
```typescript
const fileStats = colors.dim(` (${colors.greenBright(`+${group.additions}`)} ${colors.yellow(`-${group.deletions}`)})`);
lines.push(`📁 ${colors.bold(group.path)}${fileStats}`);
```

#### 2.3 Footer (lines ~717-719)

**Apply same style as header:**
```typescript
const separator = '═'.repeat(terminalWidth);
lines.push(colors.dim(separator));
lines.push(`📊 ${colors.bold(`Summary: ${processedThreads.length} threads, ${nitpicksCount} nitpicks, ${unresolvedCount} unresolved`)}`);
lines.push(colors.dim(separator));
```

### Part 3: File Grouping

**File:** `src/output/plainFormatter.ts` (function `groupByFile`)

**Current return type:**
```typescript
{ path: string, items: Array<...> }
```

**New return type:**
```typescript
{
  path: string,
  additions: number,
  deletions: number,
  items: Array<...>
}
```

**Implementation:**
```typescript
// Create file map for quick lookup
const fileMap = new Map(prMeta.files.map(f => [f.path, f]));

// Add stats to each group
groups.forEach(group => {
  const file = fileMap.get(group.path);
  group.additions = file?.additions || 0;
  group.deletions = file?.deletions || 0;
});
```

**Note:** `groupByFile` function needs to accept `prMeta` as a parameter to access file data.

## Files to Modify

1. `src/types.ts` - Add `additions`/`deletions` fields to interfaces
2. `src/github/fetcher.ts` - Calculate and add total additions/deletions to metadata
3. `src/output/plainFormatter.ts` - Update formatting for header, footer, and file groups

## Testing Considerations

- Test with PRs of different sizes (small, medium, large)
- Test with PRs that have no changes (edge case)
- Verify color output in different terminal environments
- Check line wrapping behavior with long PR titles
- Test file groups with missing file data (general comments)

## Visual Examples

### Before:
```
═══ PR #2: feat(reactions): add support for fetch reactions for PR comments and react command for set reaction ═══
Status: OPEN | Author: fixcik | Files: 28

═══ Summary: 8 threads, 6 nitpicks, 8 unresolved ═══
```

### After:
```
═══════════════════════════════════════════════════════════════════
🔍 PR #2: feat(reactions): add support for fetch reactions for PR comments and react command for set reaction
📊 Status: OPEN | Author: fixcik | Files: 28 | +245 -120
═══════════════════════════════════════════════════════════════════

─────────────────────────────────────────────
📁 src/commands/react.ts (+45 -12)
─────────────────────────────────────────────

...

═══════════════════════════════════════════════════════════════════
📊 Summary: 8 threads, 6 nitpicks, 8 unresolved
═══════════════════════════════════════════════════════════════════
```

## Success Criteria

- ✅ Header displays full-width separator lines with emoji
- ✅ PR stats show total additions (greenBright) and deletions (yellow)
- ✅ Each file section shows its own additions/deletions
- ✅ Footer matches header styling with separator lines
- ✅ All existing functionality remains unchanged
- ✅ Tests pass
