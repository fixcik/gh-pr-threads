import { describe, it, expect } from 'vitest';
import { getNitpickId, findBalancedDetails, parseNitpicks } from './nitpicks.js';

describe('getNitpickId', () => {
  it('should create file:line ID when valid file path and line are provided', () => {
    const result = getNitpickId('src/index.ts', '42', 'some content');

    expect(result).toBe('src/index.ts:42');
  });

  // Test cases where hash-based ID should be created
  it.each([
    { filePath: 'unknown', line: '42', reason: 'file path is "unknown"' },
    { filePath: '', line: '42', reason: 'file path is empty' },
    { filePath: 'src/index.ts', line: '', reason: 'line is empty' },
    { filePath: 'comments/test.ts', line: '42', reason: 'file path contains "comments"' },
    { filePath: 'COMMENTS/test.ts', line: '42', reason: 'file path contains "COMMENTS"' }
  ])('should create hash-based ID when $reason', ({ filePath, line }) => {
    const result = getNitpickId(filePath, line, 'test content');

    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[a-f0-9]{8}$/);
  });

  it('should be deterministic - same content produces same hash', () => {
    const content = 'consistent content';
    const result1 = getNitpickId('unknown', '1', content);
    const result2 = getNitpickId('unknown', '1', content);

    expect(result1).toBe(result2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = getNitpickId('unknown', '1', 'content 1');
    const hash2 = getNitpickId('unknown', '1', 'content 2');

    expect(hash1).not.toBe(hash2);
  });
});

describe('findBalancedDetails', () => {
  it('should find single details block without filter', () => {
    const body = '<details><summary>Test</summary>Content</details>';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(1);
    expect(result[0].full).toBe('<details><summary>Test</summary>Content</details>');
    expect(result[0].summary).toBe('Test');
    expect(result[0].content).toBe('Content');
  });

  it('should find multiple details blocks', () => {
    const body = '<details><summary>First</summary>Content1</details><details><summary>Second</summary>Content2</details>';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(2);
    expect(result[0].summary).toBe('First');
    expect(result[1].summary).toBe('Second');
  });

  it('should handle nested details blocks', () => {
    const body = '<details><summary>Outer</summary>Before<details><summary>Inner</summary>Nested</details>After</details>';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('Outer');
    expect(result[0].content).toContain('Before');
    expect(result[0].content).toContain('Inner');
    expect(result[0].content).toContain('After');
  });

  it('should filter by summary regex', () => {
    const body = '<details><summary>Nitpick comments</summary>Content1</details><details><summary>Other</summary>Content2</details>';
    const result = findBalancedDetails(body, /Nitpick/);

    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('Nitpick comments');
  });

  it('should return empty array when no details blocks found', () => {
    const body = 'Just plain text without details';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(0);
  });

  it('should handle details blocks with attributes', () => {
    const body = '<details open class="test"><summary>Test</summary>Content</details>';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('Test');
  });

  it('should handle unmatched details tag (malformed HTML)', () => {
    const body = '<details><summary>Test</summary>Content without closing tag';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(0);
  });

  it('should extract content between summary and closing tag', () => {
    const body = '<details><summary>Title</summary>\n  Line 1\n  Line 2\n</details>';
    const result = findBalancedDetails(body);

    expect(result[0].content.trim()).toBe('Line 1\n  Line 2');
  });

  it('should handle empty content', () => {
    const body = '<details><summary>Empty</summary></details>';
    const result = findBalancedDetails(body);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('');
  });
});

describe('parseNitpicks', () => {
  it('should parse nitpicks from CodeRabbit format', () => {
    const body = `
<details><summary>Nitpick comments (2)</summary>
<details><summary>src/index.ts (2)</summary>
<blockquote>

\`10\`: Consider using const instead of let

\`20\`: Add error handling here

</blockquote>
</details>
</details>
    `;

    const result = parseNitpicks(body);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'src/index.ts:10',
      path: 'src/index.ts',
      line: '10',
      content: 'Consider using const instead of let'
    });
    expect(result[1]).toEqual({
      id: 'src/index.ts:20',
      path: 'src/index.ts',
      line: '20',
      content: 'Add error handling here'
    });
  });

  it('should parse nitpicks with line ranges', () => {
    const body = `
<details><summary>Additional comments (1)</summary>
<details><summary>src/test.ts (1)</summary>
<blockquote>

\`15-20\`: Refactor this function to reduce complexity

</blockquote>
</details>
</details>
    `;

    const result = parseNitpicks(body);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'src/test.ts:15-20',
      path: 'src/test.ts',
      line: '15-20',
      content: 'Refactor this function to reduce complexity'
    });
  });

  it('should return empty array when no nitpicks found', () => {
    const body = '<details><summary>Regular comment</summary>No nitpicks here</details>';
    const result = parseNitpicks(body);

    expect(result).toHaveLength(0);
  });

  it('should parse multiple files with nitpicks', () => {
    const body = `
<details><summary>Nitpick comments (3)</summary>
<details><summary>src/file1.ts (1)</summary>
<blockquote>
\`5\`: Fix this
</blockquote>
</details>
<details><summary>src/file2.ts (2)</summary>
<blockquote>
\`10\`: First issue
\`20\`: Second issue
</blockquote>
</details>
</details>
    `;

    const result = parseNitpicks(body);

    expect(result).toHaveLength(3);
    expect(result[0].path).toBe('src/file1.ts');
    expect(result[1].path).toBe('src/file2.ts');
    expect(result[2].path).toBe('src/file2.ts');
  });

  it('should handle multiline nitpick content', () => {
    const body = `
<details><summary>Nitpick comments (1)</summary>
<details><summary>src/test.ts (1)</summary>
<blockquote>

\`10\`: This is a long comment
that spans multiple lines
with detailed explanation

</blockquote>
</details>
</details>
    `;

    const result = parseNitpicks(body);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('This is a long comment');
    expect(result[0].content).toContain('multiple lines');
  });

  it('should skip malformed file blocks without proper summary format', () => {
    const body = `
<details><summary>Nitpick comments (1)</summary>
<details><summary>Invalid format without line count</summary>
<blockquote>
\`10\`: This should be skipped
</blockquote>
</details>
</details>
    `;

    const result = parseNitpicks(body);

    expect(result).toHaveLength(0);
  });

  it('should handle "Additional comments" section', () => {
    const body = `
<details><summary>Additional comments (1)</summary>
<details><summary>src/test.ts (1)</summary>
<blockquote>
\`5\`: Additional comment
</blockquote>
</details>
</details>
    `;

    const result = parseNitpicks(body);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Additional comment');
  });
});
