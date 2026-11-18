import { memo, useEffect, useRef } from 'react';
import type { ImageLayout } from '../preferences';

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  layout: ImageLayout;
  onLayoutChange: (layout: ImageLayout) => void;
  subreddit: string | undefined;
  competitionEnabled: boolean;
};

const LAYOUTS: readonly {
  value: ImageLayout;
  title: string;
  description: string;
}[] = [
  {
    value: 'overlay',
    title: 'Details on image',
    description: 'Avatar, title, upvotes and comments over the photo.',
  },
  {
    value: 'reveal',
    title: 'Swipe up to reveal',
    description: 'Swipe the photo up (or tap ↑) to see details below it.',
  },
];

/** Tiny illustration of each layout for the option cards. */
const LayoutPreview = ({ layout }: { layout: ImageLayout }) => (
  <span
    className={`layout-preview layout-preview--${layout}`}
    aria-hidden="true"
  >
    <span className="layout-preview__details">
      <span className="layout-preview__dot" />
      <span className="layout-preview__lines">
        <span />
        <span />
      </span>
    </span>
    <span className="layout-preview__photo" />
  </span>
);

/**
 * Full-height settings screen that slides in over the dashboard (inside the
 * splash box; it never navigates or opens expanded mode).
 */
export const SettingsPanel = memo(
  ({
    open,
    onClose,
    layout,
    onLayoutChange,
    subreddit,
    competitionEnabled,
  }: SettingsPanelProps) => {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (!open) return;
      closeRef.current?.focus({ preventScroll: true });
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const where = subreddit ? ` in r/${subreddit}` : '';

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
            <h3 className="settings__heading">About</h3>
            <p className="settings__text">
              Top posts shows the 10 most upvoted image posts{where} from this
              week or this month. Rankings refresh every 10 minutes.
            </p>
            {competitionEnabled && (
              <p className="settings__text">
                In the Photo Competition you get one vote per photo and can't
                vote for your own.
              </p>
            )}
          </section>

          <section className="settings__section">
            <h3 className="settings__heading" id="layout-heading">
              Image layout
            </h3>
            <div
              className="layout-options"
              role="radiogroup"
              aria-labelledby="layout-heading"
            >
              {LAYOUTS.map((option) => {
                const selected = layout === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`layout-option${selected ? ' is-selected' : ''}`}
                    onClick={() => onLayoutChange(option.value)}
                  >
                    <LayoutPreview layout={option.value} />
                    <span className="layout-option__title">{option.title}</span>
                    <span className="layout-option__description">
                      {option.description}
                    </span>
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
