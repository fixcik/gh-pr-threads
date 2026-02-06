import { processBotSummaries } from './botProcessor.js';
import type { BotSummary, State, Nitpick } from '../types.js';
import type { ProcessedPRData } from './dataFetcher.js';

/**
 * Processes bot summaries and nitpicks based on filter settings
 */
export function processBotData(
  prData: ProcessedPRData,
  ignoreBots: boolean,
  filter: (key: string) => boolean,
  state: State,
  includeDone: boolean
): { botSummaries: BotSummary[]; allNitpicks: Nitpick[] } {
  if (ignoreBots || (!filter('summaries') && !filter('nitpicks'))) {
    return { botSummaries: [], allNitpicks: [] };
  }

  return processBotSummaries({
    comments: prData.comments,
    reviews: prData.reviews,
    state,
    shouldIncludeSummaries: filter('summaries'),
    shouldIncludeNitpicks: filter('nitpicks'),
    includeDone
  });
}
