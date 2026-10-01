import { HttpErrorResponse } from '@angular/common/http';

export const GENERIC_ERROR_MESSAGE =
  'Something went a little wobbly. Please try again in a moment.';

/**
 * The line to show a player for a failed request. A 4xx response carries a friendly message
 * from the server (a string, or a list whose first entry is used); anything else, such as a
 * dropped connection or a server fault, gets a calm generic line instead.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
    const message: unknown = error.error?.message;
    const first = Array.isArray(message) ? message[0] : message;
    if (typeof first === 'string' && first.trim()) {
      return first;
    }
  }
  return GENERIC_ERROR_MESSAGE;
}

/** True when the request failed with the given HTTP status. */
export function hasStatus(error: unknown, status: number): boolean {
  return error instanceof HttpErrorResponse && error.status === status;
}
