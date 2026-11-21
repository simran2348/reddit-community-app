import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WinnerEntry, WinnerRecord } from '../../shared/api';
import { Carousel } from '../components/Carousel';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MIN_LOADING_MS,
} from '../components/States';
import { WinnerCard } from '../components/WinnerCard';
import { useMinimumDuration } from '../hooks/useMinimumDuration';
import { preloadImages } from '../preloadImages';
import { fetchWinners } from '../services/winnersService';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; records: WinnerRecord[] };

type Kind = WinnerRecord['kind'];

const KINDS: readonly { value: Kind; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'competition', label: 'Theme' },
];

const getKey = (entry: WinnerEntry) => entry.id;
const renderEntry = (entry: WinnerEntry) => <WinnerCard entry={entry} />;

/**
 * Winners: a top panel with a Monthly / Theme switch and a dropdown of that
 * type's awards (newest first), then the chosen award's posts in the
 * carousel: one for a month, the top 10 for a competition theme.
 */
export const WinnersScreen = () => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Chosen tab (null = whichever has the newest award) and the chosen
  // award within each tab (null = its newest).
  const [kind, setKind] = useState<Kind | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<Kind, string | null>>({
    monthly: null,
    competition: null,
  });
  const selectId = useId();

  useEffect(() => {
    let cancelled = false;
    fetchWinners()
      .then(async ({ records }) => {
        // Keep the loader up until the newest award's images are ready.
        await preloadImages(
          records[0]?.entries.map((entry) => entry.imageUrl) ?? []
        );
        if (!cancelled) setState({ status: 'success', records });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Could not load winners.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const showLoader = useMinimumDuration(
    state.status === 'loading',
    MIN_LOADING_MS
  );

  const records = useMemo(
    () =>
      state.status === 'success'
        ? state.records.filter((record) => record.entries.length > 0)
        : [],
    [state]
  );
  const byKind: Record<Kind, WinnerRecord[]> = {
    monthly: records.filter((r) => r.kind === 'monthly'),
    competition: records.filter((r) => r.kind === 'competition'),
  };
  const activeKind: Kind = kind ?? records[0]?.kind ?? 'monthly';
  const options = byKind[activeKind];
  const selected =
    options.find((record) => record.id === selectedIds[activeKind]) ??
    options[0] ??
    null;

  return (
    <section
      className="screen screen--winners"
      id="panel-winners"
      aria-label="Winners"
    >
      <div className="screen__body">
        {showLoader && <LoadingState label="Loading winners" />}
        {!showLoader && state.status === 'error' && (
          <ErrorState message={state.message} onRetry={retry} />
        )}
        {!showLoader && state.status === 'success' && records.length === 0 && (
          <EmptyState icon="👑" title="No winners yet" />
        )}
        {!showLoader && records.length > 0 && (
          <>
            <div className="winners__panel">
              <div
                className="toggle-group toggle-group--small winners__kinds"
                role="radiogroup"
                aria-label="Winner type"
              >
                {KINDS.map((option) => {
                  const isSelected = activeKind === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`toggle-group__option${isSelected ? ' is-selected' : ''}`}
                      onClick={() => setKind(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="winners__picker">
                <label className="visually-hidden" htmlFor={selectId}>
                  {activeKind === 'monthly'
                    ? 'Choose a month'
                    : 'Choose a theme'}
                </label>
                <select
                  id={selectId}
                  className="winners__select"
                  value={selected?.id ?? ''}
                  disabled={options.length === 0}
                  onChange={(event) =>
                    setSelectedIds((current) => ({
                      ...current,
                      [activeKind]: event.target.value,
                    }))
                  }
                >
                  {options.length === 0 && (
                    <option value="">
                      {activeKind === 'monthly'
                        ? 'No monthly winners yet'
                        : 'No theme winners yet'}
                    </option>
                  )}
                  {options.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="winners__chevron"
                  size={16}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </div>
            </div>

            {selected ? (
              <Carousel
                key={selected.id}
                items={selected.entries}
                getKey={getKey}
                renderItem={renderEntry}
                label="winner"
              />
            ) : (
              <EmptyState
                icon={activeKind === 'monthly' ? '📅' : '🏆'}
                title={
                  activeKind === 'monthly'
                    ? 'No monthly winners yet'
                    : 'No theme winners yet'
                }
              />
            )}
          </>
        )}
      </div>
    </section>
  );
};
