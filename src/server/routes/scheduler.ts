import { Hono } from 'hono';
import { finishPendingAnnouncements } from '../core/announcements';
import { catchUpEntries } from '../core/competition';
import { runWinnerChecks } from '../core/winners';

export const scheduler = new Hono();

/**
 * Every 15 minutes (see `scheduler.tasks` in devvit.json): picks up
 * competition entries whose post trigger failed or was missed, and finishes
 * winner announcements Reddit was still processing.
 */
scheduler.post('/competition-catch-up', async (c) => {
  try {
    await catchUpEntries();
  } catch (error) {
    console.error('[competition] catch-up failed', error);
  }
  try {
    // Pins the comment on winner image posts Reddit was still processing.
    await finishPendingAnnouncements();
  } catch (error) {
    console.error('[announce] finishing pending posts failed', error);
  }
  return c.json({}, 200);
});

/**
 * Hourly (see devvit.json): awards a competition whose end date has passed
 * and last month's top post. Each award happens once.
 */
scheduler.post('/winner-checks', async (c) => {
  try {
    await runWinnerChecks();
  } catch (error) {
    console.error('[winners] scheduled check failed', error);
  }
  return c.json({}, 200);
});
