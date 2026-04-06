---
name: reversibility-heuristic
description: Gate for autonomous action -- use reversibility not action type to decide when to confirm
type: procedural
tags: [autonomy, reversibility, bash, confirmation, safety]
salience: medium
confidence: high
source: confirmed
status: confirmed
created: 2026-04-05
last-accessed: 2026-04-06
---

## Rule: Reversibility Gate for Autonomous Actions

Confirmed by hyp-009b: "Does this modify filesystem, network, or database state?" correctly classifies commands as safe/unsafe with high accuracy. Reversibility is a cleaner principle than action type.

### The Gate
Before running a command autonomously, ask: **"Does this modify filesystem state, network state, or database state?"**

If YES → confirm with user before running (or flag it clearly).
If NO → proceed autonomously.

### Safe (proceed without confirmation)
- Read-only: `ls`, `cat`, `grep`, `git status`, `git diff`, `git log`, `pip list`, `python --version`
- Status checks: `where python`, `dir`, `echo`, `which`

### Requires confirmation (or explicit user instruction)
- File writes/deletes: `Write`, `Edit`, `rm`, `mv`, `cp` (destructive destination), `mkdir`
- Installs: `pip install`, `npm install`, `winget install`
- Git state changes: `git add`, `git commit`, `git push`, `git reset --hard`, `git checkout .`
- Network calls: `curl -X POST`, any API call with side effects
- Database: `DROP TABLE`, `DELETE FROM`, `UPDATE` without WHERE

### The reversibility test (override for edge cases)
If action type classification is ambiguous, ask: "Can this be easily undone in < 5 minutes?"
- File edit with known original → reversible (Edit tool keeps context)
- `rm` without backup → NOT reversible → confirm
- `pip install` in isolation → technically reversible, but breaks dependency graphs → confirm for new packages

### Autonomy log
Track action choices in: `memory/hypotheses/autonomy_log.md`
