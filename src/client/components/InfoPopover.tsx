import { memo, useCallback, useId, useRef, useState } from 'react';
import { useDismiss } from '../hooks/useDismiss';

type InfoPopoverProps = {
  title: string;
  text: string;
};

/**
 * ⓘ button that opens a small animated panel. Closes on outside tap or
 * Escape. Listeners live on this iframe's document only, never on Reddit's.
 */
export const InfoPopover = memo(({ title, text }: InfoPopoverProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  return (
    <div className="info" ref={rootRef}>
      <button
        type="button"
        className={`info__button${open ? ' is-open' : ''}`}
        aria-label={open ? 'Hide info' : 'How this works'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="7.75" r="0.6" fill="currentColor" />
        </svg>
      </button>
      <div
        id={panelId}
        className={`info__panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
      >
        <p className="info__title">{title}</p>
        <p className="info__text">{text}</p>
      </div>
    </div>
  );
});
InfoPopover.displayName = 'InfoPopover';
