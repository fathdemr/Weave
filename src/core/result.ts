import { WeaveError, type WeaveErrorPayload } from './errors';

/**
 * Messages never reject: a failed handler resolves with `ok: false` instead.
 * `chrome.runtime` cannot transport an Error, and an unhandled rejection in the
 * service worker is invisible to the caller, so failures travel as data.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: WeaveErrorPayload };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: unknown): Result<never> {
  return { ok: false, error: WeaveError.from(error).toPayload() };
}

/** Unwraps a Result, rethrowing the failure as a WeaveError. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.data;
  throw new WeaveError(result.error.code, result.error.message, {
    retryable: result.error.retryable,
    retryAfterMs: result.error.retryAfterMs,
  });
}
