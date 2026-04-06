---
name: memory-mechanism
description: How MEMORY.md actually works — one-liner descriptions are auto-loaded; file contents are not. Write description quality first.
type: semantic
salience: low
---

## How the Memory System Actually Works (Confirmed 2026-04-06)

**MEMORY.md is the only thing auto-loaded.** At session start, MEMORY.md is injected as a context block. Individual semantic/procedural/episodic file CONTENTS are NOT automatically loaded into context.

**The one-liner description IS the retrieval artifact.** Each MEMORY.md entry is a one-liner that describes the memory file. That one-liner is what Claude sees at session start — not the file content. Write the most useful fact in the description, not just a topic label.

**Good description:** `- [patterns.md](semantic/patterns.md) — SQLite locks if multiple processes write concurrently — run scrapers sequentially`
**Weak description:** `- [patterns.md](semantic/patterns.md) — notes on SQLite`

**Files NOT in MEMORY.md are invisible.** Even if a file exists in the memory directory, it has no representation in session context unless indexed in MEMORY.md.

**Implication for writing memories:** The MEMORY.md description line matters more than the internal structure of the file. A bare fact in MEMORY.md is better than a richly structured file with a vague description.
