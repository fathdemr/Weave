import { ErrorCode, WeaveError } from '../errors';
import { err, type Result } from '../result';
import {
  createEnvelope,
  type BackgroundMessages,
  type MessageSchema,
  type TabMessages,
} from './protocol';

/**
 * Lets callers omit the payload argument entirely for `void` requests, so
 * `send('ping')` type-checks while `send('settings:update', patch)` still
 * requires its argument.
 */
type PayloadArgs<T> = [T] extends [void] ? [] : [payload: T];

async function send<TSchema extends MessageSchema, TType extends keyof TSchema & string>(
  dispatch: (message: unknown) => Promise<unknown>,
  type: TType,
  payload: TSchema[TType]['request'],
): Promise<Result<TSchema[TType]['response']>> {
  try {
    const response = await dispatch(createEnvelope(type, payload));
    if (response === undefined) {
      // The receiving end is gone: no content script injected, or the worker
      // was torn down before it answered.
      throw new WeaveError(ErrorCode.NO_HANDLER, `No response for "${type}"`, { retryable: true });
    }
    return response as Result<TSchema[TType]['response']>;
  } catch (error) {
    return err(error);
  }
}

/** Sends a message to the service worker from a content script or a page. */
export function sendToBackground<TType extends keyof BackgroundMessages & string>(
  type: TType,
  ...args: PayloadArgs<BackgroundMessages[TType]['request']>
): Promise<Result<BackgroundMessages[TType]['response']>> {
  return send<BackgroundMessages, TType>(
    (message) => chrome.runtime.sendMessage(message),
    type,
    args[0] as BackgroundMessages[TType]['request'],
  );
}

/** Sends a message from the service worker into a specific tab. */
export function sendToTab<TType extends keyof TabMessages & string>(
  tabId: number,
  type: TType,
  ...args: PayloadArgs<TabMessages[TType]['request']>
): Promise<Result<TabMessages[TType]['response']>> {
  return send<TabMessages, TType>(
    (message) => chrome.tabs.sendMessage(tabId, message),
    type,
    args[0] as TabMessages[TType]['request'],
  );
}
