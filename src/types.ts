export interface State {
  pr: string;
  updatedAt: string;
  threads: Record<string, { status: string; note?: string }>;
  nitpicks: Record<string, { status: string; note?: string }>;
}

export interface ThreadComment {
  id: string;
  body: string;
  author: { login: string };
  url: string;
  createdAt: string;
  path: string;
  line: number | null;
}

export interface Thread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  comments: {
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: ThreadComment[];
  };
}

export interface PRData {
  repository: {
    pullRequest: {
      number: number;
      title: string;
      state: string;
      author: { login: string };
      isDraft: boolean;
      mergeable: string;
      reviewThreads: {
        totalCount: number;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: Thread[];
      };
      files: {
        totalCount: number;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: Array<{
          path: string;
          additions: number;
          deletions: number;
          changeType: string;
        }>;
      };
      reviews: {
        totalCount: number;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: Array<{
          author: { login: string };
          body: string;
          url: string;
          state: string;
          bodyText: string;
        }>;
      };
      comments: {
        totalCount: number;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: Array<{
          id: string;
          body: string;
          author: { login: string };
          url: string;
          createdAt: string;
        }>;
      };
    };
  };
}

export interface Args {
  owner: string;
  repo: string;
  number: number;
  showAll: boolean;
  only: string[];
  includeDone: boolean;
  withResolved: boolean;
}

export interface Nitpick {
  id: string;
  path: string;
  line: string;
  content: string;
  status?: string;
}

export interface ProcessedThread {
  thread_id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  status?: string;
  comments: Array<{
    id: string;
    author: string;
    body: string;
    url: string;
    createdAt: string;
  }>;
}

export interface BotSummary {
  author: string;
  url: string;
  body?: string;
  nitpicks?: Nitpick[];
}

export interface UserComment {
  id: string;
  author: string;
  body: string;
  url: string;
  createdAt: string;
  thread_id: string;
  file: string;
  line: number | null;
  isResolved: boolean;
  isOutdated: boolean;
}

export interface Output {
  pr: {
    number: number;
    title: string;
    state: string;
    author: string;
    isDraft: boolean;
    mergeable: string;
    files: any[];
  };
  statePath: string;
  threads?: ProcessedThread[];
  botSummaries?: BotSummary[];
  userComments?: UserComment[];
  summary: {
    totalThreads: number;
    filteredCount: number;
    unresolvedCount: number;
    botSummariesCount: number;
    nitpicksCount: number;
    userCommentsCount: number;
    userCommentsByAuthor: Record<string, number>;
  };
}
