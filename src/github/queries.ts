export const THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id isResolved isOutdated path line
            comments(first: 50) {
              pageInfo { hasNextPage endCursor }
              nodes { id body author { login } url createdAt path line }
            }
          }
        }
      }
    }
  }
`;

export const FILES_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        files(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { path additions deletions changeType }
        }
      }
    }
  }
`;

export const REVIEWS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviews(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { author { login } body url state }
        }
      }
    }
  }
`;

export const COMMENTS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        comments(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { id body author { login } url createdAt }
        }
      }
    }
  }
`;

export const META_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        number
        title
        state
        author { login }
        isDraft
        mergeable
      }
    }
  }
`;

export const THREAD_COMMENTS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $threadId: String!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThread(id: $threadId) {
          comments(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { id body author { login } url createdAt path line }
          }
        }
      }
    }
  }
`;
