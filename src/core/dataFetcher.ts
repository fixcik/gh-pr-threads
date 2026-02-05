import Debug from 'debug';
import { fetchAllPagesWithCache, type FetchPagesResult } from '../github/fetcher.js';
import { THREADS_QUERY, FILES_QUERY, REVIEWS_QUERY, COMMENTS_QUERY, META_QUERY } from '../github/queries.js';
import { runGh } from '../github/client.js';
import type { PRMetaData } from '../github/apiTypes.js';
import type { Thread, CursorCache, PaginationCache } from '../types.js';

export interface PRFile {
  path: string;
  additions: number;
  deletions: number;
  changeType: string;
}

export interface PRReview {
  author: { login: string; __typename?: string };
  body: string;
  url: string;
  state: string;
}

export interface PRComment {
  id: string;
  body: string;
  author: { login: string; __typename?: string };
  url: string;
  createdAt: string;
}

export interface PRMetadata {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  mergeable: string;
  author: string;
  files: PRFile[];
  totalAdditions: number;
  totalDeletions: number;
}

const debugTiming = Debug('gh-pr-threads:timing');

export interface FetchPRDataOptions {
  owner: string;
  repo: string;
  number: number;
  targetThreadId: string | null;
  shouldFetchFiles: boolean;
  cursorCache?: CursorCache;
  cacheTtl?: number;
}

export interface ProcessedPRData {
  threads: Thread[];
  files: PRFile[];
  reviews: PRReview[];
  comments: PRComment[];
  metadata: PRMetadata;
  updatedCursorCache: CursorCache;
}

/**
 * Fetches all PR data in parallel: threads, files, reviews, and comments
 */
export async function fetchPRData(options: FetchPRDataOptions): Promise<ProcessedPRData> {
  const { owner, repo, number, targetThreadId, cursorCache, cacheTtl } = options;
  const parallelStartTime = Date.now();

  const [threadsResult, filesResult, reviewsResult, commentsResult, metadataWithoutFiles] = await Promise.all([
    fetchThreads(owner, repo, number, cursorCache?.threads, cacheTtl),
    fetchFiles(options, cursorCache?.files, cacheTtl),
    fetchReviews(owner, repo, number, targetThreadId, cursorCache?.reviews, cacheTtl),
    fetchComments(owner, repo, number, targetThreadId, cursorCache?.comments, cacheTtl),
    fetchMetadata(owner, repo, number)
  ]);

  debugTiming(`All parallel fetches completed in ${Date.now() - parallelStartTime}ms`);

  // Calculate total additions and deletions
  // If files were fetched, sum from files (more accurate for filtered views)
  // Otherwise use totals from PR metadata
  const totalAdditions = filesResult.nodes.length > 0
    ? filesResult.nodes.reduce((sum, file) => sum + file.additions, 0)
    : metadataWithoutFiles.totalAdditions;
  const totalDeletions = filesResult.nodes.length > 0
    ? filesResult.nodes.reduce((sum, file) => sum + file.deletions, 0)
    : metadataWithoutFiles.totalDeletions;

  const metadata: PRMetadata = {
    ...metadataWithoutFiles,
    files: filesResult.nodes,
    totalAdditions,
    totalDeletions
  };

  // Build updated cursor cache
  const updatedCursorCache: CursorCache = {
    threads: threadsResult.cache,
    files: filesResult.cache,
    reviews: reviewsResult.cache,
    comments: commentsResult.cache,
    threadComments: cursorCache?.threadComments  // preserve existing thread comments cache
  };

  return {
    threads: threadsResult.nodes,
    files: filesResult.nodes,
    reviews: reviewsResult.nodes,
    comments: commentsResult.nodes,
    metadata,
    updatedCursorCache
  };
}

async function fetchThreads(
  owner: string,
  repo: string,
  number: number,
  cachedCursors?: PaginationCache,
  cacheTtl?: number
): Promise<FetchPagesResult<Thread>> {
  const startTime = Date.now();
  const result = await fetchAllPagesWithCache<Thread>({
    owner,
    repo,
    number,
    queryPattern: THREADS_QUERY,
    getNodes: pr => (pr.reviewThreads?.nodes as Thread[]) || [],
    getPageInfo: pr => pr.reviewThreads?.pageInfo || { hasNextPage: false, endCursor: null },
    cachedCursors,
    cacheTtl
  });
  debugTiming(`Threads fetched: ${result.nodes.length} threads in ${Date.now() - startTime}ms`);
  return result;
}

