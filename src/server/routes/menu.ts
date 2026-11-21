import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { getCommunitySettings } from '../core/settings';
import { runWinnerChecks } from '../core/winners';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

/** Moderator menu: run the hourly winner checks right away. */
menu.post('/winner-checks', async (c) => {
  try {
    const results = await runWinnerChecks();
    return c.json<UiResponse>({ showToast: results.join(' · ') }, 200);
  } catch (error) {
    console.error('[winners] manual check failed', error);
    return c.json<UiResponse>({ showToast: 'Winner checks failed' }, 400);
  }
});

/**
 * Moderator menu: end the running competition early. Asks for confirmation
 * first; the form's submit handler (routes/forms.ts) does the ending.
 */
menu.post('/end-competition', async (c) => {
  try {
    const settings = await getCommunitySettings();
    if (!settings.competitionEnabled) {
      return c.json<UiResponse>(
        { showToast: 'No competition is running right now.' },
        200
      );
    }
    const theme = settings.competitionTheme ?? 'The competition';
    const schedule = settings.competitionEndDate
      ? `It was set to end on ${settings.competitionEndDate}; that date is ignored from now on.`
      : 'It has no end date.';
    return c.json<UiResponse>(
      {
        showForm: {
          name: 'endCompetition',
          form: {
            title: 'End competition now?',
            description:
              `"${theme}" ends now. ${schedule} The top entry by upvotes wins and gets the winner flair, ` +
              'and the top 10 are saved to Winners. New posts stop counting. This cannot be undone.',
            fields: [],
            acceptLabel: 'End now',
            cancelLabel: 'Cancel',
          },
        },
      },
      200
    );
  } catch (error) {
    console.error('[competition] end menu failed', error);
    return c.json<UiResponse>(
      { showToast: 'Could not load the competition.' },
      400
    );
  }
});
