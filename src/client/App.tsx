import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import type { NavTarget } from './components/BottomNav';
import { SettingsPanel } from './components/SettingsPanel';
import { EmptyState } from './components/States';
import { PERIOD_LABEL } from './periods';
import { usePreferences } from './preferences';
import { CompetitionScreen } from './screens/CompetitionScreen';
import { TopImagesScreen } from './screens/TopImagesScreen';
import { fetchConfig } from './services/configService';

type Section = 'images' | 'competition';

/**
 * Splash-only dashboard with a bottom navigation bar: rankings, competition
 * and settings. Everything is local React state: no expanded mode, no page
 * navigation, and no interference with Reddit's scrolling. Screens stay
 * mounted after their first visit so switching keeps carousel position and
 * avoids refetching.
 */
export const App = () => {
  const [section, setSection] = useState<Section>('images');
  const [competitionEnabled, setCompetitionEnabled] = useState(false);
  const [competitionVisited, setCompetitionVisited] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { prefs, update } = usePreferences();

  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then((config) => {
        if (cancelled) return;
        setCompetitionEnabled(config.competitionEnabled);
      })
      .catch((error: unknown) => {
        // Rankings still work; the competition just shows as not running.
        console.warn('Failed to load config', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectNav = useCallback((target: NavTarget) => {
    if (target === 'settings') {
      setSettingsOpen((open) => !open);
      return;
    }
    setSettingsOpen(false);
    setSection(target);
    if (target === 'competition') setCompetitionVisited(true);
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const navActive: NavTarget = settingsOpen ? 'settings' : section;

  return (
    <div
      className={`app app--${section}${settingsOpen ? ' app--settings-open' : ''}`}
    >
      <div className="app__content">
        <div className="app__main" inert={settingsOpen}>
          <div className="app__screens">
            <div className="app__screen" hidden={section !== 'images'}>
              <TopImagesScreen
                period={prefs.period}
                slideshowMs={prefs.slideshowSeconds * 1000}
                paused={settingsOpen || section !== 'images'}
              />
            </div>
            {competitionVisited && (
              <div className="app__screen" hidden={section !== 'competition'}>
                {competitionEnabled ? (
                  <CompetitionScreen
                    isActive={section === 'competition' && !settingsOpen}
                  />
                ) : (
                  <EmptyState
                    icon="🏆"
                    title="No competition right now"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <SettingsPanel
          open={settingsOpen}
          onClose={closeSettings}
          prefs={prefs}
          onChange={update}
        />
      </div>

      <BottomNav
        active={navActive}
        periodLabel={PERIOD_LABEL[prefs.period]}
        competitionLive={competitionEnabled}
        competitionPulse={competitionEnabled && navActive !== 'competition'}
        onSelect={selectNav}
      />
    </div>
  );
};