async function fetchFiles(
  options: FetchPRDataOptions,
  cachedCursors?: PaginationCache,
  cacheTtl?: number
): Promise<FetchPagesResult<PRFile>> {
  const { owner, repo, number, targetThreadId, shouldFetchFiles } = options;

  // Skip files when targeting specific thread or when not requested
  if (targetThreadId || !shouldFetchFiles) {
    return {
      nodes: [],
      cache: cachedCursors ?? {
        pages: [],
        lastPageHasMore: false,
        totalItems: 0,
        fetchedAt: new Date().toISOString()
      },
      hadNewData: false
    };
  }

  const startTime = Date.now();
  const result = await fetchAllPagesWithCache<PRFile>({
    owner,
    repo,
    number,
    queryPattern: FILES_QUERY,
    getNodes: pr => (pr.files?.nodes as PRFile[]) || [],
    getPageInfo: pr => pr.files?.pageInfo || { hasNextPage: false, endCursor: null },
    cachedCursors,
    cacheTtl
  });
  debugTiming(`Files fetched: ${result.nodes.length} files in ${Date.now() - startTime}ms`);
  return result;
}

async function fetchReviews(
  owner: string,
  repo: string,
  number: number,
  targetThreadId: string | null,
  cachedCursors?: PaginationCache,
  cacheTtl?: number
): Promise<FetchPagesResult<PRReview>> {
  // Skip reviews when targeting specific thread ID (GraphQL format)
  // But still fetch when targeting nitpick (path:line format)
  const isNitpickId = targetThreadId && targetThreadId.includes(':') && targetThreadId.includes('/');
  if (targetThreadId && !isNitpickId) {
    return {
      nodes: [],
      cache: cachedCursors ?? {
        pages: [],
        lastPageHasMore: false,
        totalItems: 0,
        fetchedAt: new Date().toISOString()
      },
      hadNewData: false
    };
  }

  const startTime = Date.now();
  const result = await fetchAllPagesWithCache<PRReview>({
    owner,
    repo,
    number,
    queryPattern: REVIEWS_QUERY,
    getNodes: pr => (pr.reviews?.nodes as PRReview[]) || [],
    getPageInfo: pr => pr.reviews?.pageInfo || { hasNextPage: false, endCursor: null },
    cachedCursors,
    cacheTtl
  });
  debugTiming(`Reviews fetched: ${result.nodes.length} reviews in ${Date.now() - startTime}ms`);
  return result;
}

async function fetchComments(
  owner: string,
  repo: string,
  number: number,
  targetThreadId: string | null,
  cachedCursors?: PaginationCache,
  cacheTtl?: number
): Promise<FetchPagesResult<PRComment>> {
  // Skip comments when targeting specific thread ID (GraphQL format)
  // But still fetch when targeting nitpick (path:line format)
  const isNitpickId = targetThreadId && targetThreadId.includes(':') && targetThreadId.includes('/');
  if (targetThreadId && !isNitpickId) {
    return {
      nodes: [],
      cache: cachedCursors ?? {
        pages: [],
        lastPageHasMore: false,
        totalItems: 0,
        fetchedAt: new Date().toISOString()
      },
      hadNewData: false
    };
  }

  const startTime = Date.now();
  const result = await fetchAllPagesWithCache<PRComment>({
    owner,
    repo,
    number,
    queryPattern: COMMENTS_QUERY,
    getNodes: pr => (pr.comments?.nodes as PRComment[]) || [],
    getPageInfo: pr => pr.comments?.pageInfo || { hasNextPage: false, endCursor: null },
    cachedCursors,
    cacheTtl
  });
  debugTiming(`Comments fetched: ${result.nodes.length} comments in ${Date.now() - startTime}ms`);
  return result;
}

async function fetchMetadata(
  owner: string,
  repo: string,
  number: number
): Promise<Omit<PRMetadata, 'files'>> {
  const startTime = Date.now();
  const metaResult = runGh<PRMetaData>([
    'api',
    'graphql',
    `-F owner="${owner}"`,
    `-F repo="${repo}"`,
    `-F number=${number}`,
    `-f query='${META_QUERY}'`
  ]);
  debugTiming(`PR metadata fetched in ${Date.now() - startTime}ms`);

  const pr = metaResult.data.repository.pullRequest;
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.isDraft,
    mergeable: pr.mergeable,
    author: pr.author?.login ?? 'unknown',
    totalAdditions: pr.additions,
    totalDeletions: pr.deletions
  };
}
