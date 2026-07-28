import { collectBlocks, type CollectedBlock } from '@/core/dom/collect';
import { renderTranslation } from '@/core/dom/render';
import { hideStatus, showStatus } from '@/core/dom/status';
import { ErrorCode } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { sendToBackground } from '@/core/messaging/client';
import type { PageInfo, TabMessages } from '@/core/messaging/protocol';
import { createRouter } from '@/core/messaging/router';

const log = createLogger('content');

/** Characters of page text kept for later domain detection (Phase 3). */
const EXCERPT_LENGTH = 500;

/**
 * Batch limits keep a single provider call well inside model output limits.
 * Without a cache (Phase 2) every batch is a paid request, so batches are
 * as large as safely possible.
 */
const MAX_BATCH_SEGMENTS = 25;
const MAX_BATCH_CHARS = 6000;

let translating = false;

/**
 * Guards against double initialization.
 *
 * The worker injects this script on demand when a tab has no receiver. All
 * injections share one isolated world, so a global flag there tells a second
 * run to stand down instead of registering a duplicate message listener.
 */
interface ContentScriptWorld {
  __weaveReady?: boolean;
}

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
    const world = globalThis as ContentScriptWorld;
    if (world.__weaveReady) {
      log.debug('already initialized in this tab');
      return;
    }
    world.__weaveReady = true;

    const router = createRouter<TabMessages>('content');

    router
      .on('page:describe', () => describePage())

      .on('page:translate', ({ selectionOnly }) => {
        if (translating) return { started: false };
        // Detached on purpose: the menu click only needs to know the run
        // started; progress is reported through the status pill.
        void translate(selectionOnly);
        return { started: true };
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

async function translate(selectionOnly: boolean): Promise<void> {
  translating = true;
  try {
    const settings = await sendToBackground('settings:get');
    if (!settings.ok) {
      showStatus(`Weave: ${settings.error.message}`, 'error');
      return;
    }
    if (!settings.data.hasApiKey) {
      showStatus('Weave: add your API key in the extension options first', 'error');
      return;
    }

    const selection = selectionOnly ? window.getSelection() : null;
    if (selectionOnly && (!selection || selection.isCollapsed)) {
      showStatus('Weave: select some text first', 'error');
      return;
    }

    const blocks = collectBlocks(document.body, selection);
    if (blocks.length === 0) {
      showStatus('Weave: nothing new to translate here', 'success');
      return;
    }

    const { renderMode, targetLanguage } = settings.data;
    const batches = toBatches(blocks);
    let done = 0;

    for (const batch of batches) {
      showStatus(`Weave: translating… ${done}/${blocks.length}`, 'progress');

      const result = await sendToBackground('translate:text', {
        segments: batch.map((block) => block.text),
      });

      if (!result.ok) {
        log.error('translation batch failed', result.error);
        // The worker already retried a transient failure, so reaching here
        // means waiting is genuinely the only option left.
        const transient =
          result.error.code === ErrorCode.RATE_LIMITED ||
          result.error.code === ErrorCode.PROVIDER_OVERLOADED;
        const suffix = transient ? ' — try again in a moment' : '';
        const progress = done > 0 ? ` (${done}/${blocks.length} done)` : '';
        showStatus(`Weave: ${result.error.message}${suffix}${progress}`, 'error');
        return;
      }

      result.data.segments.forEach((translation, index) => {
        const block = batch[index];
        if (block) renderTranslation(block.element, translation, renderMode, targetLanguage);
      });
      done += batch.length;
    }

    showStatus(`Weave: translated ${done} blocks`, 'success');
  } catch (error) {
    log.error('translation run crashed', error);
    showStatus('Weave: translation failed unexpectedly', 'error');
  } finally {
    translating = false;
    setTimeout(hideStatus, 2500);
  }
}

function toBatches(blocks: CollectedBlock[]): CollectedBlock[][] {
  const batches: CollectedBlock[][] = [];
  let current: CollectedBlock[] = [];
  let chars = 0;

  for (const block of blocks) {
    const exceeds =
      current.length >= MAX_BATCH_SEGMENTS ||
      (current.length > 0 && chars + block.text.length > MAX_BATCH_CHARS);
    if (exceeds) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(block);
    chars += block.text.length;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

function describePage(): PageInfo {
  return {
    url: location.href,
    title: document.title,
    declaredLanguage: document.documentElement.lang,
    excerpt: (document.body?.innerText ?? '').slice(0, EXCERPT_LENGTH),
  };
}
