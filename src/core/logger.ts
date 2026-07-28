/**
 * Tiny namespaced logger.
 *
 * Debug output is stripped from production builds so a released extension stays
 * quiet in the user's console. Never log page content or the API key.
 */
const isDev = import.meta.env.DEV;

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[weave:${scope}]`;
  return {
    debug: (...args) => {
      if (isDev) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (isDev) console.info(prefix, ...args);
    },
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
