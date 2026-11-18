import { Hono } from 'hono';
import type {
  CompetitionResponse,
  ErrorResponse,
  RankingsResponse,
  VoteCountsResponse,
  VoteResponse,
} from '../../shared/api';
import { isRankingPeriod } from '../../shared/api';
import { getRankings } from '../core/rankings';
import {
  getCompetition,
  getVoteCounts,
  submitVote,
  VoteError,
} from '../core/competition';

export const api = new Hono();

const serverError = (message: string): ErrorResponse => ({
  status: 'error',
  code: 'SERVER_ERROR',
  message,
});

/** GET /api/rankings?period=week|month */
api.get('/rankings', async (c) => {
  const period = c.req.query('period') ?? 'week';
  if (!isRankingPeriod(period)) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'period must be "week" or "month"',
      },
      400
    );
  }

  try {
    return c.json<RankingsResponse>(await getRankings(period));
  } catch (error) {
    console.error(`Failed to load ${period} rankings`, error);
    return c.json<ErrorResponse>(serverError('Could not load rankings.'), 500);
  }
});

/** GET /api/competition – entries, vote counts and the viewer's vote state. */
api.get('/competition', async (c) => {
  try {
    return c.json<CompetitionResponse>(await getCompetition());
  } catch (error) {
    console.error('Failed to load competition', error);
    return c.json<ErrorResponse>(
      serverError('Could not load competition entries.'),
      500
    );
  }
});

/** GET /api/competition/votes – live counts and the viewer's vote state. */
api.get('/competition/votes', async (c) => {
  try {
    return c.json<VoteCountsResponse>(await getVoteCounts());
  } catch (error) {
    console.error('Failed to load vote counts', error);
    return c.json<ErrorResponse>(serverError('Could not load votes.'), 500);
  }
});

/** POST /api/competition/vote { postId } */
api.post('/competition/vote', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }
  const postId =
    typeof body === 'object' && body !== null && 'postId' in body
      ? body.postId
      : undefined;

  try {
    return c.json<VoteResponse>(await submitVote(postId));
  } catch (error) {
    if (error instanceof VoteError) {
      return c.json<ErrorResponse>(
        { status: 'error', code: error.code, message: error.message },
        error.httpStatus
      );
    }
    console.error('Failed to record vote', error);
    return c.json<ErrorResponse>(
      serverError('Your vote could not be recorded. Please try again.'),
      500
    );
  }
});
