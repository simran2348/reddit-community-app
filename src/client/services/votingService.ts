import type { VoteRequest, VoteResponse } from '../../shared/api';
import { requestJson } from './http';

/** Duplicate and eligibility checks happen server-side; see core/competition. */
export const submitVote = (postId: string): Promise<VoteResponse> => {
  const body: VoteRequest = { postId };
  return requestJson<VoteResponse>('/api/competition/vote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};
