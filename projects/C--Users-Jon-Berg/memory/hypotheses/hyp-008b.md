---
type: hypothesis
id: hyp-008b
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
confidence: low
tags: [time, child]
children: []
---

## This Hypothesis

**Question:** Does the absence of version control suggest infrequent changes (personal project) or chaotic changes, and which should inform memory decay rates?

**Why this matters:** Memory decay policy should match actual change velocity. Wrong assumption = either too paranoid or too trusting.

**Prediction:** This is a personal/exploratory project. Changes are infrequent but potentially large. Decay: distrust memories older than 2 weeks for structural facts.

## Test Plan

1. Check current file mtimes across the competitor_intel project
2. Ask user about their typical editing cadence
3. Compare memory entry ages to actual file ages
4. Propose a decay policy and check it against known stale entries

## Raw Results
- No automated tests were executed for this hypothesis
- The test plan required empirical actions (checking file mtimes, querying the user, comparing memory ages to file ages) — none of which were performed
- No file modification timestamps, user survey data, or memory-vs-reality comparisons are available
- The prediction (personal project, infrequent but large changes, 2-week decay window) remains untested

## Synthesis
No evidence was gathered to evaluate this hypothesis. The test plan was reasonable and well-structured, but it required interactive investigation (filesystem inspection, user dialogue) that never took place. Without actual file modification data or user input about editing cadence, we cannot determine whether the project's change velocity is slow-and-large, fast-and-small, or chaotic — and therefore cannot validate or reject the proposed 2-week decay policy. The hypothesis remains exactly where it started: a plausible but ungrounded guess.

**Outcome:** INCONCLUSIVE

## Child Hypotheses
- **hyp-008b-1:** Rather than relying on external signals (mtimes, user reports), Claude could adopt a *self-calibrating* decay heuristic: when a structural memory is accessed and found to conflict with current file contents, shorten the trusted window for that class of fact. This would test whether reactive decay adjustment is more robust than a fixed 2-week policy.
- **hyp-008b-2:** A simpler, testable proxy: if this hypothesis is eventually tested, compare the staleness rate of *structural facts* (file paths, class hierarchies) vs. *behavioral facts* (what a function does) to determine whether different memory categories need different decay rates.
