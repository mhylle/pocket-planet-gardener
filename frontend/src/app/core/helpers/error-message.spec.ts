import { HttpErrorResponse } from '@angular/common/http';
import { GENERIC_ERROR_MESSAGE, errorMessage, hasStatus } from './error-message';

function response(status: number, error: unknown) {
  return new HttpErrorResponse({ status, error });
}

describe('errorMessage', () => {
  it('shows a 4xx string message verbatim', () => {
    const error = response(400, { statusCode: 400, message: 'Let us pick a kinder name' });

    expect(errorMessage(error)).toBe('Let us pick a kinder name');
  });

  it('shows the first entry of a 4xx message list', () => {
    const error = response(400, { message: ['name is too short', 'name must be a string'] });

    expect(errorMessage(error)).toBe('name is too short');
  });

  it.each([
    ['a server fault', response(500, { message: 'Internal server error' })],
    ['a dropped connection', response(0, new ProgressEvent('error'))],
    ['a 4xx without a message', response(404, null)],
    ['a 4xx with a blank message', response(400, { message: '  ' })],
    ['a non-HTTP error', new Error('boom')],
  ])('falls back to the generic line for %s', (_label, error) => {
    expect(errorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('hasStatus', () => {
  it('matches only HTTP errors with that status', () => {
    expect(hasStatus(response(404, null), 404)).toBe(true);
    expect(hasStatus(response(400, null), 404)).toBe(false);
    expect(hasStatus(new Error('404'), 404)).toBe(false);
  });
});
