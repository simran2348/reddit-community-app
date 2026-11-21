import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import { ExternalLink, Info } from 'lucide-react';
import type { CompetitionTheme } from '../../shared/api';

/**
 * Orange info button in the competition screen's top-right corner. Opens a
 * modal (grows from the centre, and shrinks back on close) over a dark backdrop that covers the screen
 * but not the bottom nav. Shows the theme and description set by mods in the
 * app settings, plus a button to the competition post with the full rules.
 * Closes on a tap outside the box, Esc, or switching tabs. The ⓘ button
 * hides while the modal is open. Hidden entirely when nothing is set.
 */
type ThemeInfoProps = {
  theme: CompetitionTheme;
  /** False when another tab is showing: the modal closes straight away. */
  active: boolean;
};

export const ThemeInfo = memo(({ theme, active }: ThemeInfoProps) => {
  // 'closing' plays the shrink animation before the modal is removed.
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = phase === 'open';

  // Leaving the tab closes the modal at once (no animation: it's hidden).
  if (!active && phase !== 'closed') setPhase('closed');
  const close = useCallback(
    () => setPhase((current) => (current === 'open' ? 'closing' : current)),
    []
  );

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  if (!theme.title && !theme.description && !theme.postUrl) return null;

  return (
    <>
      <button
        type="button"
        className={`theme-info__button${phase === 'closed' ? '' : ' is-hidden'}`}
        tabIndex={phase === 'closed' ? undefined : -1}
        aria-label="Competition theme"
        aria-haspopup="dialog"
        onClick={() => setPhase('open')}
      >
        <Info
          className="theme-info__glyph"
          size={20}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </button>

      {phase !== 'closed' && (
        <div
          className={`theme-modal${phase === 'closing' ? ' is-closing' : ''}`}
          onAnimationEnd={(event) => {
            // The backdrop's fade-out is the last thing to finish.
            if (phase === 'closing' && event.target === event.currentTarget) {
              setPhase('closed');
            }
          }}
          onPointerDown={(event) => {
            // Tap on the backdrop itself (not inside the box) closes.
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            className="theme-modal__box"
            role="dialog"
            aria-modal="true"
            aria-label={theme.title ?? 'Competition theme'}
            tabIndex={-1}
          >
            <div className="theme-modal__content">
              <p className="theme-modal__label">Theme</p>
              {theme.title && (
                <h3 className="theme-modal__title">{theme.title}</h3>
              )}
              {theme.description && (
                <p className="theme-modal__description">
                  <span className="theme-modal__quote" aria-hidden="true">
                    “
                  </span>
                  {theme.description}
                  <span className="theme-modal__quote" aria-hidden="true">
                    ”
                  </span>
                </p>
              )}
            </div>

            {theme.postUrl && (
              <div className="theme-modal__more">
                <p className="theme-modal__more-text">
                  For more info, visit the competition post
                </p>
                <button
                  type="button"
                  className="theme-modal__link"
                  onClick={() => {
                    if (theme.postUrl) navigateTo(theme.postUrl);
                  }}
                >
                  Competition post
                  <ExternalLink
                    size={15}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});
ThemeInfo.displayName = 'ThemeInfo';
