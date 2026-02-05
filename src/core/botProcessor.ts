import Debug from 'debug';
import { parseNitpicks } from '../parsers/nitpicks.js';
import { cleanCommentBody } from '../parsers/comments.js';
import { isBot } from './botDetector.js';
import { THREAD_STATUS } from './constants.js';
import type { BotSummary, State, Nitpick } from '../types.js';
import type { PRReview, PRComment } from './dataFetcher.js';

const debug = Debug('gh-pr-threads');
const debugTiming = Debug('gh-pr-threads:timing');

export interface ProcessBotSummariesOptions {
  comments: PRComment[];
  reviews: PRReview[];
  state: State;
  shouldIncludeSummaries: boolean;
  shouldIncludeNitpicks: boolean;
  includeDone: boolean;
}

export interface ProcessBotSummariesResult {
  botSummaries: BotSummary[];
  allNitpicks: Nitpick[];
}

/**
 * Processes bot comments and reviews to extract summaries and nitpicks
 */
export function processBotSummaries(options: ProcessBotSummariesOptions): ProcessBotSummariesResult {
  const { comments, reviews, state, shouldIncludeSummaries, shouldIncludeNitpicks, includeDone } = options;
  
  const startTime = Date.now();
  const botSummaries: BotSummary[] = [];
  const allNitpicks: Nitpick[] = [];

  type BotCandidate = PRComment | PRReview;
  const candidates: BotCandidate[] = [...comments, ...reviews].filter(c => 
    c.author && c.body && c.url && isBot(c.author)
  );

  debug(`Found ${candidates.length} bot comments`);

  let totalNitpicks = 0;

  for (const candidate of candidates) {
    let nitpicks = parseNitpicks(candidate.body);
    totalNitpicks += nitpicks.length;

    if (shouldIncludeNitpicks) {
      nitpicks = filterNitpicks(nitpicks, state, includeDone);
      allNitpicks.push(...nitpicks);
    }

    const summary = buildBotSummary(candidate, nitpicks, shouldIncludeSummaries, shouldIncludeNitpicks);
    
    if (summary.body || (summary.nitpicks && summary.nitpicks.length > 0)) {
      botSummaries.push(summary);
    }
  }

  debugTiming(`Bot summaries processed: ${botSummaries.length} summaries, ${totalNitpicks} total nitpicks in ${Date.now() - startTime}ms`);

  return { botSummaries, allNitpicks };
}

function filterNitpicks(nitpicks: Nitpick[], state: State, includeDone: boolean): Nitpick[] {
  return nitpicks
    .map(n => ({ ...n, status: state.nitpicks[n.id]?.status }))
    .filter(n => includeDone || (n.status !== THREAD_STATUS.DONE && n.status !== THREAD_STATUS.SKIP));
}

function buildBotSummary(
  candidate: PRComment | PRReview,
  nitpicks: Nitpick[],
  shouldIncludeSummaries: boolean,
  shouldIncludeNitpicks: boolean
): BotSummary {
  const summary: BotSummary = { author: candidate.author.login, url: candidate.url };

  if (shouldIncludeSummaries) {
    summary.body = cleanCommentBody(candidate.body);
  }

  if (shouldIncludeNitpicks && nitpicks.length > 0) {
    summary.nitpicks = nitpicks;
  }

  return summary;
}
