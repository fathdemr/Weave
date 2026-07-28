import type { PublicSettings, SettingsPatch } from '../settings/schema';

/**
 * Marks an envelope as ours so we ignore messages sent by other extensions
 * or by page scripts that happen to share the same runtime.
 */
export const CHANNEL = 'weave' as const;

/** Shape every message travelling over `chrome.runtime` uses. */
export interface Envelope<TType extends string = string, TPayload = unknown> {
  channel: typeof CHANNEL;
  type: TType;
  payload: TPayload;
}

/** A message contract: what the sender provides and what it gets back. */
export interface MessageContract {
  request: unknown;
  response: unknown;
}

export type MessageSchema = Record<string, MessageContract>;

export interface PongResponse {
  /** Extension version from the manifest. */
  version: string;
  /** Whether the worker is initialized and able to serve requests. */
  ready: boolean;
}

export interface TranslateTextRequest {
  /** Text segments in document order. Order is preserved in the response. */
  segments: string[];
  /** Overrides the configured target language for this request only. */
  targetLanguage?: string;
}

export interface TranslateTextResponse {
  /** Translated segments, index-aligned with the request. */
  segments: string[];
}

export interface PageInfo {
  url: string;
  title: string;
  /** Value of `<html lang>`, empty when the page does not declare one. */
  declaredLanguage: string;
  /** Short excerpt used later for domain detection. Never sent anywhere yet. */
  excerpt: string;
}

/** Messages any context may send to the service worker. */
export interface BackgroundMessages extends MessageSchema {
  /** Liveness probe — also used by the options page to show worker status. */
  ping: { request: void; response: PongResponse };
  'settings:get': { request: void; response: PublicSettings };
  'settings:update': { request: SettingsPatch; response: PublicSettings };
  /** Not implemented until Phase 1; the contract is fixed now. */
  'translate:text': { request: TranslateTextRequest; response: TranslateTextResponse };
}

/** Messages the service worker may send into a tab's content script. */
export interface TabMessages extends MessageSchema {
  'page:describe': { request: void; response: PageInfo };
  /** Asks the content script to translate the current page or selection. */
  'page:translate': { request: { selectionOnly: boolean }; response: { started: boolean } };
}

export function createEnvelope<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
): Envelope<TType, TPayload> {
  return { channel: CHANNEL, type, payload };
}

export function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Envelope).channel === CHANNEL &&
    typeof (value as Envelope).type === 'string'
  );
}
