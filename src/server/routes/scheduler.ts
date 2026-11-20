import { Hono } from 'hono';
import { catchUpEntries } from '../core/competition';

export const scheduler = new Hono();

/**
 * Every 15 minutes (see `scheduler.tasks` in devvit.json): picks up
 * competition entries whose post trigger failed or was missed.
 */
scheduler.post('/competition-catch-up', async (c) => {
  try {
    await catchUpEntries();
  } catch (error) {
    console.error('[competition] catch-up failed', error);
  }
  return c.json({}, 200);
});
