import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { updateCustomHeader } from '../core/customHeader';
import type { HeaderChange } from '../core/customHeader';
import { isRedditImageUrl } from '../core/rules';
import { endCompetitionEarly, getCommunitySettings } from '../core/settings';
import { checkCompetitionWinner } from '../core/winners';

export const forms = new Hono();

/**
 * "End competition now" confirmed: ends the running competition at this
 * moment (ignoring any later end date) and awards the winner right away.
 */
forms.post('/end-competition', async (c) => {
  try {
    const settings = await getCommunitySettings();
    if (!settings.competitionEnabled) {
      return c.json<UiResponse>(
        { showToast: 'No competition is running right now.' },
        200
      );
    }
    await endCompetitionEarly(settings.competitionKey);
    const result = await checkCompetitionWinner();
    return c.json<UiResponse>(
      {
        showToast: {
          text: `Competition ended. ${result.replace(/^competition: /, '')}`,
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error('[competition] ending early failed', error);
    return c.json<UiResponse>(
      { showToast: 'Could not end the competition.' },
      400
    );
  }
});

/** Reads one submitted form value from the untyped request body. */
const formValue = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null
    ? Reflect.get(body, name)
    : undefined;

/**
 * One image field's change: a new upload wins; otherwise the reset box;
 * otherwise it stays as it is. Only Reddit-hosted uploads are accepted.
 */
const headerChange = (upload: unknown, reset: unknown): HeaderChange =>
  isRedditImageUrl(upload)
    ? { set: upload }
    : reset === true
      ? 'reset'
      : 'keep';

/** "Customise app header" saved. */
forms.post('/customise-header', async (c) => {
  try {
    const body: unknown = await c.req.json().catch(() => null);
    const banner = headerChange(
      formValue(body, 'banner'),
      formValue(body, 'resetBanner')
    );
    const icon = headerChange(
      formValue(body, 'icon'),
      formValue(body, 'resetIcon')
    );
    if (banner === 'keep' && icon === 'keep') {
      return c.json<UiResponse>({ showToast: 'Nothing changed.' }, 200);
    }
    await updateCustomHeader(banner, icon);
    console.log(
      `[header] banner=${JSON.stringify(banner)} icon=${JSON.stringify(icon)}`
    );
    return c.json<UiResponse>(
      {
        showToast: {
          text: 'App header updated. Reload the post to see it.',
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error('[header] save failed', error);
    return c.json<UiResponse>({ showToast: 'Could not save the header.' }, 400);
  }
});
