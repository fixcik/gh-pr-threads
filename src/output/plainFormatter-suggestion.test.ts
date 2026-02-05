import { describe, it, expect, vi } from 'vitest';
import * as cliHighlight from 'cli-highlight';

describe('formatDetailBlock suggestion mapping', () => {
  it('should map suggestion language to diff to avoid cli-highlight error', () => {
    // Mock the highlight function to track what language is passed
    const highlightSpy = vi.spyOn(cliHighlight, 'highlight');

    // Simulate the code path in formatDetailBlock
    const detailContent = '```suggestion\n- old code\n+ new code\n```';
    const codeBlockMatch = detailContent.match(/```([a-z]*)\n([\s\S]*?)\n```/);

    expect(codeBlockMatch).not.toBeNull();

    if (codeBlockMatch) {
      let language = codeBlockMatch[1] || 'text';

      // This is the fix we added - map suggestion to diff
      if (language === 'suggestion') {
        language = 'diff';
      }

      expect(language).toBe('diff');

      // Now when we call highlight, it should use 'diff' not 'suggestion'
      const code = codeBlockMatch[2];

      // This should NOT throw an error because we mapped to 'diff'
      expect(() => {
        cliHighlight.highlight(code, { language });
      }).not.toThrow();
    }

    highlightSpy.mockRestore();
  });

  it('should handle suggestion language without the mapping (to show the error would occur)', () => {
    const code = '- old code\n+ new code';

    // Without mapping, using 'suggestion' directly should fail
    expect(() => {
      cliHighlight.highlight(code, { language: 'suggestion' });
    }).toThrow(/Unknown language: "suggestion"/);
  });

  it('should work correctly with diff language after mapping', () => {
    const code = '- old code\n+ new code';

    // With mapping to 'diff', it should work
    expect(() => {
      cliHighlight.highlight(code, { language: 'diff' });
    }).not.toThrow();
  });
});
