export interface State {
  pr: string;
  updatedAt: string;
  threads: Record<string, { status: string; note?: string }>;
  nitpicks: Record<string, { status: string; note?: string }>;
  idMap: Record<string, string>;
}

export interface ThreadComment {
  id: string;
  body: string;
  author: { login: string; __typename?: string };
  url: string;
  createdAt: string;
  path: string;
  line: number | null;
  reactionGroups?: ReactionGroup[];
}

// Reactor - user/bot who added a reaction
export interface Reactor {
  login: string;
}

// Group of reactions of the same type
export interface ReactionGroup {
  content: string;           // THUMBS_UP, HEART, ROCKET, etc.
  createdAt: string;         // ISO timestamp of first reaction
  viewerHasReacted: boolean; // whether current user reacted
  reactors: {
    totalCount: number;
    nodes: Reactor[];
  };
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

export interface Args {
  owner: string;
  repo: string;
  number: number;
  showAll: boolean;
  only: string[];
  includeDone: boolean;
  withResolved: boolean;
  format: 'plain' | 'json';
  ignoreBots: boolean;
  threadId?: string;
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
    reactionGroups?: ReactionGroup[];
  }>;
}

export interface BotSummary {
  author: string;
  url: string;
  body?: string;
  nitpicks?: Nitpick[];
}


export interface Output {
  pr: {
    number: number;
    title: string;
    state: string;
    author: string;
    isDraft: boolean;
    mergeable: string;
    files: unknown[];
  };
  statePath: string;
  threads?: ProcessedThread[];
  botSummaries?: BotSummary[];
  summary: {
    totalThreads: number;
    filteredCount: number;
    unresolvedCount: number;
    botSummariesCount: number;
    nitpicksCount: number;
  };
}
