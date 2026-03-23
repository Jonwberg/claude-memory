---
type: semantic
tags: [shopify, sqlite, python, imports, scraping, pagination, locking]
salience: high
related: [semantic/project-competitor-intel.md]
created: 2026-03-02
last-accessed: 2026-03-23
---

SQLite locks if multiple processes write concurrently — run scrapers sequentially.

Shopify /products.json caps at ~page 100 — need max_pages safety limit.

Shopify variant.sku can be null — use `v.get("sku") or ""` not `v.get("sku", "")`.

Module-level `__getattr__` for lazy imports works but don't also add `@property`.
