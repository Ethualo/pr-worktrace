export interface GithubClient {
  pulls: {
    get(params: {
      owner: string;
      repo: string;
      pull_number: number;
      mediaType?: { format: string };
    }): Promise<{ data: unknown }>;
    createReviewComment(params: {
      owner: string;
      repo: string;
      pull_number: number;
      commit_id: string;
      path: string;
      line: number;
      body: string;
    }): Promise<{ data: { id: number } }>;
    listReviewComments?(params: {
      owner: string;
      repo: string;
      pull_number: number;
    }): Promise<{ data: Array<{ id: number; body: string; in_reply_to_id?: number; path?: string; line?: number | null }> }>;
    createReplyForReviewComment?(params: {
      owner: string;
      repo: string;
      pull_number: number;
      comment_id: number;
      body: string;
    }): Promise<{ data: { id: number } }>;
  };
  reactions: {
    listForPullRequestReviewComment(params: {
      owner: string;
      repo: string;
      comment_id: number;
    }): Promise<{ data: Array<{ content: string }> }>;
  };
  repos: {
    createOrUpdateFileContents(params: {
      owner: string;
      repo: string;
      path: string;
      message: string;
      content: string;
      branch: string;
      sha?: string;
    }): Promise<{ data: unknown }>;
    getContent?(params: { owner: string; repo: string; path: string }): Promise<{ data: { sha: string } }>;
  };
}

export interface PostedComment {
  issueId: string;
  commentId: number;
}

export interface ReactionSummary {
  commentId: number;
  thumbsUp: number;
  thumbsDown: number;
}
