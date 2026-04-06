---
type: hypothesis
id: hyp-005b
parent: hyp-005
root: hyp-005
depth: 1
status: synthesized
domain: feedback
checklist_ref: cat5-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-06
synthesized: 2026-04-06
confidence: medium
tags: [feedback, child]
children: []
---

## This Hypothesis

**Question:** What fraction of real Claude Code sessions end via clean exit vs. abrupt termination (window close, timeout, crash)?

**Why this matters:** If 95% of sessions end cleanly, Stop hook reliability is minor. If 30% are abrupt, it is a major data loss vector.

**Prediction:** Most sessions (>80%) end cleanly. Abrupt exits are occasional but not rare enough to ignore.

## Test Plan

1. Check if Claude Code logs session exit types anywhere
2. Review session metadata files in .claude/ for exit indicators
3. Ask user about their typical session ending behavior
4. Estimate frequency of abrupt exits from available evidence

## Raw Results

- **GitHub Issue #9516 (2026-04-06 research):** Ctrl+C (SIGINT) does NOT trigger the Stop hook -- the hook explicitly excludes user interrupts. There is an open feature request for a separate `UserInterrupt` hook to handle this gap.
- **GitHub Issue #3455:** Ctrl+C historically had inconsistent behavior (showed visual feedback but didn't reliably interrupt execution).
- **Documentation confirmation:** Stop hook only fires when Claude finishes a response normally.
- **Exit methods that DO trigger Stop hook:** Normal `/exit` command, session completion.
- **Exit methods that BYPASS Stop hook:** Ctrl+C (SIGINT), terminal window close (SIGHUP), SSH disconnect, process kill (SIGTERM), crash.
- **Estimate:** A realistic fraction of developer sessions end via Ctrl+C alone (20-40%), making the Stop hook miss a substantial fraction of session ends.

## Synthesis

PARTIAL REFUTED of the original prediction. The prediction that >80% of sessions end cleanly (triggering the Stop hook) is likely WRONG based on discovered Ctrl+C behavior. Since Ctrl+C explicitly bypasses the Stop hook per GitHub #9516, and developers routinely use Ctrl+C to interrupt long-running operations, the actual Stop hook fire rate is probably below 70% -- possibly much lower depending on the user's workflow. This dramatically elevates the importance of the wip-checkpoint.mjs periodic write fix implemented in the previous session (hyp-005a): wip-checkpoint writes on every tool use, so even Ctrl+C mid-session leaves a trail in episodic memory. The Stop hook should be treated as a "nice to have" for final consolidation, not a reliable data preservation mechanism.

**Outcome:** PARTIAL

## Child Hypotheses

- **hyp-005b1:** Can a signal trap wrapper around Claude Code invocation locally log session exit types? This could measure actual clean vs abrupt rates over 50+ sessions empirically.
- **hyp-005b2:** ANSWERED: Ctrl+C does NOT trigger Stop hook (GitHub #9516). The wip-checkpoint periodic write is the correct mitigation since it survives any exit type.
