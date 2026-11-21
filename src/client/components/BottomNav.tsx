import { memo } from 'react';
import { Crown, Podium, Settings, Trophy } from 'lucide-react';

export type NavTarget = 'images' | 'competition' | 'winners' | 'settings';

type BottomNavProps = {
  active: NavTarget;
  /** Current ranking period, shown next to the podium (e.g. "This week"). */
  periodLabel: string;
  /** A competition is running; the competition tab only shows then. */
  competitionLive: boolean;
  /** Pulse behind the trophy: live competition and not on that screen. */
  competitionPulse: boolean;
  onSelect: (target: NavTarget) => void;
};

const ICON_SIZE = 22;

/**
 * Bottom navigation: rankings (podium + current period), competition
 * (trophy, pulsing while live and not open), winners (crown) and settings.
 */
export const BottomNav = memo(
  ({
    active,
    periodLabel,
    competitionLive,
    competitionPulse,
    onSelect,
  }: BottomNavProps) => (
    <nav className="bottom-nav" aria-label="Sections">
      <button
        type="button"
        className={`bottom-nav__item bottom-nav__item--wide${active === 'images' ? ' is-active' : ''}`}
        aria-current={active === 'images' ? 'page' : undefined}
        onClick={() => onSelect('images')}
      >
        <Podium size={ICON_SIZE} aria-hidden="true" />
        <span className="bottom-nav__label">{periodLabel}</span>
      </button>

      {competitionLive && (
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
          <span
            className={`bottom-nav__icon${competitionPulse ? ' is-pulsing' : ''}`}
          >
            <Trophy size={ICON_SIZE} aria-hidden="true" />
          </span>
        </button>
      )}

      <button
        type="button"
        className={`bottom-nav__item${active === 'winners' ? ' is-active' : ''}`}
        aria-current={active === 'winners' ? 'page' : undefined}
        aria-label="Winners"
        onClick={() => onSelect('winners')}
      >
        <Crown size={ICON_SIZE} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`bottom-nav__item${active === 'settings' ? ' is-active' : ''}`}
        aria-current={active === 'settings' ? 'page' : undefined}
        aria-label="Settings"
        onClick={() => onSelect('settings')}
      >
        <Settings size={ICON_SIZE} aria-hidden="true" />
      </button>
    </nav>
  )
);
BottomNav.displayName = 'BottomNav';
