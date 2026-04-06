---
type: hypothesis
id: hyp-006b
parent: hyp-006
root: hyp-006
depth: 1
status: synthesized
domain: user-model
checklist_ref: cat6-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: low
tags: [user-model, child]
children: []
---

## This Hypothesis

**Question:** Are specific prompt features (domain jargon, how-do-I vs why-does-X framing) more robust skill signals than surface markers like prompt length?

**Why this matters:** Better signal identification means better initial calibration and more useful first responses.

**Prediction:** Correct jargon use and why-framing are stronger signals than prompt length. Length is easily gamed; jargon precision is harder to fake.

## Test Plan

1. Collect or construct 10 prompts: mix of novice and expert at various lengths
2. Predict skill level from surface markers vs jargon/framing markers
3. Reveal true skill level and compare prediction accuracy of each signal type
4. Identify the 2-3 most reliable discriminators

## Raw Results
- No automated tests were executed for this hypothesis; no controlled prompt sets were constructed or evaluated.
- No empirical comparison between jargon/framing-based predictions and length-based predictions was performed.
- The hypothesis remains at the stage of a plausible theoretical prediction without supporting or contradicting data.
- The test plan (10 constructed prompts with revealed ground-truth skill levels) was not carried out.

## Synthesis
Without any experimental data, we cannot assess whether Claude's effective internal calibration relies more heavily on jargon precision and question framing than on surface features like prompt length. The prediction is theoretically reasonable—jargon precision is harder to fake and carries more information-theoretic content about domain familiarity—but this remains an untested intuition rather than a finding. The proposed test plan is well-structured and actionable, involving controlled prompt pairs that vary one feature at a time, and should be executed before drawing conclusions. No evidence currently supports or undermines the hypothesis.

**Outcome:** INCONCLUSIVE

## Child Hypotheses
- **hyp-006b-1:** When prompts are constructed to decouple jargon accuracy from length (e.g., short expert prompts with precise terminology vs. long novice prompts with vague language), does Claude's actual response calibration (measured by technical depth, assumed prerequisite knowledge, and hedging frequency) track jargon accuracy more closely than prompt length? This would be a direct operationalization of the untested parent hypothesis.
- **hyp-006b-2:** Does Claude exhibit a *jargon mimicry vulnerability*—i.e., does a novice who copy-pastes domain terms without understanding their relationships receive inappropriately expert-level responses—suggesting that jargon presence alone (without coherent usage) is an unreliable signal?
