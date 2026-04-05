---
name: claude-memory
description: Use when saving, updating, or retrieving memories across conversations. Use when user says "remember this", "forget that", or when you learn something worth preserving. Covers layer selection, save process, conflict resolution, and decay rules for the four-layer memory system.
---

# Claude Memory 2.1

## Overview

Memory is stored in four layers modeled on biological memory systems. Each layer has different persistence, decay, and update rules. Two hooks automate retrieval (session start) and consolidation (session end).

```
memory/
  episodic/      ← session-specific, decays in 90 days
  semantic/      ← distilled timeless facts, updated in-place
  procedural/    ← behavioral rules (feedback.md only)
  reference/     ← external pointers
  MEMORY.md      ← human-readable index, rebuilt by consolidation
  .index.json    ← machine-readable index, primary retrieval surface
```

## Layer-Selection Decision Tree

Check in order — use first match:

1. **Reference** — "X can be found at Y" (pointer to external location)
   → `reference/external-systems.md`

2. **Procedural** — describes how Claude should work/communicate/approach tasks. Single instance sufficient.
   → `procedural/feedback.md` (dedup by `## Title`)

3. **Semantic** — distilled timeless fact about user or project. No episode detail.
   → `semantic/` — update existing file if ≥2 tag overlap; else create new file

4. **Episodic** (default) — session-specific: what happened today.
   → `episodic/YYYY-MM-DD-slug.md` (set `decay-after: created + 90 days`)

## Save Process

1. Apply decision tree above
2. Write file with full frontmatter (new files start at `salience: medium`)
3. Consolidation hook rebuilds `MEMORY.md` and `.index.json` at session end

### Frontmatter Template
```yaml
---
type: semantic
tags: [keyword1, keyword2, keyword3]
salience: medium
confidence: high | medium | low
source: observed | inferred | instructed | referenced
status: confirmed | open | provisional | superseded
trigger: []
related: []
created: YYYY-MM-DD
last-accessed: YYYY-MM-DD
---
```

For episodic files, also include:
```yaml
retention: temporary
decay-after: YYYY-MM-DD
```

### Field Defaults
- `confidence`: `high` for semantic/procedural (distilled facts), `medium` for episodic
- `source`: `observed` for facts from conversation; `instructed` for behavioral rules; `inferred` for deduced facts; `referenced` for pointers
- `status`: `confirmed` for semantic/procedural/reference; `open` for episodic
- `trigger`: leave empty unless this is a Solution entry (see below)

### Tag Rules
- 3–6 tags per file. Concrete nouns, tool names, domain terms.
- Use canonical noun forms: `scraping` not `scraper`, `pagination` not `paginate`.
- MEMORY.md displays tags space-separated in backticks: `` `shopify sqlite pagination` ``

## Recursive Learning: Auto-Save Struggle Solutions

**Rule:** When you retry a tool call, hit an error, change approach mid-task, or explicitly backtrack — save the learning automatically at session end. Do not ask the user first.

**Trigger for saving:** Any of these signals:
- A tool call fails and you try a different approach
- You produce output, then correct it in the same session
- You spend >2 attempts on the same sub-problem
- You explicitly say "that didn't work" or "let me try differently"

**Where to save:** A `## Solution:` entry in `procedural/feedback.md`.

### Solution Entry Format

```markdown
## Solution: {kebab-case-slug}

**Symptom:** What the problem looked like / the error or confusion
**Failed:** What approach didn't work, and why
**Solution:** The exact thing that worked

**Why:** Root cause
**How to apply:** When to reach for this
```

Add to the file's frontmatter `trigger` field the keywords that describe the symptom — these are indexed separately and score at 2× weight during retrieval, so the solution surfaces when the same problem context arises next time.

```yaml
trigger: [keyword-from-symptom, error-name, api-name, tool-name]
```

**Example:**
```markdown
## Solution: windows-pip-scripts-not-on-path

**Symptom:** Command not found after `pip install` on Windows
**Failed:** Assumed scripts land on system PATH
**Solution:** Scripts go to `AppData\Roaming\Python\Python312\Scripts` — verify with `where python` before assuming a command is available

**Why:** Windows pip installs to user Scripts dir, not system PATH
**How to apply:** Any time a pip-installed CLI tool is missing on Windows
```

With frontmatter `trigger: [windows, pip, path, command-not-found, scripts]`.

## Retrieval Process

**Session start:** Retrieval hook runs automatically — reads `.index.json` (primary) or falls back to `MEMORY.md` parsing. Injects top-N relevant files based on cue keywords. No action needed.

**During session:** If a loaded file conflicts with current info → update the specific sentence in-place (Path 1 reconsolidation). Write one-line note in episodic file.

**Session end:** Write episodic summary if notable facts emerged. Consolidation hook runs automatically and rebuilds both `.index.json` and `MEMORY.md`.

## Conflict Resolution

- **Conflict** = loaded file claim contradicts current conversation
- **Path 1 (mid-session):** Update conflicting sentence in-place. Newer wins.
- **Path 2 (consolidation-time):** Episodic claim wins over semantic. Retain old as `<!-- superseded DATE: previously X -->` ONLY for rule reversals.
- **Tiebreaker:** Higher salience wins → more recent `created` date wins.
- Mark superseded claims with `status: superseded` in frontmatter if the entire file is obsolete.

## Decay Rules

- Episodic files have `decay-after` (default: created + 90 UTC days)
- Consolidation hook absorbs all facts from expired episodics at sentence/claim level, then deletes the file
- Semantic files are never deleted — only updated in-place

## Claim-Level Consolidation

Consolidation extracts claims at sentence level (not paragraph level). Each sentence is:
1. Classified: behavioral (→ procedural) or factual (→ semantic)
2. Deduped against the target file before appending
3. Absorbed into the best matching file by tag overlap

## Procedural Format

```markdown
## Rule Title

Rule statement — imperative.

**Why:** Reason.
**How to apply:** When this kicks in.
```

Before writing: check for existing `## Title` (case-insensitive). Amend in-place if found.

## What NOT to Save

- Code patterns, architecture, file paths — read the code
- Git history — use `git log` / `git blame`
- Debugging fixes — the fix is in the code
- Ephemeral task state (current conversation only)
- Anything already in CLAUDE.md

## Hypothesis Protocol — Reactive Triggering

When an unknown from the world navigation checklist surfaces naturally in a session:

1. **Identify the unknown** — does it map to one of the 11 domains? (perception, memory, environment, causation, feedback, user-model, knowledge, time, action, collaboration, meta-cognition)

2. **Check if already being explored** — call `hypothesis_status()` or `hypothesis_list(domain="...")` via MCP tool

3. **Create a hypothesis if new** — call `hypothesis_create()` with:
   - A specific, testable question (not vague)
   - A concrete prediction
   - Why it matters to this session
   - The domain

4. **Continue the session** — don't wait for the experiment. The experimenter picks it up in the next cron run.

### When to Create a Hypothesis Mid-Session

Create one when:
- A bash command behaves unexpectedly and you're not sure why
- You discover a behavior that contradicts an existing memory
- The user reveals something about their environment you've never verified
- You find yourself saying "I'm not sure if..." about something testable

Do NOT create hypotheses for:
- Things already confirmed in memory (check first)
- Vague feelings of uncertainty (must be a concrete testable question)
- Things the user has explicitly told you (observe, don't verify stated facts)

### Hypothesis Depth and Rabbit Holes

Child hypotheses are spawned automatically by the synthesizer. You do not need to manage the tree. If you're curious about the state of an ongoing investigation, use `hypothesis_get(id)` to see the full lineage.
