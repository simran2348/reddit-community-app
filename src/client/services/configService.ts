import type { ConfigResponse } from '../../shared/api';
import { requestJson } from './http';

export const fetchConfig = (): Promise<ConfigResponse> =>
  requestJson<ConfigResponse>('/api/config');
