import { memo } from 'react';

/** Shortest time the loader stays up, so it never just flickers. */
export const MIN_LOADING_MS = 5000;

/**
 * Loading state: an orange line-art camera, drawn and animated with SVG +
 * CSS (outline traces itself in, lens rings spin), on the same dark card as
 * the empty state, inside the blurred panel.
 */
export const LoadingState = memo(({ label }: { label: string }) => (
  <div className="state" role="status">
    <div className="state__card">
      <span className="visually-hidden">{label}</span>
      <svg
        className="camera-loader"
        viewBox="250 170 300 255"
        aria-hidden="true"
        focusable="false"
      >
        <g className="camera-loader__outline">
          <path
            pathLength={1}
            d="M374 185 H458 Q476 185 483 204 Q490 230 512 230 H518 Q538 230 538 250 V394 Q538 412 520 412 H280 Q262 412 262 394 V250 Q262 230 282 230 H314 Q330 230 337 208 Q344 187 362 185"
          />
          <path
            pathLength={1}
            d="M287 222 V210 Q287 193 301 193 Q315 193 315 210 V222"
          />
          <path pathLength={1} d="M262 280 H322" />
          <path pathLength={1} d="M478 280 H538" />
        </g>
        {/* Ring above the lens: starts as a half arc (left, over the top, to
            the right) and closes. */}
        <g transform="rotate(180 430 222)">
          <circle
            className="camera-loader__ring camera-loader__ring--top"
            cx="430"
            cy="222"
            r="14"
            pathLength={100}
          />
        </g>
        {/* Small ring bottom-left: starts as an open arc and closes. */}
        <g transform="rotate(120 310 383)">
          <circle
            className="camera-loader__ring"
            cx="310"
            cy="383"
            r="17"
            pathLength={100}
          />
        </g>
        <circle
          className="camera-loader__lens camera-loader__lens--outer"
          cx="400"
          cy="317"
          r="67"
          pathLength={100}
        />
        <circle
          className="camera-loader__lens camera-loader__lens--inner"
          cx="400"
          cy="317"
          r="39"
          pathLength={100}
        />
      </svg>
    </div>
  </div>
));
LoadingState.displayName = 'LoadingState';

type EmptyStateProps = {
  icon: string;
  title: string;
};

/** Blurred panel with a small dark card in the middle: icon and title only. */
export const EmptyState = memo(({ icon, title }: EmptyStateProps) => (
  <div className="state">
    <div className="state__card">
      <span className="state__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="state__title">{title}</p>
    </div>
  </div>
));
EmptyState.displayName = 'EmptyState';

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export const ErrorState = memo(({ message, onRetry }: ErrorStateProps) => (
  <div className="state" role="alert">
    <div className="state__card">
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
  </div>
));
ErrorState.displayName = 'ErrorState';
