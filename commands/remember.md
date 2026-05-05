---
description: Save a claim to today's episodic WIP for Enzo memory auto-learning
argument-hint: <claim text>
allowed-tools: Bash
---

Use the Bash tool to invoke this command, with the user's argument passed as a single quoted argument to the script (handle any shell-escaping needed):

```
node "C:/Users/Jon Berg/.claude/skills/claude-memory/remember.mjs" "$ARGUMENTS"
```

After the command runs, confirm to the user in one short line that the claim was saved. The note will be absorbed by Phase 1 of consolidation on the next Stop hook and upserted to Pinecone for semantic retrieval next session.
