import { describe, it, expect } from 'vitest';
import { formatOutput } from './formatter.js';
import type { ProcessedThread, BotSummary } from '../types.js';

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

  const mockThread: ProcessedThread = {
    thread_id: 'PRRT_test123',
    comments: [],
    status: undefined,
    isResolved: false,
    isOutdated: false,
    path: 'test.ts',
    line: null
  };

  const mockBotSummary: BotSummary = {
    url: 'https://example.com',
    author: 'bot',
    body: 'Summary',
    nitpicks: [
      { id: 'nit1', path: 'file.ts', line: '10', content: 'Fix this' }
    ]
  };

  it('should create basic output structure', () => {
    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      [],
      [],
      () => true
    );

    expect(result).toHaveProperty('pr');
    expect(result).toHaveProperty('statePath');
    expect(result).toHaveProperty('summary');
  });

  it('should include PR metadata', () => {
    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      [],
      [],
      () => true
    );

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

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      processedThreads,
      botSummaries,
      allThreads,
      () => true
    );

    expect(result.summary.totalThreads).toBe(3);
    expect(result.summary.filteredCount).toBe(1);
    expect(result.summary.unresolvedCount).toBe(2);
    expect(result.summary.botSummariesCount).toBe(1);
    expect(result.summary.nitpicksCount).toBe(1);
  });

  it('should count nitpicks across multiple bot summaries', () => {
    const botSummaries = [
      {
        ...mockBotSummary,
        nitpicks: [
          { id: 'nit1', path: 'file1.ts', line: '10', content: 'Fix 1' },
          { id: 'nit2', path: 'file2.ts', line: '20', content: 'Fix 2' }
        ]
      },
      {
        ...mockBotSummary,
        nitpicks: [
          { id: 'nit3', path: 'file3.ts', line: '30', content: 'Fix 3' }
        ]
      }
    ];

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      botSummaries,
      [],
      () => true
    );

    expect(result.summary.nitpicksCount).toBe(3);
  });

  it('should handle bot summaries without nitpicks', () => {
    const botSummaryWithoutNitpicks: BotSummary = {
      url: 'https://example.com',
      author: 'bot',
      body: 'Summary'
    };

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      [botSummaryWithoutNitpicks],
      [],
      () => true
    );

    expect(result.summary.nitpicksCount).toBe(0);
  });

  it('should include threads when filter returns true for "threads"', () => {
    const processedThreads = [mockThread];

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      processedThreads,
      [],
      [],
      (key) => key === 'threads'
    );

    expect(result.threads).toEqual(processedThreads);
  });

  it('should not include threads when filter returns false for "threads"', () => {
    const processedThreads = [mockThread];

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      processedThreads,
      [],
      [],
      (key) => key !== 'threads'
    );

    expect(result.threads).toBeUndefined();
  });

  it('should include bot summaries when filter returns true for "summaries"', () => {
    const botSummaries = [mockBotSummary];

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      botSummaries,
      [],
      (key) => key === 'summaries'
    );

    expect(result.botSummaries).toEqual(botSummaries);
  });

  it('should include bot summaries when filter returns true for "nitpicks"', () => {
    const botSummaries = [mockBotSummary];

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      botSummaries,
      [],
      (key) => key === 'nitpicks'
    );

    expect(result.botSummaries).toEqual(botSummaries);
  });

  it('should not include bot summaries when filter returns false', () => {
    const botSummaries = [mockBotSummary];

    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      botSummaries,
      [],
      () => false
    );

    expect(result.botSummaries).toBeUndefined();
  });

  it('should handle empty arrays', () => {
    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [],
      [],
      [],
      () => true
    );

    expect(result.summary.totalThreads).toBe(0);
    expect(result.summary.filteredCount).toBe(0);
    expect(result.summary.unresolvedCount).toBe(0);
    expect(result.summary.botSummariesCount).toBe(0);
    expect(result.summary.nitpicksCount).toBe(0);
  });

  it('should include all fields when filter always returns true', () => {
    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [mockThread],
      [mockBotSummary],
      [],
      () => true
    );

    expect(result.threads).toBeDefined();
    expect(result.botSummaries).toBeDefined();
  });

  it('should include no optional fields when filter always returns false', () => {
    const result = formatOutput(
      mockPrMeta,
      mockStatePath,
      [mockThread],
      [mockBotSummary],
      [],
      () => false
    );

    expect(result.threads).toBeUndefined();
    expect(result.botSummaries).toBeUndefined();
    // But summary should always be present
    expect(result.summary).toBeDefined();
  });
});
