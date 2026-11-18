/**
 * Shared data models and API contracts between the splash client and the
 * Devvit server. Everything that crosses the network boundary is typed here.
 */

export type RankingPeriod = 'week' | 'month';

export const RANKING_PERIODS: readonly RankingPeriod[] = ['week', 'month'];

export const isRankingPeriod = (value: unknown): value is RankingPeriod =>
  value === 'week' || value === 'month';

export type AppRanking = {
  /** Reddit post ID (t3_...) of the post showcasing the app. */
  id: string;
  name: string;
  description: string;
  author: string;
  iconUrl: string | null;
  /** Reddit upvote score of the showcase post. */
  score: number;
  commentCount: number;
  rank: number;
  period: RankingPeriod;
  postUrl: string;
};

export type RankingsResponse = {
  period: RankingPeriod;
  /** Flair used to pick eligible posts, or null when every post is eligible. */
  flair: string | null;
  apps: AppRanking[];
  generatedAt: string;
};

export type CompetitionEntry = {
  /** Reddit post ID (t3_...); the stable identifier for an entry. */
  id: string;
  title: string;
  author: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  flair: string;
  voteCount: number;
  createdAt: string;
  postUrl: string;
};

export type CompetitionVote = {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
};

export type ViewerVoteState = {
  isLoggedIn: boolean;
  /** Post IDs the current user has already voted for. */
  votedPostIds: string[];
  /** Post IDs the current user authored (cannot vote for their own photo). */
  ownPostIds: string[];
};

export type CompetitionResponse = {
  flair: string;
  /** When true each user gets a single vote across the whole competition. */
  singleVote: boolean;
  entries: CompetitionEntry[];
  viewer: ViewerVoteState;
};

export type VoteCountsResponse = {
  counts: Record<string, number>;
  viewer: ViewerVoteState;
};

export type VoteRequest = {
  postId: string;
};

export type VoteResponse = {
  status: 'ok';
  postId: string;
  voteCount: number;
  viewer: ViewerVoteState;
};

export type VoteErrorCode =
  | 'NOT_LOGGED_IN'
  | 'INVALID_REQUEST'
  | 'NOT_ELIGIBLE'
  | 'OWN_ENTRY'
  | 'ALREADY_VOTED'
  | 'VOTE_LIMIT_REACHED'
  | 'SERVER_ERROR';

export type ErrorResponse = {
  status: 'error';
  code: VoteErrorCode;
  message: string;
};
