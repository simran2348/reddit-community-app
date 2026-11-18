import { memo } from 'react';

export type VoteButtonState =
  | 'ready'
  | 'pending'
  | 'voted'
  | 'own'
  | 'used'
  | 'logged-out';

const LABELS: Record<VoteButtonState, string> = {
  ready: 'Vote',
  pending: 'Voting…',
  voted: '✓ Voted',
  own: 'Your entry',
  used: 'Vote used',
  'logged-out': 'Log in to vote',
};

type VoteButtonProps = {
  state: VoteButtonState;
  onVote: () => void;
};

export const VoteButton = memo(({ state, onVote }: VoteButtonProps) => (
  <button
    type="button"
    className={`button vote-button vote-button--${state}`}
    onClick={onVote}
    disabled={state !== 'ready'}
    aria-pressed={state === 'voted'}
    aria-busy={state === 'pending'}
  >
    {LABELS[state]}
  </button>
));
VoteButton.displayName = 'VoteButton';
