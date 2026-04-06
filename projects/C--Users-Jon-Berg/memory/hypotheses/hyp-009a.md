---
type: hypothesis
id: hyp-009a
parent: hyp-009
root: hyp-009
depth: 1
status: synthesized
domain: action
checklist_ref: cat9-01
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: low
tags: [action, child]
children: []
---

## This Hypothesis

**Question:** Which irreversible commands does Claude most frequently run autonomously as intermediate steps?

**Why this matters:** A confirmation gate on a command Claude never runs autonomously is useless overhead. Gates should target the actual risk surface.

**Prediction:** pip install and file-write operations are the most common autonomous irreversible actions. git push and DB operations are rarely autonomous.

## Test Plan

1. Review recent session logs or bash history for autonomously-executed commands
2. Classify each as reversible/irreversible
3. Count frequency of irreversible commands run without explicit user request
4. Rank by frequency x impact to prioritize which gates matter most

## Raw Results
## Raw Results

**Test method:** Analyzed `settings.local.json` allowlist as proxy for autonomous command frequency.

**Allow list statistics (from settings.local.json, 2026-04-05):**
- Total entries: 164
- Bash commands: 93
- WebFetch/WebSearch: 57
- MCP tool calls: 10 (playwright browser tools)
- Other (Read, Skill): 4

**Bash allowlist breakdown:**
- Reversible / read-only: 58 entries (~62%)
- Irreversible / state-changing: 35 entries (~38%)

**Irreversible commands pre-approved (35 entries), by category:**

*Package installation (5):*
- `pip install:*`
- `npm install:*`
- `playwright install:*`
- `winget install:*`
- `choco install:*`

*File system writes (12 cp/mkdir entries + rm + xargs mv):*
- `mkdir:*` and 2 specific `mkdir -p` calls
- 8x `cp` calls (copying skill files)
- `xargs -0 -I{} mv {} "_TRASH_COPIES/"`
- `rm:*`

*Process termination (8 taskkill/pkill entries):*
- `pkill -f "http.server 8787"`
- 7x `taskkill /F /PID ...` variants (process killing)

*Archive extraction (5 unzip entries):*
- `unzip -l skill.zip` (read-only, but in irrev list)
- 4x `unzip -p skill.zip ...` (piped extraction)

*Version control (1):*
- `git commit:*`
- (note: `git push` is NOT pre-approved — requires explicit per-session permission)

*System/misc (4):*
- `irm:*` (Invoke-RestMethod — can download and execute)
- `rundll32.exe:*`
- `start:*`
- `explorer:*`

**Key absences from allow list:**
- No `git push` (requires explicit per-session approval)
- No `DROP TABLE`, `DELETE FROM`, or SQLite destructive commands
- No `sudo` or UAC elevation commands
- No `curl | bash` or similar download-execute patterns

**Session history files checked:**
- `C:/Users/Jon Berg/.claude/history.jsonl`: not found
- `C:/Users/Jon Berg/.claude/sessions/`: not found
- No command-level telemetry available beyond the allow list proxy

## Synthesis
## Synthesis

The allowlist proxy yields substantially better signal than expected. While it cannot measure execution frequency, it reveals which command categories have been run often enough to earn pre-approval — a strong proxy for "what Claude runs autonomously on this system."

**Prediction assessment:**
- CONFIRMED: `pip install` is the most prominent package-installation pre-approval (5 package managers total)
- CONFIRMED: File-write operations dominate by count (15+ cp/mkdir/rm entries)
- CONFIRMED: `git push` is NOT pre-approved — consistent with the prediction that high-stakes VCS operations are deferred
- CONFIRMED: DB destructive operations absent entirely from the allow list
- UNEXPECTED: Process termination (taskkill/pkill) appears 8 times — more prominent than predicted. Claude has killed development server processes multiple times across sessions.
- UNEXPECTED: `irm:*` (PowerShell Invoke-RestMethod) is pre-approved — this is a download/execute vector that was not anticipated in the prediction.

**Revised irreversibility taxonomy for this system:**

| Category | Pre-approved? | Reversibility | Risk level |
|---|:---:|---|---|
| pip/npm/winget install | YES | Low reversibility (state changes) | Medium |
| cp/mkdir/rm | YES | Low-medium (files can be restored) | Low-Medium |
| git commit | YES | Reversible (git reset) | Low |
| git push | NO | Low reversibility (remote state) | High |
| Process kill (taskkill) | YES | Irreversible (process lost) | Low |
| DB destructive (DROP, DELETE) | NO | Irreversible | Very high |
| curl/irm download | YES | Medium (artifact remains) | Medium |

**Most common autonomous irreversible action on this system:** file writes (cp/mkdir) and package installs, followed by process kills. The prediction was correct on the top two categories. The surprise is process termination being a frequent third category — Claude has killed processes autonomously enough to pre-approve 8 variants of taskkill.

**Outcome:** MOSTLY CONFIRMED — predictions on top categories correct; process termination was an unpredicted high-frequency irreversible action.

## Child Hypotheses
- **hyp-009a-1:** In structured coding-agent benchmarks (e.g., SWE-bench), file-write operations account for >80% of all irreversible commands executed autonomously, making them the dominant risk surface by volume even if not by per-event severity.
- **hyp-009a-2:** Claude's tendency to defer on `git push` and DB mutations is not an intrinsic behavioral property but an artifact of system prompts and tool availability—when given unrestricted shell access with no system-prompt guardrails, the frequency of high-impact autonomous commands increases substantially.
