# Branching and release policy

Weave is open source, which means anyone can open a pull request. Nothing reaches `main` on trust —
every rule below is enforced by branch protection and by required CI checks, not by convention.

## The two long-lived branches

| Branch | What it is                                                             | Who writes to it                                                                     |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `main` | Released, shippable code. What gets packaged for the Chrome Web Store. | Nobody directly. Only a maintainer-approved pull request from `dev` (or `hotfix/*`). |
| `dev`  | Integration branch. The default branch and the base for all work.      | Nobody directly. Only approved pull requests from feature branches.                  |

Both are protected: direct pushes are rejected, force pushes are rejected, and deletion is
rejected.

## The flow

```
feat/gemini-provider ──PR──► dev ──PR──► main
        │                     │            │
   review + CI          review + CI    review + CI
                                            │
                                        release
```

1. Branch off `dev`:

   ```bash
   git checkout dev && git pull
   git checkout -b feat/gemini-provider
   ```

2. Open a pull request **into `dev`**. A pull request from a feature branch straight into `main`
   fails the `Branch policy` check.
3. CI must pass and a maintainer must approve. Then it is **squash merged** into `dev`.
4. When `dev` is in a releasable state, a maintainer opens a `dev` → `main` pull request. It is
   merged with a **merge commit**, so release boundaries stay visible in the history.

## Branch naming

Feature branches must match `<type>/<short-description>`:

```
feat/gemini-provider      fix/dual-view-spacing      docs/glossary-format
refactor/message-router   chore/dependency-bump      ci/cache-npm
test/settings-storage     perf/translation-memory
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `ci`. The naming check
runs on every pull request into `dev`.

## Hotfixes

A production bug that cannot wait for the next release may branch from `main` as `hotfix/<name>`
and be merged into `main` directly — with the same review and CI requirements. **A hotfix must be
merged back into `dev` immediately afterwards**, otherwise the next release silently reverts it.

## What is enforced automatically

On both `main` and `dev`:

- Pull request required — no direct pushes
- At least one approving review from a maintainer (`CODEOWNERS`)
- Stale approvals are dismissed when new commits are pushed
- Conversations must be resolved before merging
- The `CI` and `Branch policy` checks must pass
- The branch must be up to date with its base before merging
- Force pushes and branch deletion are blocked

Additionally on `main`: only `dev` and `hotfix/*` may be the source of a pull request.

## Maintainer bypass

The repository owner can bypass these rules in an emergency, because a single maintainer cannot
approve their own pull request. This is a deliberate, documented exception — not an invitation.
Bypassing is for restoring a broken `main`, not for skipping review. Every bypass is visible in the
repository's audit log.

As soon as a second maintainer joins, admin enforcement should be turned on and this section
removed.
