/**
 * GitHub GraphQL API types
 * Type definitions for GitHub GraphQL API responses
 */

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface GraphQLError {
  message: string;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

// Repository Pull Request response structure (wrapped in data)
export interface GraphQLPRResponse {
  data: {
    repository: {
      pullRequest: {
        reviewThreads?: {
          nodes: unknown[];
          pageInfo: PageInfo;
        };
        files?: {
          nodes: unknown[];
          pageInfo: PageInfo;
        };
        reviews?: {
          nodes: unknown[];
          pageInfo: PageInfo;
        };
        comments?: {
          nodes: unknown[];
          pageInfo: PageInfo;
        };
      };
    };
  };
}

// Thread comments query response (wrapped in data)
export interface ThreadCommentsData {
  data: {
    repository: {
      pullRequest: {
        reviewThread: {
          comments: {
            nodes: unknown[];
            pageInfo: PageInfo;
          };
        } | null;
      };
    };
  };
}

// Mutation responses
export interface AddReplyMutationData {
  addPullRequestReviewThreadReply?: {
    comment?: {
      url: string;
    };
  };
}

export interface ResolveMutationData {
  resolveReviewThread?: {
    thread?: {
      isResolved: boolean;
    };
  };
}

export interface AddReactionMutationData {
  addReaction?: {
    reaction: {
      id: string;
      content: string;
    };
    subject: {
      id: string;
    };
  };
}

// Meta query response (wrapped in data)
export interface PRMetaData {
  data: {
    repository: {
      pullRequest: {
        number: number;
        title: string;
        state: string;
        isDraft: boolean;
        mergeable: string;
        author: {
          login: string;
          __typename?: string;
        };
        additions: number;
        deletions: number;
      };
    };
  };
}
