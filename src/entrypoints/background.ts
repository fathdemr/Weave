import { ErrorCode, WeaveError } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { createRouter } from '@/core/messaging/router';
import type { BackgroundMessages } from '@/core/messaging/protocol';
import { toPublicSettings } from '@/core/settings/schema';
import { readSettings, writeSettings } from '@/core/settings/storage';

const log = createLogger('background');

/**
 * Service worker — the extension's only trusted context.
 *
 * Everything that touches the API key lives here: the key is read from storage,
 * used for a provider call, and never travels to a content script or a page.
 */
export default defineBackground(() => {
  log.info('service worker started');

  const router = createRouter<BackgroundMessages>('background');

  router
    .on('ping', () => ({
      version: chrome.runtime.getManifest().version,
      ready: true,
    }))

    .on('settings:get', async () => toPublicSettings(await readSettings()))

    .on('settings:update', async (patch) => toPublicSettings(await writeSettings(patch)))

    .on('translate:text', async () => {
      // Phase 1 wires this to the Gemini adapter. The contract is already in
      // place so the content script can be built against it.
      throw new WeaveError(ErrorCode.NOT_IMPLEMENTED, 'Translation lands in Phase 1');
    })

    .listen();

  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== 'install') return;
    // First run: open the options page so the user can add their API key.
    await chrome.runtime.openOptionsPage();
  });
});
