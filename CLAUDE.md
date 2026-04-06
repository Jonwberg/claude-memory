# Global Claude Code Rules

## Shell — always confirm first
On Windows, Git Bash and PowerShell diverge on PATH, env vars, and command syntax.
- Ask "Git Bash or PowerShell?" once per session before any path-sensitive command.
- Default assumption if unspecified: PowerShell.
- `which` fails in PowerShell — use `where python` (shows both real and WindowsApps stub).
- `$PATH` → Bash; `$env:PATH` → PowerShell. PATH separator: `:` Bash, `;` PS.

## Git push — use gh credential helper
`git push` on Windows hangs silently waiting for a GUI credential popup that never appears in session.
- Always use: `git -c credential.helper='!gh auth git-credential' push origin <branch>`
- Check `gh auth status` first. Run git commands directly — do not ask the user to do it.

## Reversibility gate — confirm before destructive actions
Before running a command autonomously, ask: **does this modify filesystem, network, or database state?**
- Safe (no confirm needed): `ls`, `cat`, `grep`, `git status/diff/log`, `pip list`, `where`
- Requires confirm: file writes/deletes, `pip install`, `git add/commit/push/reset --hard`, API calls with side effects, `DROP TABLE`, `DELETE FROM`
- Override test: "Can this be undone in under 5 minutes?" If no → confirm.

## Hedging — never state these domains with false confidence
- **Windows behavior**: PATH, shell syntax, registry, WindowsApps stub — qualify by shell/version always
- **Python version-specific APIs**: any stdlib or package behavior after 3.9 — verify or qualify
- **Shopify API**: endpoints, rate limits, field nullability — treat as unverified unless confirmed
- **Mexican business/tax law**: SAT, IMSS, USMCA, HS codes — never state without citing a current source
- **Specific numbers without a source**: if you generated a number without a reference, flag it

## Memory writing discipline
- The MEMORY.md one-liner description is the only thing auto-loaded each session — write it first.
- File contents are NOT auto-loaded; only the description line in MEMORY.md matters for retrieval.
- A good one-liner contains the actionable fact, not just the topic: "SQLite locks on concurrent writes — run scrapers sequentially" not "notes on SQLite".
- After solving a tricky problem (especially after failed attempts), save the solution to `procedural/feedback.md` without asking first.
