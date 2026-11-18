import { useCallback, useState } from 'react';
import { context } from '@devvit/web/client';
import { AppHeader } from './components/AppHeader';
import { MainNavigation } from './components/MainNavigation';
import type { Section } from './components/MainNavigation';
import { CompetitionScreen } from './screens/CompetitionScreen';
import { TopAppsScreen } from './screens/TopAppsScreen';

/**
 * Splash-only dashboard. Section switching is local React state: no expanded
 * mode, no page navigation, and no interference with Reddit's scrolling.
 * Screens stay mounted after first visit so switching keeps carousel position
 * and avoids refetching.
 */
export const App = () => {
  const [section, setSection] = useState<Section>('apps');
  const [competitionVisited, setCompetitionVisited] = useState(false);

  const changeSection = useCallback((next: Section) => {
    setSection(next);
    if (next === 'competition') setCompetitionVisited(true);
  }, []);

  return (
    <div className={`app app--${section}`}>
      <div className="app__top">
        <AppHeader subredditName={context.subredditName} />
        <MainNavigation active={section} onChange={changeSection} />
      </div>

      <div className="app__screens">
        <div className="app__screen" hidden={section !== 'apps'}>
          <TopAppsScreen />
        </div>
        {competitionVisited && (
          <div className="app__screen" hidden={section !== 'competition'}>
            <CompetitionScreen isActive={section === 'competition'} />
          </div>
        )}
      </div>
    </div>
  );
};
