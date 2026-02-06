import { formatOutput } from '../output/formatter.js';
import { formatPlainOutput } from '../output/plainFormatter.js';
import type { ProcessedThread, BotSummary, Thread } from '../types.js';
import type { PRMetadata } from './dataFetcher.js';

export interface OutputOptions {
  format: 'json' | 'plain';
  prMeta: PRMetadata;
  statePath: string;
  processedThreads: ProcessedThread[];
  botSummaries: BotSummary[];
  allThreads: Thread[];
  filter: (key: string) => boolean;
}

/**
 * Outputs results in the specified format (JSON or plain text)
 */
export function outputResults(options: OutputOptions): void {
  const { format, prMeta, statePath, processedThreads, botSummaries, allThreads, filter } = options;

  if (format === 'json') {
    const output = formatOutput({
      prMeta,
      statePath,
      processedThreads,
      botSummaries,
      allThreads,
      filter
    });
    console.log(JSON.stringify(output, null, 2));
  } else {
    const output = formatPlainOutput({
      prMeta,
      statePath,
      processedThreads,
      botSummaries,
      allThreads,
      filter
    });
    console.log(output);
  }
}
