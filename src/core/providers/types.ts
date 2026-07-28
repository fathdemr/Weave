import type { ProviderId } from '../settings/schema';

/**
 * Context handed to a provider alongside the text to translate.
 *
 * Neighbouring paragraphs and glossary terms are what keep the output faithful
 * to the document instead of word-by-word; they arrive in Phase 2 but the shape
 * is fixed now so adapters do not have to change later.
 */
export interface TranslationContext {
  sourceLanguage: string;
  targetLanguage: string;
  /** Text immediately before the segments, for continuity. */
  precedingText?: string;
  /** Text immediately after the segments, for continuity. */
  followingText?: string;
  /** Domain-specific term mappings, e.g. `{ "commit": "commit" }`. */
  glossary?: Record<string, string>;
  /** Detected page domain, e.g. `software`, `medical`. */
  domain?: string;
}

export interface TranslationRequest {
  /** Segments in document order. Adapters must preserve the order. */
  segments: string[];
  context: TranslationContext;
  /** Aborts the in-flight provider call when the user navigates away. */
  signal?: AbortSignal;
}

export interface TranslationResult {
  /** Translated segments, index-aligned with the request. */
  segments: string[];
  /** Token usage when the provider reports it — used for cost display. */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Contract every AI backend implements.
 *
 * Adding a provider means implementing this interface and registering it — no
 * other part of the codebase should need to change. Adapters run exclusively in
 * the service worker; they are the only code that ever sees the API key.
 */
export interface TranslationProvider {
  readonly id: ProviderId;
  /** Human readable name shown in the options page. */
  readonly label: string;
  /** Model identifiers the adapter is known to work with. */
  readonly supportedModels: readonly string[];
  /** URL where a user can obtain an API key. */
  readonly apiKeyUrl: string;

  translate(request: TranslationRequest, config: ProviderConfig): Promise<TranslationResult>;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  /** Overrides the endpoint — used by OpenAI-compatible local runtimes. */
  baseUrl?: string;
}
