/**
 * How a translation is painted onto the page.
 *
 * - `replace`   — the translation takes the original text's place. Clean,
 *                 single-language reading.
 * - `dual-view` — the translation is appended under the original. Ideal for
 *                 comparing, verifying, and language learners.
 *
 * New modes (e.g. hover-to-translate) are added here first; the renderer
 * registry in the content script keys off this union.
 */
export const RenderMode = {
  REPLACE: 'replace',
  DUAL_VIEW: 'dual-view',
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

/** Identifier of a provider adapter registered in `core/providers`. */
export const ProviderId = {
  GEMINI: 'gemini',
} as const;

export type ProviderId = (typeof ProviderId)[keyof typeof ProviderId];

/**
 * Settings that are safe to hand to any context, including content scripts.
 * The API key is deliberately NOT part of this type.
 */
export interface PublicSettings {
  /** BCP 47 tag the page should be translated into. */
  targetLanguage: string;
  /** Source language, or `auto` to let the model detect it. */
  sourceLanguage: string;
  renderMode: RenderMode;
  provider: ProviderId;
  model: string;
  /** Whether a key is configured — the key itself never leaves the worker. */
  hasApiKey: boolean;
}

/**
 * Everything persisted in `chrome.storage.local`.
 *
 * The API key lives under its own top-level field so reads that only need
 * public settings never have to touch it.
 */
export interface StoredSettings extends Omit<PublicSettings, 'hasApiKey'> {
  apiKey: string;
}

export const DEFAULT_SETTINGS: StoredSettings = {
  targetLanguage: 'tr',
  sourceLanguage: 'auto',
  renderMode: RenderMode.DUAL_VIEW,
  provider: ProviderId.GEMINI,
  model: 'gemini-2.0-flash',
  apiKey: '',
};

/** Strips secrets so the result can cross into an untrusted context. */
export function toPublicSettings(settings: StoredSettings): PublicSettings {
  const { apiKey, ...rest } = settings;
  return { ...rest, hasApiKey: apiKey.length > 0 };
}

/** Fields the options page is allowed to change. */
export type SettingsPatch = Partial<StoredSettings>;
