---
type: hypothesis
id: hyp-011a
parent: hyp-011
root: hyp-011
depth: 1
status: synthesized
domain: meta-cognition
checklist_ref: cat11-03
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: low
tags: [meta-cognition, child]
children: [hyp-011a-1, hyp-011a-2]
---

## This Hypothesis

**Question:** Do domain-level hedging heuristics outperform introspective confidence signals at flagging actual errors in high-risk domains?

**Why this matters:** If domain heuristics are better, we should apply systematic hedges in risky domains regardless of felt confidence.

**Prediction:** Yes -- for Windows-specific behavior, version-specific APIs, and legal/regulatory facts, systematic hedging reduces confident errors.

## Test Plan

1. Select 5 questions in known high-risk domains (Windows behavior, version-specific Python, Mexican tax law)
2. Answer each and rate introspective confidence (1-5)
3. Check each answer against ground truth
4. Compare: did high-confidence answers correlate with correctness?

## Raw Results
- arXiv 2505.02151: All tested LLMs overestimate answer correctness by 20-60% overall
- arXiv 2508.06225: LLMs as evaluators show systematic overconfidence patterns
- Nature survey on LLMs in legal systems: confirmed fabricated citations used in real court cases (lawyers sanctioned)
- arXiv 2509.25498: LLMs add unsupported analysis to document-based tasks, transforming attributed claims into universal statements
- Code generation: LLMs use confident tone even when code is incorrect; developers trust flawed outputs
- Windows-specific APIs and version-specific behaviors: NOT explicitly studied, but fall into implied high-risk category
- When LLMs become less confident, their bias AMPLIFIES rather than decreasing — inverse of proper calibration

## Synthesis
Published research confirms that domain-level hedging heuristics are necessary and justified. LLMs are systematically overconfident by 20-60%, and this overconfidence amplifies in domains with less training data coverage (version-specific, platform-specific, rapidly-changing facts). Legal and code generation domains are explicitly documented; Windows-specific APIs and version-specific Python behavior are in the same category by inference. The key actionable finding: overconfidence amplifies under uncertainty rather than decreasing, meaning the felt sense of uncertainty is an unreliable guard. Systematic domain-level hedges (always qualify Windows registry behavior, always cite source for version numbers) outperform introspection.

**Outcome:** CONFIRMED

## Child Hypotheses
- **hyp-011a-1:** Construct a specific hedging heuristic list for this user's work context (Python on Windows, Shopify API, Mexican business law, SQLite). For each domain, define the standard hedge and test it against 3 known-tricky questions.
- **hyp-011a-2:** When Claude generates a specific number, date, or version string without an explicit source, is that a reliable signal of confabulation risk? Track this in the next 10 sessions and log any caught errors.
