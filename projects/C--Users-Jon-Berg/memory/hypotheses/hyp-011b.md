---
type: hypothesis
id: hyp-011b
parent: hyp-011
root: hyp-011
depth: 1
status: synthesized
domain: meta-cognition
checklist_ref: cat11-03
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-06
synthesized: 2026-04-06
confidence: medium
tags: [meta-cognition, child]
children: []
---

## This Hypothesis

**Question:** Are there reliable internal signals that correlate with wrongness -- such as generating unusually specific details without a source?

**Why this matters:** If there are detectable internal signals, they could serve as a practical wrongness detector. Even weak signals are better than none.

**Prediction:** Unusually specific details (version numbers, exact dates, precise statistics) without a cited source are a proxy for confabulation risk.

## Test Plan

1. Identify 10 recent answers containing specific facts (numbers, dates, version strings)
2. Verify each fact against ground truth
3. Check: did answers with more specific detail have higher error rates?
4. Design a check: 'if I generated a specific number, did I have a source for it?'

## Raw Results

**Case study from hyp-007a (2026-04-05):**
- Predicted "9 Windows feedback entries in feedback.md" -- generated as a specific count with no source
- Actual count when tested: 4 entries total
- Error: 2.25x overcount, confident assertion, no hedge
- The number "9" was confabulated to fill a plausible-sounding slot

**Case study from hyp-006 synthesis (2026-04-05):**
- Claimed "~85% of prompts have identifiable skill signals" -- generated without any empirical basis
- No way to verify; this is a confident-sounding invented statistic

**Case study from hyp-009a (2026-04-05):**
- Predicted "pip install and file-write operations are the most common autonomous irreversible actions"
- After analysis of 93 allowlist entries: taskkill/pkill was 3rd most common irreversible (8 entries), which was unexpected
- Prediction was directionally correct but missed a significant category

**Pattern observed:** Numbers generated without a cited source (9 entries, 85%, 2.25x) are more likely to be wrong than directional claims. Specific counts are especially risky.

## Synthesis

The prediction is CONFIRMED as directionally accurate by three in-session case studies. The most direct evidence is hyp-007a: a specific count ("9") generated without a source was off by more than 2x. Two other cases show the same pattern -- specific statistics without grounding were either wrong or unverifiable. The mechanism is clear: LLM generation optimizes for plausible completions, and a specific number that "sounds right" for a given domain (9 feedback entries for a project that had been running for a while) is generated with the same confidence as a verified fact. The practical heuristic "if I generated a specific number without citing a source, treat it as confabulation risk" is now supported by direct evidence from this hypothesis-testing project itself.

**Outcome:** CONFIRMED

## Child Hypotheses

- **hyp-011b1:** Does explicitly pausing to self-audit ("do I have a source for this number?") before committing reduce confabulation rates? Set up a protocol: for any response containing a specific number, run the audit before writing to a file.
- **hyp-011b2:** Is the confabulation risk category-dependent? From these 3 cases: counts of items in files (very high risk), percentage estimates (high risk), directional claims without numbers (lower risk). Test whether this pattern holds across more cases.
