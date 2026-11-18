import { memo } from 'react';
import type { CSSProperties } from 'react';

const SKELETON_CARDS: readonly {
  position: 'prev' | 'active' | 'next';
  depth: number;
}[] = [
  { position: 'prev', depth: 1 },
  { position: 'active', depth: 0 },
  { position: 'next', depth: 1 },
];

/**
 * Skeleton shaped like the coverflow carousel (same classes, so it matches
 * the real layout at every breakpoint): faded neighbours, a centred card,
 * disabled arrows and a position placeholder.
 */
export const LoadingState = memo(({ label }: { label: string }) => (
  <div className="carousel carousel--skeleton" role="status" aria-label={label}>
    <div className="carousel__frame">
      <div className="carousel__stage">
        <ul className="carousel__cards">
          {SKELETON_CARDS.map(({ position, depth }) => {
            const style: CSSProperties & Record<'--depth', number> = {
              '--depth': depth,
            };
            return (
              <li
                key={position}
                className={`carousel__card is-${position}`}
                style={style}
                aria-hidden="true"
              >
                <span className="skeleton-card" />
              </li>
            );
          })}
        </ul>
      </div>
      <span className="carousel-nav carousel-nav--prev is-skeleton" />
      <span className="carousel-nav carousel-nav--next is-skeleton" />
    </div>
    <span className="carousel-position skeleton-position" aria-hidden="true" />
  </div>
));
LoadingState.displayName = 'LoadingState';

type EmptyStateProps = {
  icon: string;
  title: string;
  message: string;
};

export const EmptyState = memo(({ icon, title, message }: EmptyStateProps) => (
  <div className="state">
    <span className="state__icon" aria-hidden="true">
      {icon}
    </span>
    <p className="state__title">{title}</p>
    <p className="state__message">{message}</p>
  </div>
));
EmptyState.displayName = 'EmptyState';

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export const ErrorState = memo(({ message, onRetry }: ErrorStateProps) => (
  <div className="state" role="alert">
    <span className="state__icon" aria-hidden="true">
      ⚠️
    </span>
    <p className="state__title">Something went wrong</p>
    <p className="state__message">{message}</p>
    <button
      type="button"
      className="button button--secondary"
      onClick={onRetry}
    >
      Try again
    </button>
  </div>
));
ErrorState.displayName = 'ErrorState';
