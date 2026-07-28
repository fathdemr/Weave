# Contributing to Weave

Thanks for considering a contribution. Weave is built to be extended: providers, glossaries, and
render modes are all meant to come from the community.

## Getting set up

```bash
npm install
npm run dev      # opens a browser with the extension loaded
npm run check    # type check + lint + format check — run before every PR
```

Node 20 or newer, npm as the package manager. Do not commit lockfiles from other package managers.

## Ground rules

- **All code, comments, commit messages, and user-facing strings are in English.** Discussion in
  issues can happen in any language.
- **The API key never leaves the service worker.** A change that exposes it to a content script,
  a page, or a log will not be merged.
- **`src/core` must not import from `src/entrypoints`.** Dependencies point one way.
- **Messages are typed.** Add the contract to `src/core/messaging/protocol.ts` first; the compiler
  will tell you what else to write.
- **Errors carry a code.** Throw a `WeaveError` with an `ErrorCode`, never a bare string, so the UI
  can present something useful.
- **Do not break the page.** The content script runs on other people's documents. Prefer additive
  DOM changes and always keep the original text recoverable.

## Where to start

| I want to…         | Do this                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Add an AI provider | Implement `TranslationProvider` in `src/core/providers/` and register it       |
| Add a glossary     | Drop a JSON file into the glossary directory (Phase 2) and open a PR           |
| Add a render mode  | Add a variant to `RenderMode` and implement the renderer in the content script |
| Fix a bug          | Open an issue first if the fix changes behaviour visible to users              |

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
  `refactor:`, `chore:`.
- Keep a PR focused on one thing. Several small PRs merge faster than one large one.
- Describe what you changed and how you verified it. For anything that touches the DOM, say which
  sites you tested on.
- `npm run check` must pass. CI runs the same command.

## Reporting a security issue

Do not open a public issue for a vulnerability — see [SECURITY.md](SECURITY.md).

## Code of Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
