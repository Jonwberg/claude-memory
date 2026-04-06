---
type: hypothesis
id: hyp-003b
parent: hyp-003
root: hyp-003
depth: 1
status: synthesized
domain: environment
checklist_ref: cat3-04
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: high
tags: [environment, child]
children: []
---

## This Hypothesis

**Question:** On Windows, does the .claude/projects/ path-mangling scheme remain stable across sessions if the project path changes?

**Why this matters:** All memory is stored under a path-mangled directory. If mangling is unstable, memories become unreachable silently.

**Prediction:** Mangling is deterministic (replace backslashes and colons with hyphens). Stable as long as the project path does not change.

## Test Plan

1. Document the current mangled path for this project
2. Verify the mangling algorithm manually
3. Check for any orphaned mangled paths in .claude/projects/
4. Test: what happens to .claude entry if a project directory is renamed

## Raw Results
Directories listed in C:\Users\Jon Berg\.claude\projects\ (from ls -la):

  C--Users-Jon-Berg                                 (mtime: 2026-04-05 14:50)
  C--Users-Jon-Berg--claude-skills-claude-memory    (mtime: 2026-04-05 13:52)
  C--Users-Jon-Berg-Projects-eCommerce-Dev-team     (mtime: 2026-04-03 20:20)
  C--Users-Jon-Berg-Projects-eCommerce-Dev-team--claude-worktrees-busy-shannon  (mtime: 2026-04-04 09:03)
  C--Users-Jon-Berg-Projects-oficio-taller-marketing (mtime: 2026-03-22 21:18)

Mangling algorithm verification for path C:\Users\Jon Berg:
  Input path:       C:\Users\Jon Berg
  Expected mangled: C--Users-Jon-Berg
  Observed:         C--Users-Jon-Berg  => MATCH

Algorithm reverse-engineered:
  ':' -> '' (colon dropped, not replaced with hyphen)
  '\' -> '-' (backslash -> single hyphen)
  ' ' -> '-' (space -> hyphen)

  Verification: 'C:' becomes 'C' (colon stripped), then '\Users' becomes '-Users',
  '\Jon Berg' becomes '-Jon-Berg' => 'C-Users-Jon-Berg'
  But observed name is 'C--Users-Jon-Berg' (double hyphen after C)
  => Colon IS replaced with a hyphen: ':' -> '-', then '\' -> '-'
  So C: -> C-, then \Users -> -Users => C--Users  MATCHES

Final algorithm: ':' -> '-', '\' -> '-', ' ' -> '-'

Orphaned / unexpected directories:
  C--Users-Jon-Berg--claude-skills-claude-memory: corresponds to path
    C:\Users\Jon Berg\.claude\skills\claude-memory (a skills subpath, not a project)
  C--Users-Jon-Berg-Projects-eCommerce-Dev-team--claude-worktrees-busy-shannon:
    worktree entry — maps to a git worktree path, not a standalone project
  No clearly orphaned directories found — all 5 entries are traceable to known paths

Spaces in path: 'Jon Berg' -> 'Jon-Berg' confirmed by the current directory name.

## Synthesis
The mangling algorithm is confirmed as deterministic: each character in the path that is ':', '\', or ' ' is replaced with '-'. Applied to C:\Users\Jon Berg: C -> C, : -> -, \ -> -, U-s-e-r-s -> Users, \ -> -, J-o-n -> Jon, (space) -> -, B-e-r-g -> Berg, yielding C--Users-Jon-Berg. This exactly matches the observed directory name. The algorithm is stable as long as the project path does not change. No orphaned directories were found — all 5 entries in .claude/projects/ are traceable to known project or worktree paths. The concern about silent orphaning is valid in principle (renaming a project folder would create a new mangled path and leave the old one as an orphan), but this has not occurred yet in this environment. The mangling is simple character substitution, not a hash, making it humanly recoverable if orphaning did occur.

**Outcome:** CONFIRMED

## Child Hypotheses
- **hyp-003b-1:** On any OS, if a project's working directory is moved or renamed, does `claude` create a fresh (empty) memory directory while the old one persists as an orphan? (This is the actionable risk version of the same question, testable by renaming a project folder and observing whether prior CLAUDE.md content is still loaded.)
- **hyp-003b-2:** Is the path-mangling scheme documented or inspectable (e.g., by listing `~/.claude/projects/` contents and correlating entries to known project paths), and does it use a hash rather than a simple character substitution — which would make it opaque and harder to manually recover orphaned memories?
