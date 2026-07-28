import { ErrorCode, WeaveError } from '../errors';
import { createLogger } from '../logger';
import { err, ok, type Result } from '../result';
import { isEnvelope, type MessageSchema } from './protocol';

const log = createLogger('router');

export type MessageHandler<TSchema extends MessageSchema, TType extends keyof TSchema> = (
  payload: TSchema[TType]['request'],
  sender: chrome.runtime.MessageSender,
) => Promise<TSchema[TType]['response']> | TSchema[TType]['response'];

export interface Router<TSchema extends MessageSchema> {
  /** Registers the handler for a message type. One handler per type. */
  on<TType extends keyof TSchema & string>(
    type: TType,
    handler: MessageHandler<TSchema, TType>,
  ): Router<TSchema>;
  /** Attaches to `chrome.runtime.onMessage`. Returns a detach function. */
  listen(): () => void;
}

/**
 * Type-safe wrapper over `chrome.runtime.onMessage`.
 *
 * Handlers may be async and may throw: a thrown error is converted into a
 * `Result` failure, so the caller always receives a value instead of a dangling
 * promise. Messages that are not ours are left untouched for other listeners.
 */
export function createRouter<TSchema extends MessageSchema>(scope: string): Router<TSchema> {
  const handlers = new Map<string, MessageHandler<TSchema, keyof TSchema>>();

  const router: Router<TSchema> = {
    on(type, handler) {
      if (handlers.has(type)) {
        log.warn(`${scope}: handler for "${type}" was replaced`);
      }
      // Safe: the map is keyed by type, and `listen` only ever calls a handler
      // with the payload that belongs to its own key.
      handlers.set(type, handler as unknown as MessageHandler<TSchema, keyof TSchema>);
      return router;
    },

    listen() {
      const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: Result<unknown>) => void,
      ): boolean => {
        if (!isEnvelope(message)) return false;

        const handler = handlers.get(message.type);
        if (!handler) {
          sendResponse(
            err(
              new WeaveError(ErrorCode.NO_HANDLER, `${scope} has no handler for "${message.type}"`),
            ),
          );
          return false;
        }

        void (async () => {
          try {
            sendResponse(ok(await handler(message.payload, sender)));
          } catch (error) {
            log.error(`${scope}: "${message.type}" failed`, error);
            sendResponse(err(error));
          }
        })();

        // Keeps the message port open for the async handler above.
        return true;
      };

      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    },
  };

  return router;
}
