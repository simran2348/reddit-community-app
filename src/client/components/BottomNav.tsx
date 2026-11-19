import { memo } from 'react';
import type { SVGProps } from 'react';

export type NavTarget = 'images' | 'competition' | 'settings';

type BottomNavProps = {
  active: NavTarget;
  /** Current ranking period, shown next to the podium (e.g. "This week"). */
  periodLabel: string;
  /** Shows a red dot on the trophy while a competition is running. */
  competitionLive: boolean;
  onSelect: (target: NavTarget) => void;
};

const iconProps: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const PodiumIcon = () => (
  <svg {...iconProps}>
    <path d="M9 21V9h6v12" />
    <path d="M3 21v-7h6" />
    <path d="M15 21v-5h6v5" />
    <path d="M2 21h20" />
    <path d="M12 3.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 5.6l2-.3z" />
  </svg>
);

const TrophyIcon = () => (
  <svg {...iconProps}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
  </svg>
);

const CogIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * Bottom navigation: rankings (podium + current period), competition
 * (trophy, red dot while live) and settings (cog).
 */
export const BottomNav = memo(
  ({ active, periodLabel, competitionLive, onSelect }: BottomNavProps) => (
    <nav className="bottom-nav" aria-label="Sections">
      <button
        type="button"
        className={`bottom-nav__item bottom-nav__item--wide${active === 'images' ? ' is-active' : ''}`}
        aria-current={active === 'images' ? 'page' : undefined}
        onClick={() => onSelect('images')}
      >
        <PodiumIcon />
        <span className="bottom-nav__label">{periodLabel}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav__item${active === 'competition' ? ' is-active' : ''}`}
        aria-current={active === 'competition' ? 'page' : undefined}
        aria-label={
          competitionLive
            ? 'Photo competition (running now)'
            : 'Photo competition'
        }
        onClick={() => onSelect('competition')}
      >
        <span className="bottom-nav__icon">
          <TrophyIcon />
          {competitionLive && (
            <span className="bottom-nav__dot" aria-hidden="true" />
          )}
        </span>
      </button>

      <button
        type="button"
        className={`bottom-nav__item${active === 'settings' ? ' is-active' : ''}`}
        aria-current={active === 'settings' ? 'page' : undefined}
        aria-label="Settings"
        onClick={() => onSelect('settings')}
      >
        <CogIcon />
      </button>
    </nav>
  )
);
BottomNav.displayName = 'BottomNav';
