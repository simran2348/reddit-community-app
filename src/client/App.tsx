import { useCallback, useEffect, useState } from 'react';
import { MainNavigation } from './components/MainNavigation';
import type { Section } from './components/MainNavigation';
import { SettingsPanel } from './components/SettingsPanel';
import { useImageLayout } from './preferences';
import { CompetitionScreen } from './screens/CompetitionScreen';
import { TopImagesScreen } from './screens/TopImagesScreen';
import { fetchConfig } from './services/configService';

/**
 * Splash-only dashboard. Section switching and the settings screen are local
 * React state: no expanded mode, no page navigation, and no interference with
 * Reddit's scrolling. Screens stay mounted after first visit so switching
 * keeps carousel position and avoids refetching.
 */
export const App = () => {
  const [section, setSection] = useState<Section>('images');
  const [competitionEnabled, setCompetitionEnabled] = useState(false);
  const [competitionVisited, setCompetitionVisited] = useState(false);
  const [subreddit, setSubreddit] = useState<string | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { layout, setLayout } = useImageLayout();

  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then((config) => {
        if (cancelled) return;
        setSubreddit(config.subreddit);
        setCompetitionEnabled(config.competitionEnabled);
      })
      .catch((error: unknown) => {
        // Top Images still works; the competition tab just stays hidden.
        console.warn('Failed to load config', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeSection = useCallback((next: Section) => {
    setSection(next);
    if (next === 'competition') setCompetitionVisited(true);
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const activeSection = competitionEnabled ? section : 'images';

  return (
    <div className={`app app--${activeSection}`}>
      <div className="app__main" inert={settingsOpen}>
        {competitionEnabled && (
          <div className="app__top">
            <MainNavigation active={activeSection} onChange={changeSection} />
          </div>
        )}

        <div className="app__screens">
          <div className="app__screen" hidden={activeSection !== 'images'}>
            <TopImagesScreen layout={layout} onOpenSettings={openSettings} />
          </div>
          {competitionEnabled && competitionVisited && (
            <div
              className="app__screen"
              hidden={activeSection !== 'competition'}
            >
              <CompetitionScreen
                isActive={activeSection === 'competition'}
                onOpenSettings={openSettings}
              />
            </div>
          )}
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={closeSettings}
        layout={layout}
        onLayoutChange={setLayout}
        subreddit={subreddit}
        competitionEnabled={competitionEnabled}
      />
    </div>
  );
};
