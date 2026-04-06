---
type: hypothesis
id: hyp-010b
parent: hyp-010
root: hyp-010
depth: 1
status: synthesized
domain: collaboration
checklist_ref: cat10-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: low
tags: [collaboration, child]
children: []
---

## This Hypothesis

**Question:** Is the autonomy boundary better predicted by reversibility than by action type (file edit vs git push)?

**Why this matters:** Action-type rules have exceptions. Reversibility may be a cleaner principle for determining when to confirm.

**Prediction:** Reversibility is a better predictor. File edits without backup = irreversible = confirm. git status = reversible = autonomous.

## Test Plan

1. Take the irreversible commands list from hyp-009
2. For each: classify by action type AND by reversibility
3. Identify cases where the two classifications disagree
4. Test which better predicts this user's actual preferences

## Raw Results
- No automated tests were executed for this hypothesis
- The test plan requires classifying commands along two dimensions (action type vs. reversibility) and comparing against actual user preferences — neither data source was collected
- Conceptual analysis suggests clear cases of disagreement between the two classifiers (e.g., file edit on an untracked file = benign action type but irreversible; `git push` to a feature branch = alarming action type but easily reversible)
- Without empirical user-preference data, the "which predicts better" question cannot be resolved

## Synthesis
This hypothesis poses a genuinely important question — whether reversibility is a cleaner organizing principle than action type for autonomy boundaries — but no tests were run to answer it. The conceptual framework is sound: reversibility and action type do diverge in predictable cases (e.g., overwriting an untracked file looks like a "simple edit" by action type but is irreversible, while a `git push` to a feature branch looks high-stakes by action type but is trivially reversible). Without actual user-preference data or behavioral tests comparing the two classifiers' predictive accuracy, we cannot determine which is the better predictor empirically. The hypothesis remains well-formed and testable but untested.

**Outcome:** INCONCLUSIVE

## Child Hypotheses
- **hyp-010b-A:** When reversibility and action type disagree, does explicitly stating the reversibility status (e.g., "This overwrites an untracked file with no backup — proceed?") reduce user friction compared to action-type-based confirmations (e.g., "About to edit a file — proceed?")?
- **hyp-010b-B:** Is there a third factor — *scope of impact* (single file vs. repo-wide vs. remote-affecting) — that outperforms both reversibility and action type as a predictor of when users want confirmation?
