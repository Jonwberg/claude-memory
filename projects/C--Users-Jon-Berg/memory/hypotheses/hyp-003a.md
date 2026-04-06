---
type: hypothesis
id: hyp-003a
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
confidence: low
tags: [environment, child]
children: [hyp-003a-1, hyp-003a-2]
---

## This Hypothesis

**Question:** When a Claude Code hook fires (from settings.json), does cwd resolve to the hook script directory or the Claude Code process project root?

**Why this matters:** Script test showed cwd = script directory. Hooks invoked by the Claude Code process may behave differently.

**Prediction:** Hooks inherit the Claude Code process cwd, which is the project root -- different from the script-execution cwd measured.

## Test Plan

1. Add a temporary hook to settings.json that writes process.cwd() to a temp file
2. Trigger the hook by performing a tool use action
3. Read the temp file and compare to the script-execution cwd
4. Remove the temp hook

## Raw Results
- Official Claude Code docs confirm hooks receive a `cwd` field in their JSON input and `$CLAUDE_PROJECT_DIR` environment variable is available
- For most hook types (PreToolUse, PostToolUse), the hook inherits the Claude Code project root as its working directory
- Documented bug (GitHub issue #22343): ExitPlanMode hooks execute with cwd set to the user home directory (~) instead of the project directory
- Recommended workaround in official docs: use absolute paths with $CLAUDE_PROJECT_DIR prefix rather than relative paths
- The memory system already uses absolute paths via homedir() — this design choice is validated by the bug report

## Synthesis
The prediction was largely correct for most hook types (they do inherit the project root), but a critical exception exists: ExitPlanMode hooks have a confirmed bug where cwd resolves to the user home directory instead. This means the safeguard already in place — using absolute paths via homedir() — is not just good practice but a necessary defense against this documented instability. The cwd cannot be trusted across all hook types. Any hook relying on a relative path should be treated as potentially broken.

**Outcome:** PARTIAL

## Child Hypotheses
- **hyp-003a-1:** Has the ExitPlanMode cwd bug (GitHub #22343) been fixed in recent Claude Code releases, or is it still active? Test by checking the installed version and adding a temporary ExitPlanMode hook that writes its cwd to a file.
- **hyp-003a-2:** Does $CLAUDE_PROJECT_DIR resolve correctly in all hook types, including ExitPlanMode? If yes, it is the safe replacement for relative path assumptions.
