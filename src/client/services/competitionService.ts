import type { CompetitionResponse, VoteCountsResponse } from '../../shared/api';
import { requestJson } from './http';

export const fetchCompetition = (): Promise<CompetitionResponse> =>
  requestJson<CompetitionResponse>('/api/competition');

export const fetchVoteCounts = (): Promise<VoteCountsResponse> =>
  requestJson<VoteCountsResponse>('/api/competition/votes');
