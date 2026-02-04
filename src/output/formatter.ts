import type { Output, ProcessedThread, BotSummary } from '../types.js';

export interface FormatOutputOptions {
  prMeta: { number: number; title: string; state: string; author: string; files: unknown[]; isDraft: boolean; mergeable: string };
  statePath: string;
  processedThreads: ProcessedThread[];
  botSummaries: BotSummary[];
  allThreads: Array<{ isResolved: boolean }>;
  filter: (key: string) => boolean;
}

export function formatOutput(options: FormatOutputOptions): Output {
  const { prMeta, statePath, processedThreads, botSummaries, allThreads, filter } = options;
  const output: Output = {
    pr: prMeta,
    statePath,
    summary: {
      totalThreads: allThreads.length,
      filteredCount: processedThreads.length,
      unresolvedCount: allThreads.filter((t) => !t.isResolved).length,
      botSummariesCount: botSummaries.length,
      nitpicksCount: botSummaries.reduce((acc, s) => acc + (s.nitpicks?.length || 0), 0)
    }
  };

  if (filter('threads')) output.threads = processedThreads;
  if (filter('summaries') || filter('nitpicks')) output.botSummaries = botSummaries;

  return output;
}
