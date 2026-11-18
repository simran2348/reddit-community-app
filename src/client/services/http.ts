import type { ErrorResponse } from '../../shared/api';

export class ApiError extends Error {
  readonly code: ErrorResponse['code'];
  readonly status: number;

  constructor(code: ErrorResponse['code'], message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const isErrorResponse = (value: unknown): value is ErrorResponse =>
  typeof value === 'object' &&
  value !== null &&
  'status' in value &&
  value.status === 'error' &&
  'message' in value &&
  typeof value.message === 'string';

/**
 * Thin JSON fetch wrapper for same-origin Devvit `/api` routes. Response
 * shapes are defined in `src/shared/api.ts` and produced by our own server.
 */
export const requestJson = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(
      'SERVER_ERROR',
      'Network error. Check your connection.',
      0
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (isErrorResponse(body)) {
      throw new ApiError(body.code, body.message, response.status);
    }
    throw new ApiError(
      'SERVER_ERROR',
      `Request failed (${response.status}).`,
      response.status
    );
  }

  try {
    const data: T = await response.json();
    return data;
  } catch {
    throw new ApiError('SERVER_ERROR', 'Unexpected server response.', 500);
  }
};
