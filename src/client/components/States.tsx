import { memo } from 'react';

export const LoadingState = memo(({ label }: { label: string }) => (
  <div className="state state--loading" role="status" aria-label={label}>
    <div className="skeleton skeleton--card">
      <div className="skeleton__row">
        <span className="skeleton__block skeleton__block--icon" />
        <span className="skeleton__stack">
          <span className="skeleton__block skeleton__block--line" />
          <span className="skeleton__block skeleton__block--line-short" />
        </span>
      </div>
      <span className="skeleton__block skeleton__block--line" />
      <span className="skeleton__block skeleton__block--line" />
      <span className="skeleton__block skeleton__block--line-short" />
    </div>
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
    <button type="button" className="button button--secondary" onClick={onRetry}>
      Try again
    </button>
  </div>
));
ErrorState.displayName = 'ErrorState';
