import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '@devvit/web/client';
import type {
  CompetitionEntry,
  CompetitionResponse,
  ViewerVoteState,
} from '../../shared/api';
import { CompetitionCarousel } from '../components/CompetitionCarousel';
import { SettingsButton } from '../components/SettingsButton';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { VoteButtonState } from '../components/VoteButton';
import {
  fetchCompetition,
  fetchVoteCounts,
} from '../services/competitionService';
import { ApiError } from '../services/http';
import { submitVote } from '../services/votingService';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CompetitionResponse };

type CompetitionScreenProps = {
  /** True while this tab is visible; used to refresh live vote counts. */
  isActive: boolean;
  onOpenSettings: () => void;
};

const applyCounts = (
  data: CompetitionResponse,
  counts: Record<string, number>,
  viewer: ViewerVoteState
): CompetitionResponse => ({
  ...data,
  viewer,
  entries: data.entries.map((entry) => ({
    ...entry,
    voteCount: counts[entry.id] ?? 0,
  })),
});

export const CompetitionScreen = ({
  isActive,
  onOpenSettings,
}: CompetitionScreenProps) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchCompetition()
      .then((data) => {
        if (cancelled) return;
        loadedOnce.current = true;
        setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Could not load entries.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** Re-sync vote counts from the server (e.g. after returning to the tab). */
  const refreshCounts = useCallback(async () => {
    try {
      const { counts, viewer } = await fetchVoteCounts();
      setState((prev) =>
        prev.status === 'success'
          ? { status: 'success', data: applyCounts(prev.data, counts, viewer) }
          : prev
      );
    } catch (error) {
      console.warn('Failed to refresh vote counts', error);
    }
  }, []);

  useEffect(() => {
    if (isActive && loadedOnce.current) void refreshCounts();
  }, [isActive, refreshCounts]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const data = state.status === 'success' ? state.data : null;

  const handleVote = useCallback(
    async (postId: string) => {
      if (pendingId) return;
      setPendingId(postId);
      try {
        const result = await submitVote(postId);
        setState((prev) =>
          prev.status === 'success'
            ? {
                status: 'success',
                data: {
                  ...prev.data,
                  viewer: result.viewer,
                  entries: prev.data.entries.map((entry) =>
                    entry.id === result.postId
                      ? { ...entry, voteCount: result.voteCount }
                      : entry
                  ),
                },
              }
            : prev
        );
        showToast('Vote recorded. Thanks for voting!');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Vote failed. Try again.';
        showToast(message);
        // The server is the source of truth: re-sync after a rejected vote.
        if (error instanceof ApiError && error.code === 'ALREADY_VOTED') {
          await refreshCounts();
        }
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, refreshCounts]
  );

  const onVote = useCallback(
    (postId: string) => {
      void handleVote(postId);
    },
    [handleVote]
  );

  const getVoteState = useCallback(
    (entry: CompetitionEntry): VoteButtonState => {
      if (!data) return 'ready';
      const { viewer } = data;
      if (pendingId === entry.id) return 'pending';
      if (viewer.votedPostIds.includes(entry.id)) return 'voted';
      if (!viewer.isLoggedIn) return 'logged-out';
      if (viewer.ownPostIds.includes(entry.id)) return 'own';
      return 'ready';
    },
    [data, pendingId]
  );

  return (
    <section
      className="screen screen--competition"
      id="panel-competition"
      role="tabpanel"
      aria-labelledby="tab-competition"
    >
      <div className="screen__toolbar">
        <p className="screen__heading">Vote for your favourite photo</p>
        <SettingsButton onClick={onOpenSettings} />
      </div>

      <div className="screen__body">
        {state.status === 'loading' && <LoadingState label="Loading entries" />}
        {state.status === 'error' && (
          <ErrorState message={state.message} onRetry={retry} />
        )}
        {data && data.entries.length === 0 && (
          <EmptyState
            icon="📸"
            title="No entries yet"
            message={
              data.flair
                ? `Submit an image post with the "${data.flair}" flair in r/${data.subreddit} to enter.`
                : `No recent image posts in r/${data.subreddit}.`
            }
          />
        )}
        {data && data.entries.length > 0 && (
          <CompetitionCarousel
            entries={data.entries}
            getVoteState={getVoteState}
            onVote={onVote}
          />
        )}
      </div>
    </section>
  );
};
