import type { CompetitionResponse } from '../../shared/api';
import { requestJson } from './http';

export const fetchCompetition = (): Promise<CompetitionResponse> =>
  requestJson<CompetitionResponse>('/api/competition');
