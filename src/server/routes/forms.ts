import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
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
