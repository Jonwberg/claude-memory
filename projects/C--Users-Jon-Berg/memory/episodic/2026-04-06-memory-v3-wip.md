---
type: episodic
tags: [memory-v3, pinecone, vector-search, architecture, wip]
salience: high
confidence: high
source: observed
status: open
retention: temporary
decay-after: 2026-07-06
created: 2026-04-06
last-accessed: 2026-04-06
session-outcome: exploratory
---

# WIP — Memory V3 Build (2026-04-06)

## Decisions Made This Session

- **Paused hypothesis testing** — 5/10 ROI. Overhead not worth it. Findings already extracted to procedural memories.
- **Executed 4 quick wins:** improved MEMORY.md one-liners, created `~/.claude/CLAUDE.md` (global rules), archived all hypothesis files to `hypotheses/_archive/`, created `oficio-taller-marketing/CLAUDE.md`.
- **Chose v3 architecture:** Tiered system on Pinecone (Proposal C) — cloud-hosted, shareable, any-project, semantic retrieval.

## V3 Architecture Decided

```
CLAUDE.md (global behavioral rules — always loaded)
    ↓
Pinecone index: "claude-memory" (cloud vector store — shareable brain)
    ↓ semantic search on every prompt via retrieval-hook.mjs
MEMORY.md (shrinks to 5–10 pinned always-load entries only)
    ↓
Project CLAUDE.md (local overrides)
```

Each Pinecone record has metadata: `type`, `domain`, `project`, `salience`, `text`.

Reflexion loop (Proposal A) gets built into the Stop hook — corrections upsert directly to Pinecone.

## Blocked On

User needs to add `PINECONE_API_KEY` to `~/.claude/settings.json`:

```json
"env": {
  "PINECONE_API_KEY": "your-key-here"
},
```

Then restart Claude Code. Next session: verify connection, create `claude-memory` index, migrate existing memories, rebuild hooks.

## Next Steps (In Order)

1. Verify Pinecone connection (`list-indexes`)
2. Create index `claude-memory` (aws, us-east-1, llama-text-embed-v2, fieldMap: text → text)
3. Migrate existing memory files into Pinecone as records
4. Rebuild `retrieval-hook.mjs` — embed prompt, query Pinecone top-5
5. Rebuild `consolidation.mjs` — upsert new learnings + Reflexion self-review
6. Trim MEMORY.md to pinned-only (5 entries max)
