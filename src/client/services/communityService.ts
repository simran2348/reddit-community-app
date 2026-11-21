import type { CommunityResponse, JoinResponse } from '../../shared/api';
import { requestJson } from './http';

export const fetchCommunity = (): Promise<CommunityResponse> =>
  requestJson<CommunityResponse>('/api/community');

export const joinCommunity = (): Promise<JoinResponse> =>
  requestJson<JoinResponse>('/api/community/join', { method: 'POST' });
