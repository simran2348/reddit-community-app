import type { WinnersResponse } from '../../shared/api';
import { requestJson } from './http';

export const fetchWinners = (): Promise<WinnersResponse> =>
  requestJson<WinnersResponse>('/api/winners');
