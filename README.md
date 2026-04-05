# Claude Memory

A local, file-based persistent memory system for Claude Code. No embeddings, no vector database, no remote services — just markdown files and a machine-readable index.

## Version

**v2.1** — adds `.index.json` machine-readable manifest, claim-aware consolidation, recursive learning via `## Solution:` entries, and `trigger`-keyword retrieval boosting.

## How it works

Memory is stored in four layers:

```
memory/
  episodic/      ← session-specific, decays in 90 days
  semantic/      ← distilled timeless facts
  procedural/    ← behavioral rules + learned solutions
  reference/     ← external pointers
  MEMORY.md      ← human-readable index
  .index.json    ← machine-readable index (primary retrieval surface)
```

Two hooks run automatically:

| Hook | Trigger | What it does |
|------|---------|--------------|
| `retrieval-hook.mjs` | Every prompt | Scores `.index.json` against prompt keywords, injects relevant files into context |
| `consolidation.mjs` | Session end | Absorbs episodic notes, runs decay, updates salience, rebuilds both indexes |

## Recursive learning

When Claude retries a tool call, hits an error, or changes approach mid-task — it saves a `## Solution:` entry automatically. These entries have `trigger` keywords that score at 2× during retrieval, surfacing the solution next time the same problem appears.

## Files

| File | Purpose |
|------|---------|
| `memory-utils.mjs` | Shared utilities: parse/write frontmatter, build indexes, scan files |
| `retrieval-hook.mjs` | UserPromptSubmit hook — injects relevant memory into context |
| `consolidation.mjs` | Stop hook — consolidates, decays, rebuilds indexes |
| `SKILL.md` | Instructions for Claude on how to use the memory system |
| `test-retrieval.mjs` | Manual test for retrieval scoring |
| `test-consolidation.mjs` | Manual test for consolidation phases |

## Changelog

### v2.1 (2026-04-05)
- Added `.index.json` as primary retrieval surface (no more MEMORY.md parsing on every prompt)
- Added `confidence`, `source`, `status` fields to frontmatter
- Added `trigger` field — symptom keywords scored at 2× during retrieval
- Claim-aware consolidation: sentence-level extraction instead of paragraph-level
- Recursive learning: auto-save `## Solution:` entries on struggle signals, no user prompt required
- Crash recovery cleans up both `.tmp` files

### v2.0 (2026-03-02)
- Four-layer model: episodic, semantic, procedural, reference
- Salience scoring (high/medium/low) with 90-day decay
- One-hop related expansion
- Atomic MEMORY.md rebuild
- Session tag persistence between retrieval and consolidation hooks
