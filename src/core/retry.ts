import { WeaveError } from './errors';
import { createLogger } from './logger';

const log = createLogger('retry');

export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  /** Delay before the second attempt; doubles from there. */
  baseDelayMs?: number;
  /** Upper bound so a long backoff cannot strand the user. */
  maxDelayMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  attempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

/**
 * Retries an operation while it fails with a retryable error.
 *
 * Provider overload (HTTP 503) and rate limits are routine and usually clear
 * within seconds, so the extension absorbs them instead of surfacing a failure
 * the user can do nothing about. Errors that cannot improve on their own — a
 * rejected key, a malformed request — are rethrown immediately.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts, baseDelayMs, maxDelayMs } = { ...DEFAULTS, ...options };

  for (let attempt = 1; ; attempt++) {
    try {
      return await operation(attempt);
    } catch (caught) {
      const error = WeaveError.from(caught);
      if (!error.retryable || attempt >= attempts) throw error;

      const delay = error.retryAfterMs ?? backoffDelay(attempt, baseDelayMs, maxDelayMs);
      log.debug(`attempt ${attempt} failed (${error.code}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}

/** Exponential backoff with jitter, so parallel callers do not sync up. */
function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
