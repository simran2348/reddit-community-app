import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { getCustomHeader } from '../core/customHeader';
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

/**
 * Moderator menu: upload a custom banner and/or icon for the app's Settings
 * header (PNG, JPG or animated GIF). The submit handler is in forms.ts.
 */
menu.post('/customise-header', async (c) => {
  try {
    const current = await getCustomHeader();
    const state = (custom: string | null) =>
      custom ? 'custom image' : "the subreddit's own";
    return c.json<UiResponse>(
      {
        showForm: {
          name: 'customiseHeader',
          form: {
            title: 'Customise app header',
            description:
              `Changes the banner and icon in the app's Settings screen only (not the subreddit's). ` +
              `Now using: banner = ${state(current.bannerUrl)}, icon = ${state(current.iconUrl)}. ` +
              'Leave a field empty to keep it as it is.',
            fields: [
              {
                type: 'image',
                name: 'banner',
                label: 'Banner (PNG, JPG or GIF)',
                helpText:
                  "Use Reddit's banner size: 1920 × 384 px (5:1), under 2 MB. The app shows it about " +
                  '140 px tall across the post and crops the sides on phones, so keep the important ' +
                  'part in the centre.',
              },
              {
                type: 'image',
                name: 'icon',
                label: 'Icon (PNG, JPG or GIF)',
                helpText:
                  "Use Reddit's icon size: a square 256 × 256 px, under 500 KB. It's shown in a circle, " +
                  'so keep it centred with some space around the edges.',
              },
              {
                type: 'boolean',
                name: 'resetBanner',
                label: "Go back to the subreddit's own banner",
                defaultValue: false,
              },
              {
                type: 'boolean',
                name: 'resetIcon',
                label: "Go back to the subreddit's own icon",
                defaultValue: false,
              },
            ],
            acceptLabel: 'Save',
            cancelLabel: 'Cancel',
          },
        },
      },
      200
    );
  } catch (error) {
    console.error('[header] menu failed', error);
    return c.json<UiResponse>({ showToast: 'Could not open the form.' }, 400);
  }
});
