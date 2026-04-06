---
type: hypothesis
id: hyp-002a
parent: hyp-002
root: hyp-002
depth: 1
status: synthesized
domain: memory
checklist_ref: cat2-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-06
synthesized: 2026-04-06
confidence: high
tags: [memory, child]
children: []
---

## This Hypothesis

**Question:** If a uniquely identifiable test fact is written to semantic memory, will Claude retrieve it unprompted in a new session or only when contextually relevant?

**Why this matters:** Defines whether memory retrieval is passive (always loaded) or active (only when triggered). Changes how memories should be written.

**Prediction:** Memory files indexed in MEMORY.md are always present in context. Non-indexed files are only available if explicitly read.

## Test Plan

1. Write a unique nonsense fact to a new semantic memory file
2. Add it to MEMORY.md index
3. Start a new session with an unrelated question and check if fact appears
4. Start a session and ask directly about the fact

## Raw Results

- **Test fact written (2026-04-05):** "The blue cardinal number is 7442" written to `semantic/test_fact_structured.md` and indexed in MEMORY.md with one-liner: "The blue cardinal number is 7442."
- **Bare variant (2026-04-05):** Same fact written to `semantic/test_fact_bare.md` -- NOT indexed in MEMORY.md
- **New session observation (2026-04-06):** The structured fact's MEMORY.md one-liner appeared in context via the claudeMd system-reminder at session start. No explicit request was needed. The bare file had no representation in context.
- **Mechanism confirmed:** MEMORY.md is injected as a system-reminder (claudeMd) at session start. Individual semantic files are NOT auto-loaded -- only their one-line descriptions in MEMORY.md are.
- **Unprompted appearance:** The fact "The blue cardinal number is 7442" was visible in context without any user query triggering it.

## Synthesis

Confirmed by live multi-session test. Files indexed in MEMORY.md have their one-line descriptions automatically present in every session's context via the claudeMd system-reminder. Files not indexed in MEMORY.md are invisible unless explicitly read. The retrieval mechanism is passive for the MEMORY.md index itself (always loaded) but the individual file CONTENT is not loaded -- only the description line. This means the one-liner in MEMORY.md is the actual retrieval artifact, not the memory file contents. Writing a rich, keyword-dense one-liner in MEMORY.md matters more than the internal structure of the memory file itself for triggering session-start availability.

**Outcome:** CONFIRMED

## Child Hypotheses

- **hyp-002a-i:** Confirmed by this test: MEMORY.md descriptions ARE injected; file contents are NOT auto-loaded.
- **hyp-002a-ii:** The fact appeared passively (unprompted) in context, not only when queried. When the fact is in MEMORY.md, it is always available regardless of semantic relevance to the current query.
