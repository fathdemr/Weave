import { ErrorCode, WeaveError } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { sendToTab } from '@/core/messaging/client';
import { createRouter } from '@/core/messaging/router';
import type { BackgroundMessages } from '@/core/messaging/protocol';
import { geminiProvider } from '@/core/providers/gemini';
import { getProvider, registerProvider } from '@/core/providers/registry';
import { withRetry } from '@/core/retry';
import { toPublicSettings } from '@/core/settings/schema';
import { readSettings, writeSettings } from '@/core/settings/storage';

const log = createLogger('background');

const MENU_TRANSLATE_SELECTION = 'weave-translate-selection';
const MENU_TRANSLATE_PAGE = 'weave-translate-page';

/**
 * Service worker — the extension's only trusted context.
 *
 * Everything that touches the API key lives here: the key is read from storage,
 * used for a provider call, and never travels to a content script or a page.
 */
export default defineBackground(() => {
  log.info('service worker started');

  registerProvider(geminiProvider);

  const router = createRouter<BackgroundMessages>('background');

  router
    .on('ping', () => ({
      version: chrome.runtime.getManifest().version,
      ready: true,
    }))

    .on('settings:get', async () => toPublicSettings(await readSettings()))

    .on('settings:update', async (patch) => toPublicSettings(await writeSettings(patch)))

    .on('translate:text', async ({ segments, targetLanguage }) => {
      const settings = await readSettings();
      if (!settings.apiKey) {
        throw new WeaveError(
          ErrorCode.MISSING_API_KEY,
          'Add your API key in the extension options first',
        );
      }

      const provider = getProvider(settings.provider);
      // Overload and rate limiting are routine and usually clear in seconds;
      // absorbing them here keeps a transient blip from surfacing as a failed
      // translation the user can do nothing about.
      const result = await withRetry(() =>
        provider.translate(
          {
            segments,
            context: {
              sourceLanguage: settings.sourceLanguage,
              targetLanguage: targetLanguage ?? settings.targetLanguage,
            },
          },
          { apiKey: settings.apiKey, model: settings.model },
        ),
      );

      return { segments: result.segments };
    })

    .on('models:list', async () => {
      const settings = await readSettings();
      const provider = getProvider(settings.provider);
      const fallback = provider.supportedModels.map((id) => ({ id, label: id }));

      // Without a key there is nobody to ask; the fallback still lets the
      // user see what the adapter expects.
      if (!settings.apiKey || !provider.listModels) {
        return { models: fallback, live: false };
      }

      try {
        const models = await provider.listModels({ apiKey: settings.apiKey });
        return models.length > 0 ? { models, live: true } : { models: fallback, live: false };
      } catch (error) {
        // A bad key or a network blip should not leave the user without a
        // usable model list.
        log.warn('could not fetch the live model list', error);
        return { models: fallback, live: false };
      }
    })

    .listen();

  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    chrome.contextMenus.create({
      id: MENU_TRANSLATE_SELECTION,
      title: 'Translate selection with Weave',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: MENU_TRANSLATE_PAGE,
      title: 'Translate page with Weave',
      contexts: ['page'],
    });

    if (reason === 'install') {
      // First run: open the options page so the user can add their API key.
      await chrome.runtime.openOptionsPage();
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined) return;
    void requestPageTranslation(tab.id, info.menuItemId === MENU_TRANSLATE_SELECTION);
  });

  // Clicking the toolbar icon translates the current page.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    void requestPageTranslation(tab.id, false);
  });
});

async function requestPageTranslation(tabId: number, selectionOnly: boolean): Promise<void> {
  const payload = { selectionOnly };

  let result = await sendToTab(tabId, 'page:translate', payload);
  if (result.ok) return;

  // No receiver: the tab was open before the extension was installed or
  // reloaded, so its content script never ran (or was orphaned by a reload).
  // activeTab lets us inject it on demand instead of asking for a refresh.
  if (await injectContentScript(tabId)) {
    result = await sendToTab(tabId, 'page:translate', payload);
    if (result.ok) return;
  }

  // Anything left is a page where content scripts cannot run at all
  // (chrome://, the Web Store). Nothing can be rendered there.
  log.warn('page translation request failed', result.error);
}

/** Injects the declared content script into a tab. Returns false if blocked. */
async function injectContentScript(tabId: number): Promise<boolean> {
  // Read the paths from the manifest so a build-output rename cannot silently
  // break injection.
  const files = chrome.runtime.getManifest().content_scripts?.flatMap((entry) => entry.js ?? []);
  if (!files?.length) {
    log.error('no content script declared in the manifest');
    return false;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: false }, files });
    return true;
  } catch (error) {
    log.warn('content script injection blocked for this page', error);
    return false;
  }
}
