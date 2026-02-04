import { describe, it, expect } from 'vitest';
import { formatOutput } from './formatter.js';
import { buildProcessedThread, buildBotSummary, buildNitpick } from '../__fixtures__/factories.js';

describe('formatOutput', () => {
  const mockPrMeta = {
    number: 123,
    title: 'Test PR',
    state: 'OPEN',
    author: 'testuser',
    files: [],
    isDraft: false,
    mergeable: 'MERGEABLE'
  };

  const mockStatePath = '/path/to/state.json';

  const mockThread = buildProcessedThread();
  const mockBotSummary = buildBotSummary({
    nitpicks: [buildNitpick({ id: 'nit1', path: 'file.ts', line: '10', content: 'Fix this' })]
  });

  it('should create basic output structure', () => {
    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries: [],
      allThreads: [],
      filter: () => true
    });

    expect(result).toHaveProperty('pr');
    expect(result).toHaveProperty('statePath');
    expect(result).toHaveProperty('summary');
  });

  it('should include PR metadata', () => {
    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries: [],
      allThreads: [],
      filter: () => true
    });

    expect(result.pr).toEqual(mockPrMeta);
    expect(result.statePath).toBe(mockStatePath);
  });

  it('should calculate summary statistics correctly', () => {
    const allThreads = [
      { isResolved: false },
      { isResolved: true },
      { isResolved: false }
    ];

    const processedThreads = [mockThread];
    const botSummaries = [mockBotSummary];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads,
      botSummaries,
      allThreads,
      filter: () => true
    });

    expect(result.summary.totalThreads).toBe(3);
    expect(result.summary.filteredCount).toBe(1);
    expect(result.summary.unresolvedCount).toBe(2);
    expect(result.summary.botSummariesCount).toBe(1);
    expect(result.summary.nitpicksCount).toBe(1);
  });

  it('should count nitpicks across multiple bot summaries', () => {
    const botSummaries = [
      buildBotSummary({
        nitpicks: [
          buildNitpick({ id: 'nit1', path: 'file1.ts', line: '10', content: 'Fix 1' }),
          buildNitpick({ id: 'nit2', path: 'file2.ts', line: '20', content: 'Fix 2' })
        ]
      }),
      buildBotSummary({
        nitpicks: [
          buildNitpick({ id: 'nit3', path: 'file3.ts', line: '30', content: 'Fix 3' })
        ]
      })
    ];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries,
      allThreads: [],
      filter: () => true
    });

    expect(result.summary.nitpicksCount).toBe(3);
  });

  it('should handle bot summaries without nitpicks', () => {
    const botSummaryWithoutNitpicks = buildBotSummary();

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries: [botSummaryWithoutNitpicks],
      allThreads: [],
      filter: () => true
    });

    expect(result.summary.nitpicksCount).toBe(0);
  });

  it('should include threads when filter returns true for "threads"', () => {
    const processedThreads = [mockThread];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads,
      botSummaries: [],
      allThreads: [],
      filter: (key) => key === 'threads'
    });

    expect(result.threads).toEqual(processedThreads);
  });

  it('should not include threads when filter returns false for "threads"', () => {
    const processedThreads = [mockThread];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads,
      botSummaries: [],
      allThreads: [],
      filter: (key) => key !== 'threads'
    });

    expect(result.threads).toBeUndefined();
  });

  it('should include bot summaries when filter returns true for "summaries"', () => {
    const botSummaries = [mockBotSummary];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries,
      allThreads: [],
      filter: (key) => key === 'summaries'
    });

    expect(result.botSummaries).toEqual(botSummaries);
  });

  it('should include bot summaries when filter returns true for "nitpicks"', () => {
    const botSummaries = [mockBotSummary];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries,
      allThreads: [],
      filter: (key) => key === 'nitpicks'
    });

    expect(result.botSummaries).toEqual(botSummaries);
  });

  it('should not include bot summaries when filter returns false', () => {
    const botSummaries = [mockBotSummary];

    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries,
      allThreads: [],
      filter: () => false
    });

    expect(result.botSummaries).toBeUndefined();
  });

  it('should handle empty arrays', () => {
    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [],
      botSummaries: [],
      allThreads: [],
      filter: () => true
    });

    expect(result.summary.totalThreads).toBe(0);
    expect(result.summary.filteredCount).toBe(0);
    expect(result.summary.unresolvedCount).toBe(0);
    expect(result.summary.botSummariesCount).toBe(0);
    expect(result.summary.nitpicksCount).toBe(0);
  });

  it('should include all fields when filter always returns true', () => {
    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [mockThread],
      botSummaries: [mockBotSummary],
      allThreads: [],
      filter: () => true
    });

    expect(result.threads).toBeDefined();
    expect(result.botSummaries).toBeDefined();
  });

  it('should include no optional fields when filter always returns false', () => {
    const result = formatOutput({
      prMeta: mockPrMeta,
      statePath: mockStatePath,
      processedThreads: [mockThread],
      botSummaries: [mockBotSummary],
      allThreads: [],
      filter: () => false
    });

    expect(result.threads).toBeUndefined();
    expect(result.botSummaries).toBeUndefined();
    // But summary should always be present
    expect(result.summary).toBeDefined();
  });
});
