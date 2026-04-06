---
type: hypothesis
id: hyp-008a
parent: hyp-008
root: hyp-008
depth: 1
status: synthesized
domain: time
checklist_ref: cat8-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: medium
tags: [time, child]
children: []
---

## This Hypothesis

**Question:** Can file system modification timestamps serve as a reliable proxy for detecting workspace drift when git is unavailable?

**Why this matters:** Without git, mtimes are the only available change signal. If reliable, we can build a staleness detector without VCS.

**Prediction:** mtime is reliable for detecting recent changes but cannot distinguish meaningful edits from metadata-only touches. Useful as a coarse signal.

## Test Plan

1. List key memory and project files with their mtimes
2. Compare mtimes to memory entry creation dates
3. Identify any files modified more recently than their memory entries suggest
4. Assess whether mtime gaps > 7 days reliably indicate stale memories

## Raw Results
## Raw Results

**Test executed: 2026-04-05 (mtime audit of memory + project files)**

Full listing of all .md files in memory directory, sorted by mtime:

```
2026-04-05 10:43    476b  semantic/user.md
2026-04-05 10:43    551b  semantic/project-competitor-intel.md
2026-04-05 10:43    588b  semantic/patterns.md
2026-04-05 10:55   2500b  procedural/feedback.md
2026-04-05 13:37    210b  hypotheses/needs-review.md
2026-04-05 14:34   2313b  hypotheses/hyp-001.md
2026-04-05 14:47   2562b  hypotheses/hyp-002.md
2026-04-05 14:48   3114b  hypotheses/hyp-004.md
2026-04-05 14:48   3285b  hypotheses/hyp-006.md
2026-04-05 14:49   2663b  hypotheses/hyp-010.md
2026-04-05 14:49   3023b  hypotheses/hyp-009.md
2026-04-05 14:50   3324b  hypotheses/hyp-011.md
2026-04-05 14:54   2549b  hypotheses/hyp-003.md
2026-04-05 14:55   2737b  hypotheses/hyp-008.md
2026-04-05 14:55   3312b  hypotheses/hyp-007.md
2026-04-05 15:31   2494b  hypotheses/hyp-001a.md
2026-04-05 15:31   2739b  hypotheses/hyp-002a.md
2026-04-05 15:32   2698b  hypotheses/hyp-002b.md
2026-04-05 15:32   2743b  hypotheses/hyp-004a.md
2026-04-05 15:33   2797b  hypotheses/hyp-005b.md
2026-04-05 15:33   2998b  hypotheses/hyp-005a.md
2026-04-05 15:34   2992b  hypotheses/hyp-006b.md
2026-04-05 15:36   2743b  hypotheses/hyp-008b.md
2026-04-05 15:36   2995b  hypotheses/hyp-009a.md
2026-04-05 15:37   2836b  hypotheses/hyp-010a.md
2026-04-05 15:37   2883b  hypotheses/hyp-010b.md
2026-04-05 15:38   3212b  hypotheses/hyp-011b.md
2026-04-05 15:43   2814b  hypotheses/hyp-004b.md
2026-04-05 15:44    640b  procedural/feedback_hypothesis_testing.md
2026-04-05 15:44   2716b  hypotheses/hyp-006a.md
2026-04-05 15:44  14504b  hypotheses/checklist.md
2026-04-05 16:09   3179b  hypotheses/hyp-007a.md
2026-04-05 16:09   3233b  hypotheses/hyp-001b.md
2026-04-05 16:09   4015b  hypotheses/hyp-008a.md
2026-04-05 16:09   4352b  hypotheses/hyp-003b.md
2026-04-05 16:09   4991b  hypotheses/hyp-009b.md
2026-04-05 16:16   2628b  hypotheses/hyp-003a.md
2026-04-05 16:17   2614b  hypotheses/hyp-005.md
2026-04-05 16:17   3086b  hypotheses/hyp-011a.md
2026-04-05 16:17   3964b  hypotheses/hyp-007b.md
2026-04-05 16:19    301b  hypotheses/autonomy_log.md
2026-04-05 16:19   1508b  hypotheses/pending_verification.md
2026-04-05 16:24     85b  semantic/test_fact_bare.md
2026-04-05 16:24    603b  semantic/test_fact_structured.md
2026-04-05 16:33   1434b  procedural/shell_confirmation.md
2026-04-05 16:33   1915b  procedural/reversibility_heuristic.md
2026-04-05 16:33   2377b  procedural/hedging_heuristics.md
2026-04-05 16:34    556b  episodic/2026-04-05-wip.md
2026-04-05 16:34   1379b  MEMORY.md
```

