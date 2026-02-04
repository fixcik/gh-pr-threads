import Debug from 'debug';
import { runGh } from './client.js';
import { THREAD_COMMENTS_QUERY } from './queries.js';
import type { Thread, ThreadComment } from '../types.js';
import type { PRData, ThreadCommentsData, PageInfo } from './apiTypes.js';

const debug = Debug('gh-pr-threads:fetcher');

export interface FetchPagesOptions<T> {
  owner: string;
  repo: string;
  number: number;
  queryPattern: string;
  getNodes: (pr: PRData['data']['repository']['pullRequest']) => T[];
  getPageInfo: (pr: PRData['data']['repository']['pullRequest']) => PageInfo;
}

export async function fetchAllPages<T = unknown>(options: FetchPagesOptions<T>): Promise<T[]> {
  const { owner, repo, number, queryPattern, getNodes, getPageInfo } = options;
  const allNodes: T[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;

  while (hasNextPage) {
    pageCount++;
    const startTime = Date.now();
    const ghArgs = [
      'api', 'graphql',
      `-F owner="${owner}"`,
      `-F repo="${repo}"`,
      `-F number=${number}`,
      cursor ? `-F after="${cursor}"` : '',
      `-f query='${queryPattern}'`
    ].filter(Boolean);

    const result = runGh<PRData>(ghArgs);
    const pr = result.data.repository.pullRequest;

    const nodes = getNodes(pr);
    allNodes.push(...nodes);
    debug(`Page ${pageCount}: fetched ${nodes.length} nodes in ${Date.now() - startTime}ms`);
    
    const pageInfo = getPageInfo(pr);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  debug(`Completed ${pageCount} pages, total ${allNodes.length} nodes`);
  return allNodes;
}

export async function fetchAllThreadComments(
  owner: string,
  repo: string,
  number: number,
  thread: Thread
): Promise<ThreadComment[]> {
  const startTime = Date.now();
  const comments = [...thread.comments.nodes];
  let cursor = thread.comments.pageInfo.endCursor;
  let hasNextPage = thread.comments.pageInfo.hasNextPage;
  let pageCount = comments.length > 0 ? 1 : 0;

  while (hasNextPage && cursor) {
    pageCount++;
    const pageStartTime = Date.now();
    const ghArgs = [
      'api', 'graphql',
      `-F owner="${owner}"`,
      `-F repo="${repo}"`,
      `-F number=${number}`,
      `-F threadId="${thread.id}"`,
      `-F after="${cursor}"`,
      `-f query='${THREAD_COMMENTS_QUERY}'`
    ];

    const result = runGh<ThreadCommentsData>(ghArgs);
    const threadData = result.data.repository.pullRequest.reviewThread;
    if (!threadData) break;

    const newComments = threadData.comments.nodes as ThreadComment[];
    comments.push(...newComments);
    debug(`Thread ${thread.id} page ${pageCount}: fetched ${newComments.length} comments in ${Date.now() - pageStartTime}ms`);

    hasNextPage = threadData.comments.pageInfo.hasNextPage;
    cursor = threadData.comments.pageInfo.endCursor;
  }
  debug(`Thread ${thread.id}: completed ${pageCount} pages, total ${comments.length} comments in ${Date.now() - startTime}ms`);
  return comments;
}
