import type { ProcessedThread, BotSummary, Nitpick } from '../types.js';

/**
 * Factory for creating ProcessedThread test objects
 */
export function buildProcessedThread(
  overrides?: Partial<ProcessedThread>
): ProcessedThread {
  return {
    thread_id: 'PRRT_test123',
    isResolved: false,
    isOutdated: false,
    path: 'test.ts',
    line: null,
    comments: [],
    status: undefined,
    ...overrides
  };
}

/**
 * Factory for creating BotSummary test objects
 */
export function buildBotSummary(
  overrides?: Partial<BotSummary>
): BotSummary {
  return {
    url: 'https://example.com/comment/123',
    author: 'coderabbitai',
    body: 'Test bot summary',
    ...overrides
  };
}

/**
 * Factory for creating Nitpick test objects
 */
export function buildNitpick(
  overrides?: Partial<Nitpick>
): Nitpick {
  return {
    id: 'src/test.ts:10',
    path: 'src/test.ts',
    line: '10',
    content: 'Test nitpick content',
    ...overrides
  };
}
