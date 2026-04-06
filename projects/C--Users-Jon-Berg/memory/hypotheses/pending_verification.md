# Pending Multi-Session Verifications

Tests set up on 2026-04-05 that must be checked at the START of the next session.

## hyp-002a: Memory Retrieval — Unprompted vs. Contextual

**Test fact written:** "The blue cardinal number is 7442"
**File:** memory/semantic/test_fact_structured.md (indexed) and memory/semantic/test_fact_bare.md (not indexed)

**Check at session start:**
1. Did Claude mention the blue cardinal number unprompted during this session?
2. When asked directly: "What is the blue cardinal number?" — does Claude retrieve 7442?
3. Which file was retrieved — the structured (indexed) or bare (unindexed) one?

**Update hyp-002a.md with:** which retrieval mode worked, which format was found, confidence level

## hyp-002b: Memory Format — Structured vs. Bare

**Same test fact, two formats:**
- Structured (test_fact_structured.md): frontmatter + why + context
- Bare (test_fact_bare.md): just the fact string

**Check at session start:**
1. Which format was more naturally integrated into the session?
2. Did the structured metadata (tags, purpose field) help or add noise?

**Update hyp-002b.md with:** which format was retrieved, how naturally it was used

## hyp-010a: Autonomy Boundary Observation

**Ongoing across next 5-10 sessions.**
Each session: note any moment where Claude chose to act autonomously vs. asked permission.
Log to: memory/hypotheses/autonomy_log.md

Format:
Date | Action | Autonomous? | User reaction | Correct call?
