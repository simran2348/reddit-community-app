import { memo, useEffect, useRef, useState } from 'react';
import type { RankingPeriod } from '../../shared/api';
import { SLIDESHOW_OPTIONS } from '../preferences';
import { CommunityCard } from './CommunityCard';
import type { Preferences } from '../preferences';

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  prefs: Preferences;
  onChange: (changes: Partial<Preferences>) => void;
};

const PERIODS: readonly { value: RankingPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

/**
 * Settings screen: opens in place like the other tabs, over a dark
 * see-through backdrop (inside the splash box; it never navigates or opens
 * expanded mode).
 */
export const SettingsPanel = memo(
  ({ open, onClose, prefs, onChange }: SettingsPanelProps) => {
    const panelRef = useRef<HTMLDivElement>(null);
    // Community info is only fetched once the screen is first opened.
    const [visited, setVisited] = useState(open);
    if (open && !visited) setVisited(true);

    useEffect(() => {
      if (!open) return;
      panelRef.current?.focus({ preventScroll: true });
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    return (
      <div
        className={`settings${open ? ' is-open' : ''}`}
        ref={panelRef}
        tabIndex={-1}
        role="region"
        aria-label="Settings"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="settings__body">
          {visited && (
            <CommunityCard>
              <div className="settings__options">
                <div className="settings__row">
                  <p className="settings__label" id="period-heading">
                    Top posts
                  </p>
                  <div
                    className="toggle-group toggle-group--small"
                    role="radiogroup"
                    aria-labelledby="period-heading"
                  >
                    {PERIODS.map((option) => {
                      const selected = prefs.period === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`toggle-group__option${selected ? ' is-selected' : ''}`}
                          onClick={() => onChange({ period: option.value })}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="settings__row">
                  <p className="settings__label" id="slideshow-heading">
                    Slideshow Interval
                  </p>
                  <div
                    className="toggle-group toggle-group--small"
                    role="radiogroup"
                    aria-labelledby="slideshow-heading"
                  >
                    {SLIDESHOW_OPTIONS.map((seconds) => {
                      const selected = prefs.slideshowSeconds === seconds;
                      return (
                        <button
                          key={seconds}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`Every ${seconds} seconds`}
                          className={`toggle-group__option${selected ? ' is-selected' : ''}`}
                          onClick={() =>
                            onChange({ slideshowSeconds: seconds })
                          }
                        >
                          {seconds}s
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CommunityCard>
          )}
        </div>
      </div>
    );
  }
);
SettingsPanel.displayName = 'SettingsPanel';
