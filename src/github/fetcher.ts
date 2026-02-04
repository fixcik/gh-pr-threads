import { runGh } from './client.js';
import { THREAD_COMMENTS_QUERY } from './queries.js';
import type { Thread, ThreadComment } from '../types.js';

export async function fetchAllPages(
  owner: string,
  repo: string,
  number: number,
  queryPattern: string,
  getNodes: (pr: any) => any,
  getPageInfo: (pr: any) => any
): Promise<any[]> {
  const allNodes: any[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const ghArgs = [
      'api', 'graphql',
      `-F owner="${owner}"`,
      `-F repo="${repo}"`,
      `-F number=${number}`,
      cursor ? `-F after="${cursor}"` : '',
      `-f query='${queryPattern}'`
    ].filter(Boolean);

    const result = runGh(ghArgs);
    const pr = result.data.repository.pullRequest;

    allNodes.push(...getNodes(pr));
    const pageInfo = getPageInfo(pr);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  return allNodes;
}

export async function fetchAllThreadComments(
  owner: string,
  repo: string,
  number: number,
  thread: Thread
): Promise<ThreadComment[]> {
  const comments = [...thread.comments.nodes];
  let cursor = thread.comments.pageInfo.endCursor;
  let hasNextPage = thread.comments.pageInfo.hasNextPage;

  while (hasNextPage && cursor) {
    const ghArgs = [
      'api', 'graphql',
      `-F owner="${owner}"`,
      `-F repo="${repo}"`,
      `-F number=${number}`,
      `-F threadId="${thread.id}"`,
      `-F after="${cursor}"`,
      `-f query='${THREAD_COMMENTS_QUERY}'`
    ];

    const result = runGh(ghArgs);
    const threadData = result.data.repository.pullRequest.reviewThread;
    if (!threadData) break;

    comments.push(...threadData.comments.nodes);
    hasNextPage = threadData.comments.pageInfo.hasNextPage;
    cursor = threadData.comments.pageInfo.endCursor;
  }
  return comments;
}
