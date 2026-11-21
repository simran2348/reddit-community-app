/**
 * Shared data models and API contracts between the splash client and the
 * Devvit server. Everything that crosses the network boundary is typed here.
 */

export type RankingPeriod = 'week' | 'month' | 'year';

export const isRankingPeriod = (value: unknown): value is RankingPeriod =>
  value === 'week' || value === 'month' || value === 'year';

export type ConfigResponse = {
  /** Subreddit the app is installed in; all posts are read from here. */
  subreddit: string;
  /** Moderator toggle: shows the Photo Competition tab when true. */
  competitionEnabled: boolean;
};

export type ImageRanking = {
  /** Reddit post ID (t3_...). */
  id: string;
  title: string;
  author: string;
  /** Author's snoovatar, or null when they don't have one. */
  authorAvatarUrl: string | null;
  /** Post image; null for text posts (only when mods include them). */
  imageUrl: string | null;
  /** Start of the post's text, for text posts; null for image posts. */
  body: string | null;
  /** Reddit upvote score of the post. */
  score: number;
  commentCount: number;
  rank: number;
  period: RankingPeriod;
  postUrl: string;
};

export type RankingsResponse = {
  period: RankingPeriod;
  subreddit: string;
  images: ImageRanking[];
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
  subreddit: string;
  /** Entry flair, or null when every image post is an entry. */
  flair: string | null;
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
  | 'COMPETITION_DISABLED'
  | 'NOT_ELIGIBLE'
  | 'OWN_ENTRY'
  | 'ALREADY_VOTED'
  | 'SERVER_ERROR';

export type ErrorResponse = {
  status: 'error';
  code: VoteErrorCode;
  message: string;
};

/** The community the app is installed in, for the Settings screen header. */
export type CommunityResponse = {
  name: string;
  title: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  /** Banner colour, used when there's no banner image. */
  bannerColor: string | null;
  members: number;
  isLoggedIn: boolean;
  /** Joined through this app's button (Reddit doesn't expose membership). */
  joined: boolean;
};

export type JoinResponse = { joined: true };
