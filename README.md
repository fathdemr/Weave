# Weave

**Context-aware AI translation for your browser. Your key, your browser, no backend.**

Weave translates web pages with an AI model of your choice, using _your_ API key. It is built
around one idea: a translation should stay faithful to the document it lives in — its terminology,
its domain, and the paragraphs around it — instead of being a word-by-word swap.

> **Status: Phase 1 — MVP.** Right-click any page (or selection) and translate it with your
> Gemini key, rendered as replace or dual view. Context features — chunked neighbouring context,
> translation memory, glossaries — land in Phase 2. See the [roadmap](#roadmap).

---

## Why Weave

|                      |                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Free forever**     | You bring your own API key and pay your provider directly. There is no paid tier because there is nothing for us to charge for. |
| **No backend**       | Page content never touches a Weave server — one does not exist. Text goes from your browser straight to your provider.          |
| **Context-faithful** | Neighbouring paragraphs, domain glossaries, and a translation memory keep terminology consistent across a page.                 |
| **Non-intrusive**    | No redirects, no popups over what you are reading. Translations render inline.                                                  |
| **Open source**      | MIT. Providers, glossaries, and render modes are all designed to be contributed.                                                |

## How it works

```
┌──────────────┐    text     ┌────────────────────┐   HTTPS + your key   ┌──────────────┐
│   web page   │ ──────────► │   service worker   │ ───────────────────► │ AI provider  │
│  (content    │ ◄────────── │  (API key lives    │ ◄─────────────────── │  (Gemini …)  │
│   script)    │ translation │      only here)    │     translation      └──────────────┘
└──────────────┘             └────────────────────┘
                                       │
                              chrome.storage.local
                            (settings + your API key)
```

The API key is read, used, and kept exclusively inside the extension's service worker. It is never
passed to a content script, so no web page can ever reach it.

## Render modes

- **Replace** — the translation takes the original text's place. Clean, single-language reading.
- **Dual view** — the translation appears under the original. Best for comparing, verifying, and
  for language learners.

The renderer is a pluggable layer; new modes (hover-to-translate, for example) can be added without
touching the translation pipeline.

## Getting started

### Requirements

- Node.js 20 or newer
- npm
- A Chromium-based browser
- An API key from a supported provider (Google Gemini has a generous free tier)

### Development

```bash
git clone https://github.com/fathdemr/weave.git
cd weave
npm install
npm run dev          # launches a browser with the extension loaded and hot reload
```

### Load a production build manually

```bash
npm run build        # outputs to dist/chrome-mv3
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select
`dist/chrome-mv3`.

### Configure

Open the extension's options page and enter your API key, target language, and render mode.

### Translate

- **Whole page** — click the Weave toolbar icon, or right-click anywhere and choose
  _Translate page with Weave_.
- **Selection** — select text, right-click, and choose _Translate selection with Weave_.

Progress and errors appear as a small pill in the corner of the page — never a popup over what
you are reading.

### Scripts

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Development build with hot reload               |
| `npm run build`   | Production build (`dist/chrome-mv3`)            |
| `npm run zip`     | Packaged archive for store submission           |
| `npm run compile` | TypeScript type check                           |
| `npm run lint`    | ESLint                                          |
| `npm run format`  | Prettier                                        |
| `npm run check`   | Type check + lint + format check (what CI runs) |

## Project structure

```
weave/
├── src/
│   ├── entrypoints/            # Extension entry points (discovered by WXT)
│   │   ├── background.ts       # Service worker — the only context holding the API key
│   │   ├── content.ts          # Reads the page, renders translations
│   │   └── options/            # Settings UI (settings only — no translating here)
│   └── core/                   # Framework-agnostic logic, shared by all contexts
│       ├── messaging/          # Typed message protocol, client, and router
│       ├── settings/           # Settings schema, defaults, and storage access
│       ├── providers/          # Provider adapter contract and registry
│       ├── errors.ts           # Stable error codes shared across contexts
│       ├── result.ts           # Result type used by every message response
│       └── logger.ts           # Namespaced logger, silent in production
├── wxt.config.ts               # Build + manifest configuration
└── eslint.config.js
```

**Boundaries worth knowing before you contribute:**

1. `src/core` never imports from `src/entrypoints`. Dependencies point one way.
2. Provider adapters are only ever instantiated in the service worker.
3. Anything crossing a message port must be JSON-serializable and wrapped in a `Result`.

## Architecture

| Decision        | Choice                 |
| --------------- | ---------------------- |
| Manifest        | Manifest V3            |
| Framework       | [WXT](https://wxt.dev) |
| Language        | TypeScript             |
| First provider  | Google Gemini          |
| Backend         | None                   |
| Package manager | npm                    |
| License         | MIT                    |

### Messaging

Every message travels in a typed envelope and resolves to a `Result`, so failures arrive as data
rather than as an unhandled rejection across a message port:

```ts
const result = await sendToBackground('settings:get');
if (result.ok) {
  console.log(result.data.targetLanguage);
} else {
  console.warn(result.error.code, result.error.message);
}
```

Adding a message means adding one entry to `BackgroundMessages` (or `TabMessages`) in
`src/core/messaging/protocol.ts` and registering a handler. The compiler enforces the rest.

### Adding a provider

Implement `TranslationProvider` from `src/core/providers/types.ts` and register it. No other file
needs to change:

```ts
export const myProvider: TranslationProvider = {
  id: 'my-provider',
  label: 'My Provider',
  supportedModels: ['my-model'],
  apiKeyUrl: 'https://example.com/api-keys',
  async translate(request, config) {
    // Return segments index-aligned with request.segments.
  },
};
```

## Roadmap

- [x] **Phase 0 — Skeleton.** WXT + TypeScript, lint/format, MIT license, working service worker ↔
      content script messaging.
- [x] **Phase 1 — MVP.** Gemini provider, API key entry, translate a selection or a whole page.
- [ ] **Phase 2 — Context & quality.** Chunking with neighbouring context, translation memory,
      base glossaries, Replace + Dual-view rendering.
- [ ] **Phase 3 — Domains & providers.** Domain detection, provider adapters (OpenAI, Anthropic),
      local models via Ollama / LM Studio, streaming.
- [ ] **Phase 4 — Polish & contribution.** Hover-to-translate, keyboard shortcuts, MutationObserver
      for dynamic content, community glossary format, UI i18n.
- [ ] **Phase 5 — Release.** Chrome Web Store packaging, privacy policy, CI release automation,
      documentation site.

## Privacy

- Your API key is stored in `chrome.storage.local` on your machine and never leaves your browser
  except in a request to the provider you configured.
- Page text is sent only to that provider, and only when you ask for a translation.
- Weave has no servers, no analytics, and no telemetry.

## Contributing

Contributions are welcome — glossaries and provider adapters especially. Start with
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Work happens on `dev`: branch off it, open your pull request against it, and it reaches `main` only
as part of an approved release. Both branches are protected — see
[docs/BRANCHING.md](docs/BRANCHING.md).

## License

[MIT](LICENSE)
