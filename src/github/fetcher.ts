import Debug from 'debug';
import { runGh } from './client.js';
import { THREAD_COMMENTS_QUERY } from './queries.js';
import type { Thread, ThreadComment, PaginationCache } from '../types.js';
import type { GraphQLPRResponse, ThreadCommentsData, PageInfo } from './apiTypes.js';

const debug = Debug('gh-pr-threads:fetcher');
const DEFAULT_TTL_MINUTES = 60;

/**
 * Check if pagination cache is still valid based on TTL
 */
function isCacheValid(cache: PaginationCache, ttlMinutes = DEFAULT_TTL_MINUTES): boolean {
  const fetchedAt = new Date(cache.fetchedAt).getTime();
  const ttlMs = ttlMinutes * 60 * 1000;
  return (Date.now() - fetchedAt) < ttlMs;
}

/**
 * Detect if error is caused by stale/invalid cursor
 */
function isStaleCursorError(error: unknown): boolean {
  const message = String(error);
  return message.includes('cursor') && (
    message.includes('invalid') || message.includes('not found')
  );
}

export interface FetchPagesOptions<T> {
  owner: string;
  repo: string;
  number: number;
  queryPattern: string;
  getNodes: (pr: GraphQLPRResponse['data']['repository']['pullRequest']) => T[];
  getPageInfo: (pr: GraphQLPRResponse['data']['repository']['pullRequest']) => PageInfo;
  cacheTtl?: number;
}

export interface FetchPagesResult<T> {
  nodes: T[];
  cache: PaginationCache;
  hadNewData: boolean;
}

/**
 * Fetch a single page with specific cursor
 */
async function fetchSinglePage<T>(
  options: FetchPagesOptions<T>,
  cursor: string | null,
  pageIndex: number
): Promise<T[]> {
  const { owner, repo, number, queryPattern, getNodes } = options;
  const startTime = Date.now();

  const ghArgs = [
    'api', 'graphql',
    `-F owner="${owner}"`,
    `-F repo="${repo}"`,
    `-F number=${number}`,
    cursor ? `-F after="${cursor}"` : '',
    `-f query='${queryPattern}'`
  ].filter(Boolean);

  const result = runGh<GraphQLPRResponse>(ghArgs);
  const pr = result.data.repository.pullRequest;
  const nodes = getNodes(pr);

  debug(`Page ${pageIndex + 1} (cached): fetched ${nodes.length} nodes in ${Date.now() - startTime}ms`);
  return nodes;
}

/**
 * Fetch delta pages after the last known cursor
 */
async function fetchDeltaPages<T>(
  options: FetchPagesOptions<T>,
  lastKnownCursor: string | null
): Promise<{ nodes: T[]; newPages: { cursor: string | null; itemCount: number }[]; lastPageHasMore: boolean }> {
  const { owner, repo, number, queryPattern, getNodes, getPageInfo } = options;
  const debugCache = Debug('gh-pr-threads:cache');
  const allNodes: T[] = [];
  const newPages: { cursor: string | null; itemCount: number }[] = [];
  let cursor = lastKnownCursor;
  let hasNextPage = true;
  let pageCount = 0;

  while (hasNextPage && cursor) {
    pageCount++;
    const startTime = Date.now();
    const ghArgs = [
      'api', 'graphql',
      `-F owner="${owner}"`,
      `-F repo="${repo}"`,
      `-F number=${number}`,
      `-F after="${cursor}"`,
      `-f query='${queryPattern}'`
    ];

    const result = runGh<GraphQLPRResponse>(ghArgs);
    const pr = result.data.repository.pullRequest;

    const nodes = getNodes(pr);
    allNodes.push(...nodes);
    newPages.push({ cursor, itemCount: nodes.length });
    debugCache(`Delta page ${pageCount}: fetched ${nodes.length} new nodes in ${Date.now() - startTime}ms`);

    const pageInfo = getPageInfo(pr);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  debugCache(`Delta fetch: ${pageCount} new pages, ${allNodes.length} new nodes`);
  return { nodes: allNodes, newPages, lastPageHasMore: hasNextPage };
}

/**
 * Sequential fetch mode - collects cursors for future caching
 */
async function fetchSequentially<T>(
  options: FetchPagesOptions<T>
): Promise<FetchPagesResult<T>> {
  const { owner, repo, number, queryPattern, getNodes, getPageInfo } = options;
  const allNodes: T[] = [];
  const pages: { cursor: string | null; itemCount: number }[] = [];
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

    const result = runGh<GraphQLPRResponse>(ghArgs);
    const pr = result.data.repository.pullRequest;

    const nodes = getNodes(pr);
    allNodes.push(...nodes);
    pages.push({ cursor, itemCount: nodes.length });
    debug(`Page ${pageCount}: fetched ${nodes.length} nodes in ${Date.now() - startTime}ms`);

    const pageInfo = getPageInfo(pr);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  debug(`Completed ${pageCount} pages, total ${allNodes.length} nodes`);

  return {
    nodes: allNodes,
    cache: {
      pages,
      lastPageHasMore: hasNextPage,
      totalItems: allNodes.length,
      fetchedAt: new Date().toISOString()
    },
    hadNewData: true
  };
}

/**
 * Parallel fetch mode using cached cursors
 */
async function fetchWithCachedCursors<T>(
  options: FetchPagesOptions<T>,
  cache: PaginationCache
): Promise<FetchPagesResult<T>> {
  const debugCache = Debug('gh-pr-threads:cache');
  debugCache(`Using cached cursors: ${cache.pages.length} pages`);

  try {
    // Parallel fetch all known pages
    const pagePromises = cache.pages.map((page, idx) =>
      fetchSinglePage(options, page.cursor, idx)
    );

    // Also check for delta if last page had more
    const deltaPromise = cache.lastPageHasMore
      ? fetchDeltaPages(options, cache.pages[cache.pages.length - 1]?.cursor ?? null)
      : Promise.resolve({ nodes: [], newPages: [], lastPageHasMore: false });

    const [pageResults, delta] = await Promise.all([
      Promise.all(pagePromises),
      deltaPromise
    ]);

    const allNodes = pageResults.flat().concat(delta.nodes);

    return {
      nodes: allNodes,
      cache: {
        pages: [...cache.pages, ...delta.newPages],
        lastPageHasMore: delta.lastPageHasMore,
        totalItems: allNodes.length,
        fetchedAt: new Date().toISOString()
      },
      hadNewData: delta.nodes.length > 0
    };
  } catch (error) {
    if (isStaleCursorError(error)) {
      debugCache('Stale cursor detected, falling back to sequential fetch');
      return fetchSequentially(options);
    }
    throw error;
  }
}

/**
 * Main entry point - fetches pages with optional caching
 */
export async function fetchAllPagesWithCache<T = unknown>(
  options: FetchPagesOptions<T> & { cachedCursors?: PaginationCache }
): Promise<FetchPagesResult<T>> {
  const { cachedCursors, cacheTtl, ...fetchOptions } = options;

  if (cachedCursors && isCacheValid(cachedCursors, cacheTtl)) {
    return fetchWithCachedCursors(fetchOptions, cachedCursors);
  }

  return fetchSequentially(fetchOptions);
}

export async function fetchAllPages<T = unknown>(options: FetchPagesOptions<T>): Promise<T[]> {
  const result = await fetchAllPagesWithCache(options);
  return result.nodes;
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
