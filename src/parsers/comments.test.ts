import { describe, it, expect } from 'vitest';
import { cleanCommentBody } from './comments.js';

describe('cleanCommentBody', () => {
  it('should remove Analysis chain details', () => {
    const body = `
Some content
<details><summary>🧩 Analysis chain</summary>
This should be removed
</details>
More content
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Analysis chain');
    expect(result).not.toContain('This should be removed');
    expect(result).toContain('Some content');
    expect(result).toContain('More content');
  });

  it('should remove AI Agents prompt details', () => {
    const body = `
Content
<details><summary>🤖 Prompt for AI Agents</summary>
AI prompt to remove
</details>
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Prompt for AI Agents');
    expect(result).not.toContain('AI prompt to remove');
  });

  it('should remove Learnings used details', () => {
    const body = `
Content
<details><summary>🧠 Learnings used</summary>
Learnt from: CR
Repo: fixcik/gh-pr-threads PR: 0
File: CLAUDE.md:0-0
Timestamp: 2026-02-05T15:29:38.773Z
Learning: Applies to CLAUDE.md : Document architecture decisions
</details>
More content
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Learnings used');
    expect(result).not.toContain('Learnt from');
    expect(result).toContain('Content');
    expect(result).toContain('More content');
  });

  it('should remove internal state comments', () => {
    const body = `
Before
<!-- internal state start -->
Internal data here
<!-- internal state end -->
After
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('internal state start');
    expect(result).not.toContain('Internal data here');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('should remove Share section', () => {
    const body = `
Content
<details><summary>❤️ Share</summary>
Share links
</details>
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Share');
    expect(result).not.toContain('Share links');
  });

  it('should remove Sequence Diagram section', () => {
    const body = `
## Sequence Diagram(s)
Diagram content here
## Other Section
Keep this
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Sequence Diagram(s)');
    expect(result).not.toContain('Diagram content here');
    expect(result).toContain('Other Section');
    expect(result).toContain('Keep this');
  });

  it('should remove Changes section', () => {
    const body = `
## Changes
List of changes
## Summary
Keep this
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('## Changes');
    expect(result).not.toContain('List of changes');
    expect(result).toContain('Summary');
  });

  it('should remove Poem section', () => {
    const body = `
## Poem
Roses are red
## Next Section
Keep this
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Poem');
    expect(result).not.toContain('Roses are red');
    expect(result).toContain('Next Section');
  });

  it('should remove Estimated code review effort section', () => {
    const body = `
## Estimated code review effort
5 minutes
## Other
Keep this
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Estimated code review effort');
    expect(result).not.toContain('5 minutes');
    expect(result).toContain('Other');
  });

  it('should remove Recent review details', () => {
    const body = `
<details><summary>📜 Recent review details</summary>
Recent details
</details>
<details><summary>Additional comments</summary>
Keep this
</details>
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Recent review details');
    expect(result).not.toContain('Recent details');
  });

  it('should remove Tip sections', () => {
    const body = `
Content
<sub>✏️ Tip: Some tip here</sub>
More content
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Tip:');
    expect(result).not.toContain('Some tip here');
    expect(result).toContain('Content');
    expect(result).toContain('More content');
  });

  it('should remove CodeRabbit attribution', () => {
    const body = `
Real content
Thanks for using [CodeRabbit](https://coderabbit.ai)
More attribution text
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('Thanks for using');
    expect(result).not.toContain('CodeRabbit');
    expect(result).toContain('Real content');
  });

  it('should remove HTML comments', () => {
    const body = `
Visible content
<!-- This is a comment -->
More visible content
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toContain('<!--');
    expect(result).not.toContain('This is a comment');
    expect(result).toContain('Visible content');
    expect(result).toContain('More visible content');
  });

  it('should collapse multiple newlines to double newlines', () => {
    const body = `
Line 1


Line 2



Line 3
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain('Line 1\n\nLine 2\n\nLine 3');
  });

  it('should preserve Nitpick comments section', () => {
    const body = `
Regular content
<details><summary>Nitpick comments (2)</summary>
Important nitpicks
</details>
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).toContain('Nitpick comments');
    expect(result).toContain('Important nitpicks');
  });

  it('should preserve Additional comments section', () => {
    const body = `
Regular content
<details><summary>Additional comments (1)</summary>
Important comments
</details>
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).toContain('Additional comments');
    expect(result).toContain('Important comments');
  });

  it('should append preserved sections if removed from main content', () => {
    const body = `
Some regular content
<details><summary>🧩 Analysis chain</summary>
Analysis content
</details>
<details><summary>Nitpick comments (1)</summary>
Preserved nitpicks
</details>
    `.trim();

    const result = cleanCommentBody(body);

    // The nitpick comments should still be present (preserved)
    expect(result).toContain('Nitpick comments');
    expect(result).toContain('Preserved nitpicks');
    // Analysis chain should be removed
    expect(result).not.toContain('Analysis chain');
    expect(result).not.toContain('Analysis content');
  });

  it('should truncate content longer than 15000 characters', () => {
    const longContent = 'a'.repeat(20000);
    const result = cleanCommentBody(longContent);

    expect(result.length).toBeLessThan(20000);
    expect(result).toContain('[TRUNCATED]');
  });

  it('should trim whitespace from result', () => {
    const body = `


    Content here    


    `;

    const result = cleanCommentBody(body);

    expect(result).toBe('Content here');
  });

  it('should handle empty input', () => {
    const result = cleanCommentBody('');

    expect(result).toBe('');
  });

  it('should handle input with only removable content', () => {
    const body = `
<details><summary>🧩 Analysis chain</summary>
Remove this
</details>
<!-- Comment -->
Thanks for using [CodeRabbit](https://coderabbit.ai)
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).toBe('');
  });

  it('should remove multiple sections in one pass', () => {
    const body = `
## Real Content

<details><summary>🧩 Analysis chain</summary>
Remove
</details>

## Changes
Remove this too

<sub>✏️ Tip: Remove tip</sub>

## Keep This Section

<!-- Remove comment -->

Thanks for using [CodeRabbit](https://coderabbit.ai)
    `.trim();

    const result = cleanCommentBody(body);

    expect(result).toContain('Real Content');
    expect(result).toContain('Keep This Section');
    expect(result).not.toContain('Analysis chain');
    expect(result).not.toContain('Changes');
    expect(result).not.toContain('Tip:');
    expect(result).not.toContain('CodeRabbit');
  });
});
