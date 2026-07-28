# Security Policy

## Reporting a vulnerability

Please do not open a public issue. Report vulnerabilities privately through GitHub's
[security advisory](https://docs.github.com/en/code-security/security-advisories) form on this
repository. Expect an initial response within seven days.

## Threat model

Weave has no backend, so the relevant surface is entirely local:

- **API key exposure.** The key lives in `chrome.storage.local` and is used only inside the service
  worker. Any path that leaks it into a content script, a page's DOM, a log, or a third-party
  request is a vulnerability.
- **Content script injection.** The content script runs on arbitrary pages. Rendering translated
  text must not allow markup from a provider response to execute in the page.
- **Over-broad permissions.** Host permissions are limited to configured provider endpoints. A
  change that widens them needs justification in the PR.

## Out of scope

- Whatever the configured AI provider does with the text you send it. That relationship is between
  you and your provider.
- Vulnerabilities in the browser itself.
