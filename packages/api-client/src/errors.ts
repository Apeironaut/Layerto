import type { ApiError } from '@layerto/types';

function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    typeof (err as ApiError).error?.message === 'string'
  );
}

/** The API's error code (e.g. "insufficient_balance"), if the error came from the API. */
export function errorCode(err: unknown): string | undefined {
  return isApiError(err) ? err.error.code : undefined;
}

/**
 * A message that is safe to show a person. API errors use the server's message;
 * network failures get a clear connection message; anything else uses `fallback`.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) return err.error.message;
  if (err instanceof TypeError) return "Can't reach the Layerto API. Check your connection and try again.";
  return fallback;
}
