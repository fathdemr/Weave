/**
 * Languages offered in the options UI.
 *
 * A curated list, not a limitation: settings store plain BCP 47 tags, so any
 * tag keeps working — the options page adds an entry on the fly for a stored
 * tag it does not know. Labels pair the English name with the endonym so
 * users can find their language regardless of the UI language.
 */
export interface Language {
  /** BCP 47 tag sent to the provider. */
  tag: string;
  /** English name — Endonym. */
  label: string;
}

/** Sentinel tag meaning "let the model detect the source language". */
export const AUTO_DETECT = 'auto';

export const LANGUAGES: readonly Language[] = [
  { tag: 'ar', label: 'Arabic — العربية' },
  { tag: 'az', label: 'Azerbaijani — Azərbaycanca' },
  { tag: 'bg', label: 'Bulgarian — Български' },
  { tag: 'zh-Hans', label: 'Chinese (Simplified) — 简体中文' },
  { tag: 'zh-Hant', label: 'Chinese (Traditional) — 繁體中文' },
  { tag: 'cs', label: 'Czech — Čeština' },
  { tag: 'da', label: 'Danish — Dansk' },
  { tag: 'nl', label: 'Dutch — Nederlands' },
  { tag: 'en', label: 'English' },
  { tag: 'fi', label: 'Finnish — Suomi' },
  { tag: 'fr', label: 'French — Français' },
  { tag: 'de', label: 'German — Deutsch' },
  { tag: 'el', label: 'Greek — Ελληνικά' },
  { tag: 'he', label: 'Hebrew — עברית' },
  { tag: 'hi', label: 'Hindi — हिन्दी' },
  { tag: 'hu', label: 'Hungarian — Magyar' },
  { tag: 'id', label: 'Indonesian — Bahasa Indonesia' },
  { tag: 'it', label: 'Italian — Italiano' },
  { tag: 'ja', label: 'Japanese — 日本語' },
  { tag: 'kk', label: 'Kazakh — Қазақша' },
  { tag: 'ko', label: 'Korean — 한국어' },
  { tag: 'no', label: 'Norwegian — Norsk' },
  { tag: 'fa', label: 'Persian — فارسی' },
  { tag: 'pl', label: 'Polish — Polski' },
  { tag: 'pt', label: 'Portuguese — Português' },
  { tag: 'pt-BR', label: 'Portuguese (Brazil) — Português do Brasil' },
  { tag: 'ro', label: 'Romanian — Română' },
  { tag: 'ru', label: 'Russian — Русский' },
  { tag: 'sr', label: 'Serbian — Српски' },
  { tag: 'sk', label: 'Slovak — Slovenčina' },
  { tag: 'es', label: 'Spanish — Español' },
  { tag: 'sv', label: 'Swedish — Svenska' },
  { tag: 'th', label: 'Thai — ไทย' },
  { tag: 'tr', label: 'Turkish — Türkçe' },
  { tag: 'uk', label: 'Ukrainian — Українська' },
  { tag: 'vi', label: 'Vietnamese — Tiếng Việt' },
];
