---
type: procedural
tags: [git, python, imports, testing, paths, sqlite, shopify, windows]
salience: medium
confidence: high
source: instructed
status: confirmed
trigger: [command-not-found, not-found, scripts, appdata, pip-install, concurrent, locked, database-locked, null, sku, getattr, property, lazy-import, git-push, git-auth, credential, windows-credential, push-hangs]
related: []
created: 2026-03-02
last-accessed: 2026-04-06
---

After solving a tricky problem (especially after failed attempts and iteration), save the learning automatically as a `## Solution:` entry below. Do not ask the user first.

## Solution: windows-pip-scripts-not-on-path

**Symptom:** Command not found after `pip install` on Windows
**Failed:** Assumed pip-installed scripts land on system PATH
**Solution:** Scripts go to `AppData\Roaming\Python\Python312\Scripts` — check with `where python` before assuming a command is available

**Why:** Windows pip installs to user Scripts dir, not system PATH by default
**How to apply:** Any time a pip-installed CLI tool appears missing on Windows

## Solution: sqlite-concurrent-write-lock

**Symptom:** SQLite database locked error when running multiple scrapers
**Failed:** Running scrapers in parallel processes
**Solution:** Run scrapers sequentially — SQLite does not support concurrent writes from multiple processes

**Why:** SQLite uses file-level locking; parallel writers deadlock
**How to apply:** Any time multiple Python processes write to the same SQLite DB

## Solution: shopify-variant-sku-null

**Symptom:** `v.get("sku", "")` returns `None` instead of `""` for Shopify variants
**Failed:** Using `dict.get(key, default)` — default only applies when key is absent, not when value is None
**Solution:** Use `v.get("sku") or ""` — the `or` operator substitutes the default for both missing and None

**Why:** Shopify variant.sku field is nullable; `.get(key, default)` does not guard against None values
**How to apply:** Any Shopify variant field that can be null

## Solution: python-lazy-import-getattr-property-conflict

**Symptom:** Module-level lazy import via `__getattr__` breaks silently when combined with `@property`
**Failed:** Adding `@property` decorator on top of module-level `__getattr__` lazy import
**Solution:** Do not combine module-level `__getattr__` with `@property` — use one mechanism only

**Why:** `@property` is a descriptor for class instances; module `__getattr__` is for attribute lookup on modules. They conflict.
**How to apply:** Any lazy import pattern at module level

## Solution: windows-git-push-hangs-credential-popup

**Symptom:** `git push origin master` runs silently in background with no output and never completes
**Failed:** Running `git push` via Bash tool — Windows Credential Manager opens a GUI popup that can't be seen or interacted with in the Claude session
**Solution:** Use `git -c credential.helper='!gh auth git-credential' push origin master` — bypasses Windows Credential Manager using the already-authenticated `gh` CLI token

**Why:** Windows git uses Credential Manager (GUI popup) by default; `gh` CLI stores a token in keyring that can be used directly as a credential helper
**How to apply:** Any time `git push` to GitHub hangs or produces no output on Windows — check `gh auth status` first to confirm gh is logged in, then use the gh credential helper

## Rule: Run git commands directly

Do not ask the user to run git commands in their terminal. Just run them directly using the Bash tool, using `gh auth git-credential` if authentication is needed.

**Why:** User explicitly instructed this.
**How to apply:** All git operations including push, pull, fetch.

```
CLAUDE.md (global behavioral rules — always loaded)
    ↓
Pinecone index: "claude-memory" (cloud vector store — shareable brain)
    ↓ semantic search on every prompt via retrieval-hook.mjs
MEMORY.md (shrinks to 5–10 pinned always-load entries only)
    ↓
Project CLAUDE.md (local overrides)
```

Reflexion loop (Proposal A) gets built into the Stop hook — corrections upsert directly to Pinecone.

```
CLAUDE.md (global behavioral rules — always loaded)
    ↓
Pinecone index: "claude-memory" (cloud vector store — shareable brain)
    ↓ semantic search on every prompt via retrieval-hook.mjs
MEMORY.md (shrinks to 5–10 pinned always-load entries only)
    ↓
Project CLAUDE.md (local overrides)
```
