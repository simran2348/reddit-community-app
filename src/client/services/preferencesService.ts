import type { PreferencesResponse, UserPreferences } from '../../shared/api';
import { requestJson } from './http';

export const fetchPreferences = (): Promise<PreferencesResponse> =>
  requestJson<PreferencesResponse>('/api/preferences');

export const savePreferences = (
  preferences: UserPreferences
): Promise<PreferencesResponse> =>
  requestJson<PreferencesResponse>('/api/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
