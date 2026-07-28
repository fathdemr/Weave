import { createLogger } from '../logger';
import { DEFAULT_SETTINGS, type SettingsPatch, type StoredSettings } from './schema';

const log = createLogger('settings');

/** Single storage key: settings are read and written as one object. */
const STORAGE_KEY = 'weave:settings';

/**
 * Reads settings, filling in defaults for anything missing.
 *
 * Callers in the service worker may use this freely; anything outside the
 * worker must go through the `settings:get` message so the API key stays put.
 */
export async function readSettings(): Promise<StoredSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<StoredSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

/** Merges a patch into the stored settings and returns the new state. */
export async function writeSettings(patch: SettingsPatch): Promise<StoredSettings> {
  const next: StoredSettings = { ...(await readSettings()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  log.debug('settings updated', Object.keys(patch));
  return next;
}

/** Resets everything, including the API key. */
export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
