---
type: semantic
tags: [memory-v3, pinecone, vector-search, architecture]
salience: medium
confidence: high
source: observed
status: confirmed
related: []
created: 2026-04-06
last-accessed: 2026-04-06
---

Memory V3 live as of 2026-04-06.

Architecture: Pinecone index `claude-memory` (aws, us-east-1, llama-text-embed-v2) is the primary retrieval store. `retrieval-hook.mjs` queries it on every prompt via semantic search. `consolidation.mjs` upserts new learnings to Pinecone at session end. MEMORY.md and file-based memories remain as backup.

Index host: `claude-memory-hr7dpkh.svc.aped-4627-b74a.pinecone.io`, namespace: `memories`.

## Build log

- 2026-04-06: Index created, 15 memories migrated, retrieval-hook.mjs and consolidation.mjs updated

Each Pinecone record schema: `id`, `text`, `type`, `domain`, `project`, `salience`.

WIP — Memory V3 Build (2026-04-06)

## Decisions Made This Session

**Paused hypothesis testing** — 5/10 ROI.

Overhead not worth it.

Findings already extracted to procedural memories.
**Executed 4 quick wins:** improved MEMORY.md one-liners, created `~/.claude/CLAUDE.md` (global rules), archived all hypothesis files to `hypotheses/_archive/`, created `oficio-taller-marketing/CLAUDE.md`.
**Chose v3 architecture:** Tiered system on Pinecone (Proposal C) — cloud-hosted, shareable, any-project, semantic retrieval.

## V3 Architecture Decided

Each Pinecone record has metadata: `type`, `domain`, `project`, `salience`, `text`.

User needs to add `PINECONE_API_KEY` to `~/.claude/settings.json`:

```json
"env": {
  "PINECONE_API_KEY": "your-key-here"
},
```

Then restart Claude Code.

Next session: verify connection, create `claude-memory` index, migrate existing memories, rebuild hooks.

## Next Steps (In Order)

Verify Pinecone connection (`list-indexes`)
2.

Create index `claude-memory` (aws, us-east-1, llama-text-embed-v2, fieldMap: text → text)
3.

Migrate existing memory files into Pinecone as records
4.

Rebuild `retrieval-hook.mjs` — embed prompt, query Pinecone top-5
5.

Rebuild `consolidation.mjs` — upsert new learnings + Reflexion self-review
6.

Trim MEMORY.md to pinned-only (5 entries max)

```json
"env": {
  "PINECONE_API_KEY": "your-key-here"
},
```