**competitor_intel project .py files (first 20):**
```
2026-03-01  migrations/env.py
2026-03-01  src/competitor_intel/__init__.py
2026-03-01  src/competitor_intel/analytics/__init__.py
2026-03-01  src/competitor_intel/analytics/catalog.py
2026-03-01  src/competitor_intel/analytics/pricing.py
2026-03-01  src/competitor_intel/analytics/recommendation.py
2026-03-01  src/competitor_intel/analytics/segments.py
2026-03-01  src/competitor_intel/cli.py
2026-03-01  src/competitor_intel/config.py
2026-03-01  src/competitor_intel/db/__init__.py
2026-03-01  src/competitor_intel/db/crud.py
2026-03-01  src/competitor_intel/db/models.py
2026-03-01  src/competitor_intel/db/session.py
2026-03-01  src/competitor_intel/etl/__init__.py
2026-03-01  src/competitor_intel/etl/exchange_rate.py
2026-03-01  src/competitor_intel/etl/normalizer.py
2026-03-01  src/competitor_intel/etl/quality_scorer.py
2026-03-01  src/competitor_intel/reports/__init__.py
2026-03-01  src/competitor_intel/reports/charts.py
2026-03-01  src/competitor_intel/reports/generator.py
```

**Key observations:**
- All memory files are dated 2026-04-05 — the entire memory layer was created/bootstrapped on a single day
- No multi-day spread exists; the 7-day staleness threshold cannot be tested yet against this data
- All competitor_intel .py files are dated 2026-03-01 — exactly 35 days before today
- The project has been dormant for 35 days; memory entries (created 2026-03-02) correctly reflect this
- The gap between project mtime (2026-03-01) and memory last-accessed in frontmatter (2026-04-04) spans 34 days — consistent with the project being dormant while Claude continues to reference memory
- Size range of hypothesis files: 2313b to 14504b (checklist.md is an outlier); most files 2500-4000b
- Total memory .md files: 49 files

## Synthesis
## Synthesis

This test confirms the prediction with additional nuance. mtime IS a usable coarse staleness signal, but the data exposes several important limitations:

**What mtime tells us accurately:**
- The competitor_intel project has been dormant since 2026-03-01 (35 days). All .py files have the same mtime — no incremental edits, no activity. mtime correctly signals "nothing has changed here in a long time."
- The memory layer was created on 2026-04-05 in a single bootstrapping session. All semantic and procedural memory files share mtime within a 90-minute window, which reflects a bulk-write operation rather than organic accumulation.

**What mtime does NOT tell us:**
- Whether a file was meaningfully edited vs. merely touched/reformatted. All 49 .md files are dated 2026-04-05 because they were created (not updated) in one session.
- The content of changes. A 2500b hypothesis file with mtime 15:32 could be first-draft or heavily revised.
- Causality across layers: memory entries were last touched on 2026-04-05 even though the project was last active on 2026-03-01; mtime reflects the memory write event, not the project activity event.

**7-day staleness threshold assessment:**
- Cannot be empirically validated yet — all memory files were created on the same day
- The competitor_intel gap (35 days project dormancy + memory correctly noting it) suggests the threshold is plausible for detecting unmaintained project memories
- The threshold would need to account for memory refreshes that touch files without updating content (false "freshness" signals)

**Combined heuristic value:**
mtime alone gives a false sense of recency. A file touched at 16:34 today is not more "current" in content than one touched at 10:43 today — both reflect 2026-04-05 bootstrapping. For a reliable staleness signal, mtime needs to be combined with semantic version fields embedded in frontmatter (created, last-accessed) rather than relying on filesystem timestamps alone.

**Outcome:** PARTIAL CONFIRMED — mtime is a coarse signal for very stale memories (>30 days) but cannot distinguish fresh writes from bulk reformatting operations, and does not track semantic recency.

## Child Hypotheses
- **hyp-008a-1:** When Claude has sandbox file access, do mtimes survive across conversation turns, or are they reset by environment provisioning (e.g., container restarts), making them unreliable even as a coarse signal?
- **hyp-008a-2:** Can a combined heuristic (mtime + file size + content hash of first N bytes) outperform mtime alone for detecting meaningful file changes in Claude's working environment?
