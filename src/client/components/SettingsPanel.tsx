import { memo, useEffect, useId, useRef } from 'react';
import type { RankingPeriod } from '../../shared/api';
import { AUTOPLAY_OPTIONS } from '../preferences';
import type { Preferences } from '../preferences';

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  prefs: Preferences;
  onChange: (changes: Partial<Preferences>) => void;
};

const PERIODS: readonly { value: RankingPeriod; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

/**
 * Full-height settings screen that slides in over the dashboard (inside the
 * splash box; it never navigates or opens expanded mode).
 */
export const SettingsPanel = memo(
  ({ open, onClose, prefs, onChange }: SettingsPanelProps) => {
    const closeRef = useRef<HTMLButtonElement>(null);
    const autoplayId = useId();

    useEffect(() => {
      if (!open) return;
      closeRef.current?.focus({ preventScroll: true });
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    return (
      <div
        className={`settings${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="settings__header">
          <button
            ref={closeRef}
            type="button"
            className="icon-plain-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 className="settings__title">Settings</h2>
        </div>

        <div className="settings__body">
          <section className="settings__section">
            <h3 className="settings__heading" id="period-heading">
              Top posts
            </h3>
            <div
              className="toggle-group"
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
          </section>

          <section className="settings__section">
            <h3 className="settings__heading">Carousel</h3>
            <label className="checkbox" htmlFor={autoplayId}>
              <input
                id={autoplayId}
                type="checkbox"
                className="checkbox__input"
                checked={prefs.autoplay}
                onChange={(event) =>
                  onChange({ autoplay: event.target.checked })
                }
              />
              <span className="checkbox__box" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="checkbox__label">Auto-play images</span>
            </label>
            <div
              className={`toggle-group toggle-group--small${prefs.autoplay ? '' : ' is-disabled'}`}
              role="radiogroup"
              aria-label="Auto-play interval"
              aria-disabled={!prefs.autoplay}
            >
              {AUTOPLAY_OPTIONS.map((seconds) => {
                const selected = prefs.autoplaySeconds === seconds;
                return (
                  <button
                    key={seconds}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!prefs.autoplay}
                    className={`toggle-group__option${selected ? ' is-selected' : ''}`}
                    onClick={() => onChange({ autoplaySeconds: seconds })}
                  >
                    Every {seconds} sec
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }
);
SettingsPanel.displayName = 'SettingsPanel';
