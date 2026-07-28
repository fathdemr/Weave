import { createLogger } from '@/core/logger';
import { sendToBackground } from '@/core/messaging/client';
import type { PageInfo, TabMessages } from '@/core/messaging/protocol';
import { createRouter } from '@/core/messaging/router';

const log = createLogger('content');

/** Characters of page text kept for later domain detection (Phase 3). */
const EXCERPT_LENGTH = 500;

/**
 * Content script — reads the page and paints translations onto it.
 *
 * It is untrusted by design: it never holds the API key and never calls a
 * provider directly. All network work goes through the service worker.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    const router = createRouter<TabMessages>('content');

    router
      .on('page:describe', () => describePage())

      .on('page:translate', ({ selectionOnly }) => {
        // Phase 1 collects text nodes and renders the result here.
        log.debug('translation requested', { selectionOnly });
        return { started: false };
      })

      .listen();

    // Handshake: confirms the worker is alive and the protocol matches.
    void sendToBackground('ping').then((result) => {
      if (result.ok) {
        log.debug(`connected to worker v${result.data.version}`);
      } else {
        log.warn('worker handshake failed', result.error);
      }
    });
  },
});

function describePage(): PageInfo {
  return {
    url: location.href,
    title: document.title,
    declaredLanguage: document.documentElement.lang,
    excerpt: (document.body?.innerText ?? '').slice(0, EXCERPT_LENGTH),
  };
}
