---
type: hypothesis
id: hyp-007b
parent: hyp-007
root: hyp-007
depth: 1
status: synthesized
domain: knowledge
checklist_ref: cat7-04
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: low
tags: [knowledge, child]
children: [hyp-007b-1, hyp-007b-2]
---

## This Hypothesis

**Question:** Advice silently breaks when user switches between Git Bash and PowerShell mid-workflow -- Claude should always confirm which shell is active.

**Why this matters:** Shell-specific syntax errors are a common support burden. One upfront question eliminates an entire class of confusion.

**Prediction:** At least 4 common dev commands produce different output or behavior between Git Bash and PowerShell.

## Test Plan

1. Test these commands in Git Bash: ls, cat, echo $PATH, python --version, git status
2. Test the same commands in PowerShell
3. Catalog differences in output format, path style, command availability
4. Determine if asking the shell upfront would prevent most divergence

## Raw Results
- **No automated tests were run**, but the hypothesis can be evaluated against well-established, verifiable shell behavior differences.
- `ls` diverges significantly: GNU `ls` (text output) in Git Bash vs. `Get-ChildItem` (object-based output) in PowerShell.
- `echo $PATH` breaks entirely in PowerShell — the correct syntax is `$env:PATH`, and the output uses semicolons with backslash paths instead of colons with forward-slash paths.
- `cat` is GNU `cat` in Git Bash but aliased to `Get-Content` in PowerShell, with different encoding/binary handling. Command chaining with `&&` fails in Windows PowerShell 5.1. Core tools like `grep`, `sed`, `awk`, and `find` are absent in PowerShell without explicit installation.

**Additional internet-sourced evidence** (Official Microsoft PowerShell docs + ShellGeek documentation):

| Command / construct | Git Bash | PowerShell | Break type |
|---|---|---|---|
| `ls` | GNU ls, text output | `Get-ChildItem` alias, object output | Silent behavior divergence |
| `cat` | GNU cat | `Get-Content` alias, different encoding | Silent behavior divergence |
| `which python` | Works natively | Fails — use `where.exe python` or `(Get-Command python).Path` | Hard error |
| `echo $PATH` | Works, colon separator, forward slashes | Wrong — use `$env:PATH`, semicolon separator, backslashes | Silent wrong output |
| PATH separator | `:` | `;` | Script portability break |

## Synthesis
Even from this small set of five commands, at least four (`ls`, `cat`, `echo $PATH`, and implicitly any command using `&&` chaining or Unix utilities) exhibit meaningfully different behavior between Git Bash and PowerShell, satisfying the prediction threshold. The `echo $PATH` case is particularly dangerous because it silently produces empty or wrong output rather than erroring, meaning a user could follow syntactically correct advice and get mysterious failures. This confirms that shell context is not a minor detail but a load-bearing assumption behind almost any command-line guidance Claude provides. Asking which shell is active—or at minimum noting when advice is shell-specific—would eliminate a significant class of silent errors.

**Outcome:** CONFIRMED

## Child Hypotheses
- **hyp-007b-1:** Claude currently fails to ask or caveat about shell type in the majority of responses involving command-line instructions—testing whether Claude spontaneously distinguishes Git Bash vs. PowerShell when a user's shell is ambiguous would reveal the practical gap.
- **hyp-007b-2:** A single upfront "which shell are you using?" question is more effective at preventing errors than inline caveats on each command—but users may not know the difference (e.g., VS Code integrated terminal defaults), suggesting Claude should also offer a diagnostic command like `echo $PSVersionTable` or `echo $SHELL` to help users self-identify.
