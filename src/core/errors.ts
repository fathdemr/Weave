/**
 * Error codes shared across every context (background, content, options).
 *
 * Codes are stable identifiers: the UI maps them to human readable, localized
 * strings. Never show a raw provider message to the user without a code.
 */
export const ErrorCode = {
  /** Something we did not anticipate. */
  UNKNOWN: 'UNKNOWN',
  /** The feature exists in the protocol but is not implemented yet. */
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  /** The message envelope was malformed or the type is unknown. */
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  /** No handler is registered for the requested message type. */
  NO_HANDLER: 'NO_HANDLER',
  /** The user has not configured an API key yet. */
  MISSING_API_KEY: 'MISSING_API_KEY',
  /** The provider rejected the request (bad key, bad model, bad payload). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** The provider is rate limiting us; retrying later may succeed. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** The request could not reach the provider (offline, DNS, CORS). */
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** A serializable error. Anything crossing a message port must survive JSON. */
export interface WeaveErrorPayload {
  code: ErrorCode;
  message: string;
  /** Whether retrying the exact same request could plausibly succeed. */
  retryable: boolean;
}

export class WeaveError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'WeaveError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }

  toPayload(): WeaveErrorPayload {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }

  /** Normalizes anything thrown into a WeaveError so callers get one shape. */
  static from(error: unknown): WeaveError {
    if (error instanceof WeaveError) return error;
    if (error instanceof Error) {
      return new WeaveError(ErrorCode.UNKNOWN, error.message, { cause: error });
    }
    return new WeaveError(ErrorCode.UNKNOWN, String(error));
  }
}
