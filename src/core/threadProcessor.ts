import Debug from 'debug';
import { fetchAllThreadComments } from '../github/fetcher.js';
import { cleanCommentBody } from '../parsers/comments.js';
import { THREAD_STATUS } from './constants.js';
import type { Thread, ProcessedThread, State, ThreadComment } from '../types.js';

const debugTiming = Debug('gh-pr-threads:timing');

export interface ProcessThreadsOptions {
  threads: Thread[];
  owner: string;
  repo: string;
  number: number;
  state: State;
  targetThreadId: string | null;
  showAll: boolean;
  withResolved: boolean;
  includeDone: boolean;
}

export interface ProcessThreadsResult {
  processedThreads: ProcessedThread[];
  threadCommentsCache: Map<string, ThreadComment[]>;
}

/**
 * Processes review threads, fetches their comments, and applies filters
 */
export async function processThreads(options: ProcessThreadsOptions): Promise<ProcessThreadsResult> {
  const { threads, owner, repo, number, state, targetThreadId, showAll, withResolved, includeDone } = options;
  
  const startTime = Date.now();
  const processedThreads: ProcessedThread[] = [];
  const threadCommentsCache = new Map<string, ThreadComment[]>();

  let skipped = 0;

  for (const thread of threads) {
    // Skip filters if targeting specific thread
    if (!targetThreadId) {
      if (shouldSkipThread(thread, state, showAll, withResolved, includeDone)) {
        skipped++;
        continue;
      }
    }

    const comments = await fetchAllThreadComments(owner, repo, number, thread);
    threadCommentsCache.set(thread.id, comments);

    const threadStatus = state.threads[thread.id]?.status;
    processedThreads.push({
      thread_id: thread.id,
      isResolved: thread.isResolved,
      isOutdated: thread.isOutdated,
      path: thread.path,
      line: thread.line,
      status: threadStatus,
      comments: comments.map(c => ({
        id: c.id,
        author: c.author.login,
        body: cleanCommentBody(c.body),
        url: c.url,
        createdAt: c.createdAt,
        ...(c.reactionGroups && c.reactionGroups.length > 0 && { reactionGroups: c.reactionGroups })
      }))
    });
  }

  debugTiming(`Threads processed: ${processedThreads.length} / ${threads.length} (${skipped} skipped) in ${Date.now() - startTime}ms`);

  return { processedThreads, threadCommentsCache };
}

function shouldSkipThread(
  thread: Thread,
  state: State,
  showAll: boolean,
  withResolved: boolean,
  includeDone: boolean
): boolean {
  // Skip resolved threads unless explicitly requested
  if (!showAll && !withResolved && thread.isResolved) {
    return true;
  }

  // Skip done/skip threads unless explicitly requested
  const threadStatus = state.threads[thread.id]?.status;
  if (!includeDone && (threadStatus === THREAD_STATUS.DONE || threadStatus === THREAD_STATUS.SKIP)) {
    return true;
  }

  return false;
}
