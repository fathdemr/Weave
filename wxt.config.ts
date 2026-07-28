import { defineConfig } from 'wxt';

/**
 * WXT build configuration.
 *
 * Weave is a client-side only extension: there is no backend, so the only
 * host permissions we need are the ones required to (a) read the page the
 * user is on and (b) talk to the AI provider the user configured.
 *
 * @see https://wxt.dev/api/config.html
 */
export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  manifest: {
    name: 'Weave',
    short_name: 'Weave',
    description:
      'Context-aware AI translation that keeps terminology consistent. Bring your own API key.',
    permissions: ['storage', 'activeTab', 'scripting'],
    // Provider endpoints are requested from the service worker only, never
    // from a content script, so the API key can never leak into a web page.
    host_permissions: ['https://generativelanguage.googleapis.com/*'],
    options_ui: {
      open_in_tab: true,
    },
  },
});
