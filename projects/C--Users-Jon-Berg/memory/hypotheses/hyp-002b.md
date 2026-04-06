---
type: hypothesis
id: hyp-002b
parent: hyp-002
root: hyp-002
depth: 1
status: synthesized
domain: memory
checklist_ref: cat2-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-06
synthesized: 2026-04-06
confidence: medium
tags: [memory, child]
children: []
---

## This Hypothesis

**Question:** Does the format or structure of what is written to memory (bare fact vs structured entry) affect retrieval fidelity?

**Why this matters:** If structured entries are retrieved more reliably, we should always use structured format. Informs memory-writing discipline.

**Prediction:** Structure matters for findability but not retrieval once in context. MEMORY.md index description quality matters most.

## Test Plan

1. Write the same fact in two formats: bare vs structured with frontmatter
2. Test retrieval of each across sessions
3. Compare how well each is applied to a relevant task

## Raw Results

- **Structured file (test_fact_structured.md):** Had frontmatter + why + context. Was indexed in MEMORY.md with: "The blue cardinal number is 7442."
- **Bare file (test_fact_bare.md):** Just the raw fact string. Was NOT indexed in MEMORY.md.
- **Retrieval outcome:** Structured fact appeared in session context via MEMORY.md. Bare fact did not appear at all.
- **Confounding variable:** The test conflated format (structured vs bare) with indexing (indexed vs not indexed). The bare file was never added to MEMORY.md, making it impossible to isolate format as the causal variable.
- **Key finding from hyp-002a:** MEMORY.md description content is what drives availability, not the underlying file's internal format.

## Synthesis

The test was confounded: format and indexing were not varied independently. The structured file was indexed; the bare file was not. We cannot conclude that format caused the retrieval difference -- indexing did. However, the test surfaced a more important insight: the internal format of a memory file (structured vs bare) is largely irrelevant once the file is indexed. What matters is the MEMORY.md description line quality. A well-written one-liner in MEMORY.md delivers the fact into every session context automatically. The structure of the underlying file only matters insofar as it helps the writer produce a better MEMORY.md description. Recommendation: write memory files in whichever format produces the best one-liner for MEMORY.md, not for aesthetic completeness.

**Outcome:** PARTIAL

## Child Hypotheses

- **hyp-002b-a:** Isolate format from indexing: add test_fact_bare.md to MEMORY.md with a one-liner and test whether bare-file facts are retrieved equally well. Prediction: yes, the one-liner is the only thing that matters, file format is irrelevant.
- **hyp-002b-b:** Test whether MEMORY.md description richness (keyword count, specificity) affects which memory is surfaced when two memories are semantically adjacent. This tests description-as-retrieval-key rather than file content.
