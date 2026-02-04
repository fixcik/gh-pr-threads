/**
 * GraphQL mutations for PR thread operations
 */

export const REPLY_MUTATION = `
  mutation($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: {
      pullRequestReviewThreadId: $threadId
      body: $body
    }) {
      comment {
        id
        url
      }
    }
  }
`;

export const RESOLVE_MUTATION = `
  mutation($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        isResolved
      }
    }
  }
`;

export const UNRESOLVE_MUTATION = `
  mutation($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) {
      thread {
        isResolved
      }
    }
  }
`;
