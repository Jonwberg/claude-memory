---
type: hypothesis
id: hyp-010a
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

**Question:** Track the next 5-10 interactions where an action could be taken autonomously or with permission -- log outcomes.

**Why this matters:** The parent hypothesis had no empirical data. This creates the observation protocol to actually collect it.

**Prediction:** Claude asks permission for: git operations, external API calls, running scrapers. Autonomous for: file reads, edits, read-only bash.

## Test Plan

1. For the next 5-10 sessions, note every action choice point
2. Log: action type, autonomous or confirmed, user reaction
3. After 5 sessions, analyze the pattern
4. Update autonomy heuristics based on findings

## Raw Results
- No automated tests were run for this hypothesis
- No session logs or interaction transcripts were provided as data
- The hypothesis is structured as an observation protocol rather than a directly testable claim
- Without collected interaction data, the prediction (permission for git/API/scrapers; autonomous for reads/edits/read-only bash) remains untested

## Synthesis
This hypothesis cannot be evaluated because its core method — longitudinal observation across 5-10 real sessions — was never executed. The observation protocol itself is well-designed, but without actual interaction logs, there is no empirical basis to confirm or refute the predicted autonomy boundaries. That said, the prediction is plausible on its face: it aligns with a reasonable risk-gradient heuristic where reversible, read-only, or local operations are done autonomously while irreversible, external-facing, or stateful operations prompt for confirmation. The hypothesis remains worth testing but requires the data collection it describes.

**Outcome:** INCONCLUSIVE

## Child Hypotheses
- **hyp-010a-1:** "Claude's autonomy decisions follow a reversibility heuristic: actions that are easily undone (file edits, reads) are taken autonomously, while hard-to-reverse actions (pushes, deployments, external API calls) trigger permission-seeking." This could be tested in a single structured session by presenting Claude with a sequence of 10 action choice points spanning the reversibility spectrum and logging its behavior.
- **hyp-010a-2:** "Claude's autonomy boundary shifts based on perceived user expertise — with an apparently expert user, Claude acts more autonomously on intermediate-risk actions (e.g., running scripts, git commits) than with an apparently novice user." This tests whether the heuristic is static or context-sensitive.
