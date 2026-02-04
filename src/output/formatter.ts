import type { Output, ProcessedThread, BotSummary, UserComment } from '../types.js';

export function formatOutput(
  prMeta: any,
  statePath: string,
  processedThreads: ProcessedThread[],
  botSummaries: BotSummary[],
  userComments: UserComment[],
  allThreads: any[],
  filter: (key: string) => boolean
): Output {
  const output: Output = {
    pr: prMeta,
    statePath,
    summary: {
      totalThreads: allThreads.length,
      filteredCount: processedThreads.length,
      unresolvedCount: allThreads.filter((t: any) => !t.isResolved).length,
      botSummariesCount: botSummaries.length,
      nitpicksCount: botSummaries.reduce((acc, s) => acc + (s.nitpicks?.length || 0), 0),
      userCommentsCount: userComments.length,
      userCommentsByAuthor: userComments.reduce((acc, c) => {
        acc[c.author] = (acc[c.author] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    }
  };

  if (filter('threads')) output.threads = processedThreads;
  if (filter('summaries') || filter('nitpicks')) output.botSummaries = botSummaries;
  if (filter('userComments')) output.userComments = userComments;

  return output;
}
