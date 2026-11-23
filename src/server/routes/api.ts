import { Hono } from 'hono';
import type { Context } from 'hono';
import type {
  CommunityResponse,
  CompetitionResponse,
  ConfigResponse,
  ErrorResponse,
  JoinResponse,
  PreferencesResponse,
  WinnersResponse,
  RankingsResponse,
} from '../../shared/api';
import { isRankingPeriod, parsePreferences } from '../../shared/api';
import { getPreferences, savePreferences } from '../core/preferences';
import { getCompetitionWindow, listWinners } from '../core/winners';
import { getCommunity, joinCommunity } from '../core/community';
import { getRankings } from '../core/rankings';
import { getCommunitySettings } from '../core/settings';
import { getSourceSubreddit } from '../core/source';
import { CompetitionError, getCompetition } from '../core/competition';

export const api = new Hono();

/** Maps known errors to their status; anything else becomes a logged 500. */
const handleError = (c: Context, error: unknown, fallback: string) => {
  if (error instanceof CompetitionError) {
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

/** GET /api/winners – saved competition and monthly winners, newest first. */
api.get('/winners', async (c) => {
  try {
    return c.json<WinnersResponse>({ records: await listWinners() });
  } catch (error) {
    return handleError(c, error, 'Could not load winners.');
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
    // Joining runs as the user (asUser SUBSCRIBE_TO_SUBREDDIT); Reddit can
    // refuse it (permission not granted yet, unsupported client, ...). The
    // client then opens the subreddit so they can join with Reddit's button.
    console.error('[community] join failed', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        code: 'JOIN_UNAVAILABLE',
        message: 'Joining from here is not available right now.',
      },
      503
    );
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

/** GET /api/competition – entries (by Reddit upvotes) and the theme. */
api.get('/competition', async (c) => {
  try {
    const window = await getCompetitionWindow(await getCommunitySettings());
    return c.json<CompetitionResponse>(await getCompetition(window));
  } catch (error) {
    return handleError(c, error, 'Could not load competition entries.');
  }
});
