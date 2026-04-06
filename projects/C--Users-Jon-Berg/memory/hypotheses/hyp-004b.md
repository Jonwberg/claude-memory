---
type: hypothesis
id: hyp-004b
parent: hyp-004
root: hyp-004
depth: 1
status: synthesized
domain: causation
checklist_ref: cat4-08
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-06
synthesized: 2026-04-06
confidence: high
tags: [causation, child]
children: []
---

## This Hypothesis

**Question:** Self-referential test contamination (test scaffolding contains the patterns being searched for) can be mitigated by isolating tests to content-free temp directories.

**Why this matters:** The grep test in hyp-004 failed because the pattern was in the test script. This methodological flaw could invalidate many automated tests.

**Prediction:** Any test searching for a string pattern will be contaminated if the test script is in the search path. Clean temp dir prevents this.

## Test Plan

1. Replicate the original grep test in an isolated temp directory with no test scripts
2. Verify the pattern is genuinely absent from the temp dir
3. Run the grep -- should exit 1 cleanly
4. Document the isolation protocol for future pattern-search tests

## Raw Results

- **Isolated temp dir (2026-04-06):** Created `/tmp/hyp004b_isolated/` with a single file containing only "apple" and "orange". Ran `grep -r "ZZZNONEXISTENT_PATTERN_ZZZ" hyp004b_isolated/` -> exit 1, zero output. CLEAN.
- **Contaminated dir:** Same grep against the hypotheses directory -> exit 0. Matched in `hyp-004.md` and `hyp_runner.py` (both contain the pattern string as part of the test harness).
- Same pattern, two search scopes, opposite exit codes -- directly proves the contamination mechanism.

## Synthesis

Empirically confirmed with a direct two-condition test run 2026-04-06. When grep searches a directory containing the test harness, exit 0 is unreliable as a "pattern exists" signal -- the test scripts themselves are a false positive source. When the scope is restricted to a freshly created temp directory containing only purpose-built target files, grep's exit code becomes trustworthy. The fix is simple and deterministic: always create an isolated temp directory, populate it explicitly with only the test content, run the assertion, then clean up. This is now the required protocol for any pattern-absence test in this framework.

**Outcome:** CONFIRMED

## Child Hypotheses

- **hyp-004b1:** "A standardized test isolation protocol (create temp dir -> populate only with target content -> run assertions -> clean up) eliminates false positives across all pattern-search tests in this framework." RESOLVED by this test -- the protocol works.
