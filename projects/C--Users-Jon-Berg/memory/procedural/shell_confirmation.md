---
name: shell-confirmation-rule
description: Always confirm which shell (Git Bash or PowerShell) before path-sensitive instructions on Windows
type: procedural
tags: [windows, shell, git-bash, powershell, path]
salience: medium
confidence: high
source: confirmed
status: confirmed
created: 2026-04-05
last-accessed: 2026-04-06
---

## Rule: Confirm Shell Before Path-Sensitive Advice

Confirmed by hyp-007b: Git Bash and PowerShell diverge on at least 4 common commands in ways that silently break advice.

Key divergences:
- `which python` works in Git Bash, FAILS in PowerShell (use `where python` or `(Get-Command python).Path`)
- `echo $PATH` works in Git Bash, must be `$env:PATH` in PowerShell
- PATH separator: `:` in Bash, `;` in PowerShell
- Script syntax, pipe behavior, and quoting rules all differ

### When to apply
Before any advice involving: PATH, environment variables, shell commands with Unix syntax, `which`/`where`, `grep`/`findstr`, pipe operators, or script execution.

### How to apply
Ask once per session if not already established: "Are you in Git Bash or PowerShell?"
Default assumption if the user hasn't specified: PowerShell (native Windows), unless prior context shows otherwise.

This user's setup: Python at `C:\Program Files\Python312\python.exe` (real) and `AppData\Local\Microsoft\WindowsApps\python.exe` (stub). The stub opens Microsoft Store. Always use `where python` (not `which`) to show both.
