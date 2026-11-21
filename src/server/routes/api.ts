import { Hono } from 'hono';
import type { Context } from 'hono';
import type {
  CommunityResponse,
  CompetitionResponse,
  ConfigResponse,
  ErrorResponse,
  JoinResponse,
  PreferencesResponse,
  RankingsResponse,
  VoteCountsResponse,
  VoteResponse,
} from '../../shared/api';
import { isRankingPeriod, parsePreferences } from '../../shared/api';
import { getPreferences, savePreferences } from '../core/preferences';
import { getCommunity, joinCommunity } from '../core/community';
import { getRankings } from '../core/rankings';
import { getCommunitySettings } from '../core/settings';
import { getSourceSubreddit } from '../core/source';
import {
  getCompetition,
  getVoteCounts,
  submitVote,
  VoteError,
} from '../core/competition';

export const api = new Hono();

/** Maps known errors to their status; anything else becomes a logged 500. */
const handleError = (c: Context, error: unknown, fallback: string) => {
  if (error instanceof VoteError) {
    return c.json<ErrorResponse>(
      { status: 'error', code: error.code, message: error.message },
      error.httpStatus
    );
  }
  console.error(fallback, error);
  return c.json<ErrorResponse>(
    { status: 'error', code: 'SERVER_ERROR', message: fallback },
    500
  );
};

/** GET /api/config – which sections the client should show. */
api.get('/config', async (c) => {
  try {
    const { competitionEnabled } = await getCommunitySettings();
    return c.json<ConfigResponse>({
      subreddit: getSourceSubreddit(),
      competitionEnabled,
    });
  } catch (error) {
    return handleError(c, error, 'Could not load settings.');
  }
});

/** GET /api/preferences – the viewer's saved Settings choices. */
api.get('/preferences', async (c) => {
  try {
    return c.json<PreferencesResponse>({ preferences: await getPreferences() });
  } catch (error) {
    return handleError(c, error, 'Could not load your settings.');
  }
});

/** PUT /api/preferences – save the viewer's Settings choices. */
api.put('/preferences', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }
  const preferences = parsePreferences(body);
  if (!preferences) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'Invalid settings.',
      },
      400
    );
  }
  try {
    const saved = await savePreferences(preferences);
    return c.json<PreferencesResponse>({
      preferences: saved ? preferences : null,
    });
  } catch (error) {
    return handleError(c, error, 'Could not save your settings.');
  }
});

/** GET /api/community – banner, icon and members for the Settings screen. */
api.get('/community', async (c) => {
  try {
    return c.json<CommunityResponse>(await getCommunity());
  } catch (error) {
    return handleError(c, error, 'Could not load community info.');
  }
});

/** POST /api/community/join – join the community as the viewer. */
api.post('/community/join', async (c) => {
  try {
    const joined = await joinCommunity();
    if (!joined) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          code: 'NOT_LOGGED_IN',
          message: 'Log in to join the community.',
        },
        401
      );
    }
    return c.json<JoinResponse>({ joined: true });
  } catch (error) {
    return handleError(c, error, 'Could not join the community.');
  }
});

/** GET /api/rankings?period=week|month|year – top 10 image posts. */
api.get('/rankings', async (c) => {
  const period = c.req.query('period') ?? 'week';
  if (!isRankingPeriod(period)) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'period must be "week", "month" or "year"',
      },
      400
    );
  }

  try {
    return c.json<RankingsResponse>(await getRankings(period));
  } catch (error) {
    return handleError(c, error, 'Could not load top images.');
  }
});

/** GET /api/competition – entries, vote counts and the viewer's vote state. */
api.get('/competition', async (c) => {
  try {
    return c.json<CompetitionResponse>(await getCompetition());
  } catch (error) {
    return handleError(c, error, 'Could not load competition entries.');
  }
});

/** GET /api/competition/votes – live counts and the viewer's vote state. */
api.get('/competition/votes', async (c) => {
  try {
    return c.json<VoteCountsResponse>(await getVoteCounts());
  } catch (error) {
    return handleError(c, error, 'Could not load votes.');
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
    return handleError(
      c,
      error,
      'Your vote could not be recorded. Please try again.'
    );
  }
});
