---
type: procedural
tags: [git, python, imports, testing, paths]
salience: high
related: []
created: 2026-03-02
last-accessed: 2026-03-23
---

Run scrapers sequentially — SQLite will lock if multiple processes write concurrently.

Use `v.get("sku") or ""` not `v.get("sku", "")` — Shopify variant.sku can be null.

Do not combine module-level `__getattr__` with `@property` for lazy imports.

Scripts installed by `pip install` on Windows go to AppData\Roaming, not system PATH — check before assuming a command is available.
