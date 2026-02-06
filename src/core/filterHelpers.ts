import type { BotSummary } from '../types.js';

/**
 * Creates a filter function based on the 'only' option
 */
export function createFilterFunction(only: string[]): (key: string) => boolean {
  return (key: string) => {
    // Ignore userComments option (removed in v0.3.0)
    if (key === 'userComments') return false;
    return only.length === 0 || only.includes(key);
  };
}

/**
 * Filters bot summaries to only include nitpicks matching the given IDs
 */
export function filterBotSummariesByNitpicks(
  botSummaries: BotSummary[],
  nitpickIds: Set<string>
): BotSummary[] {
  if (nitpickIds.size === 0) {
    return botSummaries;
  }

  return botSummaries
    .map(summary => ({
      ...summary,
      nitpicks: summary.nitpicks?.filter(n => nitpickIds.has(n.id))
    }))
    .filter(summary => summary.nitpicks && summary.nitpicks.length > 0);
}
