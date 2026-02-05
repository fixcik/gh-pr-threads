import Debug from 'debug';
import { fetchAllPages } from '../github/fetcher.js';
import { THREADS_QUERY, FILES_QUERY, REVIEWS_QUERY, COMMENTS_QUERY } from '../github/queries.js';
import type { Thread } from '../types.js';

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

const debugTiming = Debug('gh-pr-threads:timing');

export interface FetchPRDataOptions {
  owner: string;
  repo: string;
  number: number;
  targetThreadId: string | null;
  shouldFetchFiles: boolean;
}

export interface ProcessedPRData {
  threads: Thread[];
  files: PRFile[];
  reviews: PRReview[];
  comments: PRComment[];
}

/**
 * Fetches all PR data in parallel: threads, files, reviews, and comments
 */
export async function fetchPRData(options: FetchPRDataOptions): Promise<ProcessedPRData> {
  const { owner, repo, number, targetThreadId, shouldFetchFiles } = options;
  const parallelStartTime = Date.now();

  const [threads, files, reviews, comments] = await Promise.all([
    fetchThreads(owner, repo, number),
    fetchFiles(owner, repo, number, targetThreadId, shouldFetchFiles),
    fetchReviews(owner, repo, number, targetThreadId),
    fetchComments(owner, repo, number, targetThreadId)
  ]);

  debugTiming(`All parallel fetches completed in ${Date.now() - parallelStartTime}ms`);

  return { threads, files, reviews, comments };
}

async function fetchThreads(owner: string, repo: string, number: number): Promise<Thread[]> {
  const startTime = Date.now();
  const threads = await fetchAllPages<Thread>({
    owner,
    repo,
    number,
    queryPattern: THREADS_QUERY,
    getNodes: pr => (pr.reviewThreads?.nodes as Thread[]) || [],
    getPageInfo: pr => pr.reviewThreads?.pageInfo || { hasNextPage: false, endCursor: null }
  });
  debugTiming(`Threads fetched: ${threads.length} threads in ${Date.now() - startTime}ms`);
  return threads;
}

async function fetchFiles(
  owner: string,
  repo: string,
  number: number,
  targetThreadId: string | null,
  shouldFetchFiles: boolean
): Promise<PRFile[]> {
  // Skip files when targeting specific thread or when not requested
  if (targetThreadId || !shouldFetchFiles) {
    return [];
  }

  const startTime = Date.now();
  const files = await fetchAllPages<PRFile>({
    owner,
    repo,
    number,
    queryPattern: FILES_QUERY,
    getNodes: pr => (pr.files?.nodes as PRFile[]) || [],
    getPageInfo: pr => pr.files?.pageInfo || { hasNextPage: false, endCursor: null }
  });
  debugTiming(`Files fetched: ${files.length} files in ${Date.now() - startTime}ms`);
  return files;
}

async function fetchReviews(
  owner: string,
  repo: string,
  number: number,
  targetThreadId: string | null
): Promise<PRReview[]> {
  // Skip reviews when targeting specific thread (only needed for bot summaries)
  if (targetThreadId) {
    return [];
  }

  const startTime = Date.now();
  const reviews = await fetchAllPages<PRReview>({
    owner,
    repo,
    number,
    queryPattern: REVIEWS_QUERY,
    getNodes: pr => (pr.reviews?.nodes as PRReview[]) || [],
    getPageInfo: pr => pr.reviews?.pageInfo || { hasNextPage: false, endCursor: null }
  });
  debugTiming(`Reviews fetched: ${reviews.length} reviews in ${Date.now() - startTime}ms`);
  return reviews;
}

async function fetchComments(
  owner: string,
  repo: string,
  number: number,
  targetThreadId: string | null
): Promise<PRComment[]> {
  // Skip comments when targeting specific thread (only needed for bot summaries)
  if (targetThreadId) {
    return [];
  }

  const startTime = Date.now();
  const comments = await fetchAllPages<PRComment>({
    owner,
    repo,
    number,
    queryPattern: COMMENTS_QUERY,
    getNodes: pr => (pr.comments?.nodes as PRComment[]) || [],
    getPageInfo: pr => pr.comments?.pageInfo || { hasNextPage: false, endCursor: null }
  });
  debugTiming(`Comments fetched: ${comments.length} comments in ${Date.now() - startTime}ms`);
  return comments;
}
