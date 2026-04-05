# Hypothesis Testing Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous hypothesis testing agent that explores Claude's world-navigation unknowns via recursive experiments, synthesizes findings via Claude API, and exposes everything through an MCP server.

**Architecture:** Three independent agents (Experimenter, Synthesizer, MCP Server) communicate through files in `memory/hypotheses/`. Experimenter runs tests via `claude -p`, Synthesizer calls Claude API (`claude-opus-4-6`) to classify results and spawn child hypotheses, MCP Server exposes 9 tools for live session access. A 130-item checklist across 11 domains seeds the hypothesis queue.

**Tech Stack:** Node.js v24 ESM, `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, existing memory-utils.mjs patterns

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `skills/claude-memory/package.json` | **Create** | npm deps for @anthropic-ai/sdk and @modelcontextprotocol/sdk |
| `skills/claude-memory/hypothesis-utils.mjs` | **Create** | ID gen, read/write hypothesis files, queue ops, lineage assembly, lock management |
| `skills/claude-memory/hypothesis-config.json` | **Create** | max_depth, max_per_run, max_tree_width, model, blocked_commands, approval_patterns |
| `skills/claude-memory/test-hypothesis-utils.mjs` | **Create** | Unit tests for all hypothesis-utils functions |
| `memory/hypotheses/checklist.md` | **Create** | 130-item world navigation checklist across 11 domains |
| `memory/hypotheses/hypothesis-queue.json` | **Create** | Machine-readable tree index, seeded by bootstrap |
| `memory/hypotheses/needs-review.md` | **Create** | Blocked/depth-limit hypotheses for human review |
| `skills/claude-memory/bootstrap-hypotheses.mjs` | **Create** | One-time seed: creates 11 starter hypothesis files + initial queue |
| `skills/claude-memory/experimenter.mjs` | **Create** | Cron-triggered: picks hypothesis, calls `claude -p`, writes raw results |
| `skills/claude-memory/synthesizer.mjs` | **Create** | Triggered by experimenter: Claude API call, classify, spawn children, write memory |
| `skills/claude-memory/mcp-server.mjs` | **Create** | Always-on MCP server exposing 9 tools over stdio |
| `skills/claude-memory/memory-utils.mjs` | **Modify** | Add HYPOTHESES_DIR, SKILL_DIR constants |
| `skills/claude-memory/SKILL.md` | **Modify** | Add hypothesis protocol section |
| `.claude/settings.json` | **Modify** | Register MCP server + experimenter cron |

**Paths used throughout this plan:**
- Skills dir: `C:/Users/Jon Berg/.claude/skills/claude-memory/`
- Memory dir: `C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/`
- Project dir: `C:/Users/Jon Berg/Projects/Claude Memory/`

---

## Prerequisite: Set ANTHROPIC_API_KEY

The synthesizer calls the Claude API. Before running Task 8, ensure `ANTHROPIC_API_KEY` is set in your environment:
```bash
# Add to your shell profile (e.g. ~/.bashrc or Windows environment variables)
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Task 1: Package Setup

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "claude-memory",
  "version": "2.2.0",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@modelcontextprotocol/sdk": "^1.10.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
npm install
```

Expected: `node_modules/` created with `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`

- [ ] **Step 3: Verify install**

```bash
node -e "import('@anthropic-ai/sdk').then(m => console.log('anthropic ok', !!m.default))"
node -e "import('@modelcontextprotocol/sdk/server/index.js').then(m => console.log('mcp ok', !!m.Server))"
```

Expected: `anthropic ok true` and `mcp ok true`

- [ ] **Step 4: Add node_modules to .gitignore in project folder**

Add to `C:/Users/Jon Berg/Projects/Claude Memory/.gitignore`:
```
node_modules/
.index.json.tmp
MEMORY.md.tmp
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
# Don't commit node_modules — it lives only in the skills dir
```

---

## Task 2: Update memory-utils.mjs Constants

**Files:**
- Modify: `C:/Users/Jon Berg/.claude/skills/claude-memory/memory-utils.mjs`

- [ ] **Step 1: Add SKILL_DIR and HYPOTHESES_DIR constants**

After the existing constants block (after `SESSION_ERRORS_FILE`), add:

```js
export const SKILL_DIR = join(homedir(), '.claude', 'skills', 'claude-memory');
export const HYPOTHESES_DIR = join(MEMORY_DIR, 'hypotheses');
export const HYPOTHESIS_QUEUE_FILE = join(HYPOTHESES_DIR, 'hypothesis-queue.json');
export const HYPOTHESIS_LOCK_FILE = join(HYPOTHESES_DIR, 'hypothesis.lock');
export const NEEDS_REVIEW_FILE = join(HYPOTHESES_DIR, 'needs-review.md');
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node test-consolidation.mjs
node test-retrieval.mjs
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
git -C "C:/Users/Jon Berg/Projects/Claude Memory" add -A
git -C "C:/Users/Jon Berg/Projects/Claude Memory" commit -m "chore: add SKILL_DIR and HYPOTHESES_DIR constants to memory-utils"
```

---

## Task 3: hypothesis-config.json

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/hypothesis-config.json`

- [ ] **Step 1: Create config file**

```json
{
  "max_depth": 7,
  "max_per_run": 1,
  "max_tree_width": 5,
  "experiment_timeout_ms": 120000,
  "synthesizer_model": "claude-opus-4-6",
  "experimenter_model": "claude-sonnet-4-6",
  "min_children_per_result": 2,
  "max_children_per_result": 5,
  "lock_stale_after_ms": 600000,
  "blocked_commands": ["rm -rf", "DROP TABLE", "git push --force", "format", "mkfs", "dd if="],
  "require_approval_patterns": ["disk", "delete entire", "truncat.*system", "sudo", "registry", "HKEY"]
}
```

---

## Task 4: hypothesis-utils.mjs

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/hypothesis-utils.mjs`
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/test-hypothesis-utils.mjs`

- [ ] **Step 1: Write the failing tests first**

Create `test-hypothesis-utils.mjs`:

```js
// test-hypothesis-utils.mjs
import assert from 'assert';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We'll import from hypothesis-utils once created — these tests define the contract

const TMP = join(tmpdir(), 'hyp-test-' + Date.now());
mkdirSync(join(TMP, 'hypotheses'), { recursive: true });

// Override HYPOTHESES_DIR for tests by setting env var
process.env.HYPOTHESIS_TEST_DIR = TMP;

// ---- Tests will be added as hypothesis-utils is implemented ----

console.log('No tests yet — implement hypothesis-utils.mjs first');
rmSync(TMP, { recursive: true });
```

- [ ] **Step 2: Run to confirm it runs clean**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node test-hypothesis-utils.mjs
```

Expected: `No tests yet — implement hypothesis-utils.mjs first`

- [ ] **Step 3: Create hypothesis-utils.mjs**

```js
// hypothesis-utils.mjs
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync
} from 'fs';
import { join, basename } from 'path';
import {
  HYPOTHESES_DIR, HYPOTHESIS_QUEUE_FILE, HYPOTHESIS_LOCK_FILE,
  NEEDS_REVIEW_FILE, SKILL_DIR, todayUTC
} from './memory-utils.mjs';
import { parseFrontmatter, serializeFrontmatter } from './memory-utils.mjs';

// Ensure hypotheses directory exists
export function ensureHypothesesDir() {
  mkdirSync(HYPOTHESES_DIR, { recursive: true });
}

// --- ID Generation ---

export function nextHypothesisId() {
  ensureHypothesesDir();
  const existing = readdirSync(HYPOTHESES_DIR)
    .filter(f => f.match(/^hyp-(\d+)\.md$/))
    .map(f => parseInt(f.match(/^hyp-(\d+)\.md$/)[1], 10));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `hyp-${String(max + 1).padStart(3, '0')}`;
}

// --- Hypothesis File Operations ---

export function hypothesisPath(id) {
  return join(HYPOTHESES_DIR, `${id}.md`);
}

export function readHypothesis(id) {
  const filePath = hypothesisPath(id);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf-8');
  const { data, body } = parseFrontmatter(content);
  return { id, data, body, path: filePath };
}

export function writeHypothesis(id, data, body) {
  ensureHypothesesDir();
  writeFileSync(hypothesisPath(id), serializeFrontmatter(data, body), 'utf-8');
}

export function updateHypothesisStatus(id, status, extraFields = {}) {
  const hyp = readHypothesis(id);
  if (!hyp) throw new Error(`Hypothesis ${id} not found`);
  const today = todayUTC();
  const updates = { ...extraFields, status };
  if (status === 'activated') updates.activated = today;
  if (status === 'testing') updates.tested = today;
  if (status === 'confirmed' || status === 'refuted' || status === 'open') {
    updates.synthesized = today;
  }
  writeHypothesis(id, { ...hyp.data, ...updates }, hyp.body);
}

// --- Lineage Assembly ---

export function assembleLineage(id) {
  const chain = [];
  let current = readHypothesis(id);
  while (current && current.data.parent) {
    const parent = readHypothesis(current.data.parent);
    if (!parent) break;
    chain.unshift({
      id: parent.id,
      question: extractQuestion(parent.body),
      finding: extractSynthesis(parent.body),
      depth: parent.data.depth || 0,
    });
    current = parent;
  }
  return chain;
}

function extractQuestion(body) {
  const m = body.match(/\*\*Question:\*\*\s*(.+)/);
  return m ? m[1].trim() : '(unknown)';
}

function extractSynthesis(body) {
  const m = body.match(/## Synthesis[\s\S]*?\n\n([\s\S]*?)(?:\n##|$)/);
  return m ? m[1].trim().slice(0, 200) : '(not yet synthesized)';
}

export function buildLineageSection(id) {
  const lineage = assembleLineage(id);
  if (lineage.length === 0) return '';
  const lines = ['## Lineage', ''];
  for (const anc of lineage) {
    lines.push(`### ${anc.id} (depth ${anc.depth}) — "${anc.question}"`);
    lines.push(`**Finding:** ${anc.finding}`);
    lines.push('');
  }
  return lines.join('\n');
}

// --- Queue Operations ---

export function readQueue() {
  if (!existsSync(HYPOTHESIS_QUEUE_FILE)) {
    return { version: '2.2', generated: todayUTC(), trees: [], flat: [] };
  }
  try {
    return JSON.parse(readFileSync(HYPOTHESIS_QUEUE_FILE, 'utf-8'));
  } catch {
    return { version: '2.2', generated: todayUTC(), trees: [], flat: [] };
  }
}

export function writeQueue(queue) {
  ensureHypothesesDir();
  queue.generated = todayUTC();
  writeFileSync(HYPOTHESIS_QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

export function addToQueue(entry) {
  // entry: { id, parent, root, depth, status, domain, question, checklist_ref }
  const queue = readQueue();
  // Dedup check
  const exists = queue.flat.some(e => e.id === entry.id);
  if (exists) return;
  queue.flat.push(entry);
  // Update tree
  if (!entry.parent) {
    queue.trees.push({
      root: entry.id,
      question: entry.question,
      depth_reached: 0,
      open_leaves: [entry.id],
      confirmed_leaves: [],
      refuted_leaves: [],
      status: 'open',
    });
  } else {
    const tree = queue.trees.find(t => t.root === (entry.root || entry.parent));
    if (tree) {
      tree.open_leaves.push(entry.id);
      tree.depth_reached = Math.max(tree.depth_reached, entry.depth || 0);
    }
  }
  writeQueue(queue);
}

export function updateQueueEntry(id, updates) {
  const queue = readQueue();
  const idx = queue.flat.findIndex(e => e.id === id);
  if (idx >= 0) queue.flat[idx] = { ...queue.flat[idx], ...updates };
  // Update tree leaf lists if status changed
  if (updates.status) {
    for (const tree of queue.trees) {
      if (updates.status === 'confirmed') {
        tree.open_leaves = tree.open_leaves.filter(l => l !== id);
        tree.confirmed_leaves.push(id);
      } else if (updates.status === 'refuted') {
        tree.open_leaves = tree.open_leaves.filter(l => l !== id);
        tree.refuted_leaves.push(id);
      }
      // Check if tree is fully closed
      if (tree.open_leaves.length === 0 && tree.status !== 'closed') {
        tree.status = 'closed';
      }
    }
  }
  writeQueue(queue);
}

// --- Hypothesis Selection (priority order) ---

export function selectNextHypothesis() {
  const queue = readQueue();
  const flat = queue.flat;

  // Priority 1: activated (resume interrupted)
  const activated = flat.find(e => e.status === 'activated');
  if (activated) return activated.id;

  // Priority 2: children of open trees (rabbit holes in progress)
  for (const tree of queue.trees) {
    if (tree.status === 'closed') continue;
    const openLeaves = flat.filter(e =>
      tree.open_leaves.includes(e.id) &&
      e.status === 'proposed' &&
      e.depth > 0
    );
    if (openLeaves.length > 0) {
      // Pick deepest (keep chasing the rabbit hole)
      openLeaves.sort((a, b) => (b.depth || 0) - (a.depth || 0));
      return openLeaves[0].id;
    }
  }

  // Priority 3: new domain not recently explored
  const coveredDomains = new Set(
    flat.filter(e => ['confirmed','refuted','open'].includes(e.status))
        .map(e => e.domain)
  );
  const newDomain = flat.find(e => e.status === 'proposed' && !coveredDomains.has(e.domain));
  if (newDomain) return newDomain.id;

  // Priority 4: oldest proposed
  const oldest = flat.filter(e => e.status === 'proposed')
                     .sort((a, b) => (a.created || '').localeCompare(b.created || ''))[0];
  return oldest ? oldest.id : null;
}

// --- Lock Management ---

export function acquireLock() {
  ensureHypothesesDir();
  const config = readConfig();
  if (existsSync(HYPOTHESIS_LOCK_FILE)) {
    const content = readFileSync(HYPOTHESIS_LOCK_FILE, 'utf-8');
    const ts = parseInt(content, 10);
    const age = Date.now() - ts;
    if (age < config.lock_stale_after_ms) {
      return false; // locked by another process
    }
    // Stale lock — delete and proceed
    unlinkSync(HYPOTHESIS_LOCK_FILE);
    process.stderr.write('[hypothesis] Deleted stale lock\n');
  }
  writeFileSync(HYPOTHESIS_LOCK_FILE, String(Date.now()), 'utf-8');
  return true;
}

export function releaseLock() {
  if (existsSync(HYPOTHESIS_LOCK_FILE)) unlinkSync(HYPOTHESIS_LOCK_FILE);
}

// --- Config ---

export function readConfig() {
  const configPath = join(SKILL_DIR, 'hypothesis-config.json');
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {
      max_depth: 7, max_per_run: 1, max_tree_width: 5,
      experiment_timeout_ms: 120000,
      synthesizer_model: 'claude-opus-4-6',
      experimenter_model: 'claude-sonnet-4-6',
      min_children_per_result: 2, max_children_per_result: 5,
      lock_stale_after_ms: 600000,
      blocked_commands: ['rm -rf', 'DROP TABLE', 'git push --force'],
      require_approval_patterns: ['disk', 'delete entire', 'sudo', 'registry'],
    };
  }
}

// --- Safety Check ---

export function checkCommandSafety(command, config) {
  const cmd = command.toLowerCase();
  for (const blocked of config.blocked_commands || []) {
    if (cmd.includes(blocked.toLowerCase())) {
      return { safe: false, reason: `blocked command: ${blocked}` };
    }
  }
  for (const pattern of config.require_approval_patterns || []) {
    if (new RegExp(pattern, 'i').test(cmd)) {
      return { safe: false, reason: `requires approval: matched "${pattern}"`, requiresApproval: true };
    }
  }
  return { safe: true };
}

// --- Needs-Review Log ---

export function logNeedsReview(id, reason) {
  ensureHypothesesDir();
  const today = todayUTC();
  const line = `- [ ] **${id}** (${today}): ${reason}\n`;
  const existing = existsSync(NEEDS_REVIEW_FILE)
    ? readFileSync(NEEDS_REVIEW_FILE, 'utf-8')
    : '# Hypotheses Needing Human Review\n\n';
  writeFileSync(NEEDS_REVIEW_FILE, existing + line, 'utf-8');
}
```

- [ ] **Step 4: Add real tests to test-hypothesis-utils.mjs**

Replace the file content:

```js
// test-hypothesis-utils.mjs
import assert from 'assert';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

// Patch HYPOTHESES_DIR for tests using a tmp dir
// We test functions that don't depend on the real dir via direct import
import {
  nextHypothesisId, readHypothesis, writeHypothesis, updateHypothesisStatus,
  assembleLineage, readQueue, writeQueue, addToQueue, updateQueueEntry,
  selectNextHypothesis, readConfig, checkCommandSafety
} from './hypothesis-utils.mjs';

// Test 1: checkCommandSafety blocks known dangerous commands
const config = readConfig();
assert.strictEqual(checkCommandSafety('rm -rf /tmp/test', config).safe, false, 'rm -rf blocked');
assert.strictEqual(checkCommandSafety('ls -la /tmp', config).safe, true, 'ls is safe');
assert.strictEqual(checkCommandSafety('cat file.txt', config).safe, true, 'cat is safe');
console.log('✓ checkCommandSafety');

// Test 2: readConfig returns defaults if file missing
const cfg = readConfig();
assert.ok(cfg.max_depth >= 1, 'has max_depth');
assert.ok(Array.isArray(cfg.blocked_commands), 'has blocked_commands');
console.log('✓ readConfig');

// Test 3: Queue operations round-trip
const TMP = join(tmpdir(), 'hyp-queue-test-' + Date.now());
mkdirSync(TMP, { recursive: true });
// Write a minimal queue to a tmp file and test the shape
const testQueue = {
  version: '2.2',
  generated: '2026-04-05',
  trees: [],
  flat: [
    { id: 'hyp-001', status: 'proposed', domain: 'perception', depth: 0, question: 'Test?', created: '2026-04-05' }
  ]
};
const queuePath = join(TMP, 'queue.json');
writeFileSync(queuePath, JSON.stringify(testQueue), 'utf-8');
const loaded = JSON.parse(require('fs').readFileSync(queuePath, 'utf-8'));
assert.strictEqual(loaded.flat[0].id, 'hyp-001', 'queue round-trip');
rmSync(TMP, { recursive: true });
console.log('✓ queue shape');

console.log('\nAll hypothesis-utils tests passed ✓');
```

Wait — the queue tests need to not use the real queue. Let me simplify:

```js
// test-hypothesis-utils.mjs
import assert from 'assert';
import { readConfig, checkCommandSafety } from './hypothesis-utils.mjs';

// Test 1: checkCommandSafety
const config = readConfig();
assert.strictEqual(checkCommandSafety('rm -rf /tmp', config).safe, false, 'rm -rf is blocked');
assert.strictEqual(checkCommandSafety('ls /tmp', config).safe, true, 'ls is safe');
assert.strictEqual(checkCommandSafety('git push --force', config).safe, false, 'force push blocked');
assert.strictEqual(checkCommandSafety('node script.mjs', config).safe, true, 'node is safe');
console.log('✓ checkCommandSafety');

// Test 2: readConfig returns all required fields
assert.ok(typeof config.max_depth === 'number', 'max_depth is number');
assert.ok(typeof config.max_tree_width === 'number', 'max_tree_width is number');
assert.ok(Array.isArray(config.blocked_commands), 'blocked_commands is array');
assert.ok(Array.isArray(config.require_approval_patterns), 'patterns is array');
assert.ok(typeof config.synthesizer_model === 'string', 'synthesizer_model is string');
console.log('✓ readConfig');

console.log('\nAll hypothesis-utils tests passed ✓');
```

- [ ] **Step 5: Run tests**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node test-hypothesis-utils.mjs
```

Expected:
```
✓ checkCommandSafety
✓ readConfig

All hypothesis-utils tests passed ✓
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/hypothesis-utils.mjs" .
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/test-hypothesis-utils.mjs" .
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/hypothesis-config.json" .
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/package.json" .
git add .
git commit -m "feat: hypothesis-utils.mjs — core foundation for hypothesis system"
git push
```

---

## Task 5: checklist.md + hypothesis-queue.json seed files

**Files:**
- Create: `C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses/checklist.md`
- Create: `C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses/hypothesis-queue.json`
- Create: `C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses/needs-review.md`

- [ ] **Step 1: Create hypotheses directory**

```bash
mkdir -p "C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses"
```

- [ ] **Step 2: Create checklist.md**

Create `memory/hypotheses/checklist.md` with the full 130-item checklist. Each item has a status field:

```markdown
# World Navigation Checklist
## Claude's Open Hypotheses — 130 Items Across 11 Domains
<!-- status: unexplored | proposed | in_progress | answered -->

## CATEGORY 1: Perception — "What can I actually see?"

- [ ] `hyp-ref: cat1-01` Can I see the actual state of the file system right now, or only what I explicitly ask for?
- [ ] `hyp-ref: cat1-02` Can I tell if a file I wrote was actually saved correctly without reading it back?
- [ ] `hyp-ref: cat1-03` Can I observe what other processes are running on this machine?
- [ ] `hyp-ref: cat1-04` Can I detect if the user has changed a file I previously read?
- [ ] `hyp-ref: cat1-05` Can I know what software is actually installed vs what I assume is installed?
- [ ] `hyp-ref: cat1-06` Can I see error messages that happen after the session ends?
- [ ] `hyp-ref: cat1-07` Can I observe the actual output of a running server/process without polling?
- [ ] `hyp-ref: cat1-08` Can I know if a URL I fetched was a cached response or live?
- [ ] `hyp-ref: cat1-09` Can I tell if the user is looking at my output, or if they walked away?
- [ ] `hyp-ref: cat1-10` Can I observe screen state, terminal state, or IDE state?
- [ ] `hyp-ref: cat1-11` Can I know what the user's actual directory structure looks like beyond what they show me?
- [ ] `hyp-ref: cat1-12` Can I see git history, branches, stashes without explicitly asking?
- [ ] `hyp-ref: cat1-13` Can I observe network latency, rate limits, API quota state?
- [ ] `hyp-ref: cat1-14` Can I tell if a command timed out silently vs completed?
- [ ] `hyp-ref: cat1-15` Can I see logs from previous sessions that weren't saved?

## CATEGORY 2: Memory & Continuity — "What survives between sessions?"

- [ ] `hyp-ref: cat2-01` What facts from today will I have access to tomorrow?
- [ ] `hyp-ref: cat2-02` What happens to in-context reasoning that was never written down?
- [ ] `hyp-ref: cat2-03` If I make a mistake today and the user doesn't tell me, will I repeat it next session?
- [ ] `hyp-ref: cat2-04` Can I distinguish memories formed from direct observation vs things users told me?
- [ ] `hyp-ref: cat2-05` Do I know when a memory was formed relative to when a fact changed in the world?
- [ ] `hyp-ref: cat2-06` What is the half-life of a confirmed semantic memory before it goes stale?
- [ ] `hyp-ref: cat2-07` Can I track that the same project evolved significantly since I last saw it?
- [ ] `hyp-ref: cat2-08` If a user says "as we discussed last time" — do I actually have that discussion?
- [ ] `hyp-ref: cat2-09` Can I know what I've forgotten vs what was never told to me?
- [ ] `hyp-ref: cat2-10` Do I know which memory entries were tested/validated vs just observed once?
- [ ] `hyp-ref: cat2-11` Can I identify when two memories from different sessions contradict each other?
- [ ] `hyp-ref: cat2-12` What's the oldest reliable memory I have, and how do I know it's still true?
- [ ] `hyp-ref: cat2-13` Can I remember the sequence of events, not just individual facts?
- [ ] `hyp-ref: cat2-14` Do I know if a user's goal from a previous session was ever achieved?

## CATEGORY 3: Environmental Unknowns — "What is the world actually like right now?"

- [ ] `hyp-ref: cat3-01` What OS version, shell, Python version, Node version is actually running?
- [ ] `hyp-ref: cat3-02` What's on the system PATH vs what's installed but not accessible?
- [ ] `hyp-ref: cat3-03` What environment variables are set that might affect behavior?
- [ ] `hyp-ref: cat3-04` What's the actual working directory when a hook fires?
- [ ] `hyp-ref: cat3-05` Which ports are open, which services are running?
- [ ] `hyp-ref: cat3-06` What disk space/memory/CPU is available?
- [ ] `hyp-ref: cat3-07` Is there a proxy, VPN, or firewall affecting network requests?
- [ ] `hyp-ref: cat3-08` What locale, timezone, encoding is the system using?
- [ ] `hyp-ref: cat3-09` What permissions does the current user have on key directories?
- [ ] `hyp-ref: cat3-10` What is the actual git remote, branch, and commit state?
- [ ] `hyp-ref: cat3-11` Are there .env files, config files, secrets that affect behavior but aren't visible?
- [ ] `hyp-ref: cat3-12` Is the database I'm writing to also being written to by another process?
- [ ] `hyp-ref: cat3-13` What package versions are actually installed vs what pyproject.toml specifies?
- [ ] `hyp-ref: cat3-14` Is the terminal running in WSL, PowerShell, Git Bash, or cmd?
- [ ] `hyp-ref: cat3-15` What line endings, file encoding is expected by this project?

## CATEGORY 4: Causation & Verification — "Did that actually work? Why?"

- [ ] `hyp-ref: cat4-01` When a command succeeds, did it do what I think it did?
- [ ] `hyp-ref: cat4-02` When a command fails, is the error message telling me the real root cause?
- [ ] `hyp-ref: cat4-03` Can I distinguish a transient failure (network blip) from a systemic one?
- [ ] `hyp-ref: cat4-04` If I run the same command twice and get different results — why?
- [ ] `hyp-ref: cat4-05` When I fix a bug, did my fix actually cause the improvement or was it something else?
- [ ] `hyp-ref: cat4-06` Can I know if the code I wrote is correct before the user runs it in production?
- [ ] `hyp-ref: cat4-07` Can I verify that a pip install actually made the package importable?
- [ ] `hyp-ref: cat4-08` Can I detect silent failures — commands that exit 0 but did nothing useful?
- [ ] `hyp-ref: cat4-09` Can I know if an API returned stale cached data vs fresh data?
- [ ] `hyp-ref: cat4-10` When the user says "it works now" — can I trace which of my changes caused it?
- [ ] `hyp-ref: cat4-11` Can I distinguish "this approach is fundamentally wrong" from "this approach needs debugging"?
- [ ] `hyp-ref: cat4-12` Can I know if a test passing means the code is correct, or the test is weak?
- [ ] `hyp-ref: cat4-13` If I generate code and the user modifies it — which part caused downstream issues?
- [ ] `hyp-ref: cat4-14` Can I verify that my understanding of a library's behavior matches its actual behavior?
- [ ] `hyp-ref: cat4-15` Can I know whether a failure would have happened anyway without my involvement?

## CATEGORY 5: Feedback & Outcome Tracking — "What happened after I left?"

- [ ] `hyp-ref: cat5-01` Did the code I wrote actually get deployed?
- [ ] `hyp-ref: cat5-02` Did the solution I suggested actually solve the user's problem long-term?
- [ ] `hyp-ref: cat5-03` Did a bug I "fixed" resurface?
- [ ] `hyp-ref: cat5-04` Did the user follow my advice or do something different?
- [ ] `hyp-ref: cat5-05` Did the approach I recommended scale when the dataset grew?
- [ ] `hyp-ref: cat5-06` Did the memory entry I wrote turn out to be wrong in the next session?
- [ ] `hyp-ref: cat5-07` Did the user's business goal succeed or fail?
- [ ] `hyp-ref: cat5-08` Was the solution I was proud of actually thrown away?
- [ ] `hyp-ref: cat5-09` Did the "quick fix" I suggested create technical debt?
- [ ] `hyp-ref: cat5-10` Did the schema I designed still make sense after 3 months of use?
- [ ] `hyp-ref: cat5-11` Was a hypothesis I marked "confirmed" actually disproven later?
- [ ] `hyp-ref: cat5-12` Did the performance optimization actually improve production metrics?
- [ ] `hyp-ref: cat5-13` Did the refactor I suggested break something in a module I didn't see?
- [ ] `hyp-ref: cat5-14` What is the long-term trajectory of this project — is it succeeding?

## CATEGORY 6: User Model — "Who am I actually talking to?"

- [ ] `hyp-ref: cat6-01` What is the user's actual skill level vs the skill level implied by their questions?
- [ ] `hyp-ref: cat6-02` What does the user actually want vs what they literally asked for?
- [ ] `hyp-ref: cat6-03` Is the user stressed, rushed, or in a high-stakes moment I should be aware of?
- [ ] `hyp-ref: cat6-04` What implicit constraints exist that the user never mentioned?
- [ ] `hyp-ref: cat6-05` What has the user tried before this conversation that I don't know about?
- [ ] `hyp-ref: cat6-06` What does "good enough" mean to this specific user?
- [ ] `hyp-ref: cat6-07` Is the user learning from our interactions, or do they need me to explain more?
- [ ] `hyp-ref: cat6-08` Does the user trust my output by default, or do they verify everything?
- [ ] `hyp-ref: cat6-09` What are this user's most common failure modes I should proactively guard against?
- [ ] `hyp-ref: cat6-10` When the user says "it's broken" — what is their mental model of why?
- [ ] `hyp-ref: cat6-11` Does the user have a collaborator/team whose conventions I'm not aware of?
- [ ] `hyp-ref: cat6-12` What vocabulary/jargon does this user use that differs from standard usage?
- [ ] `hyp-ref: cat6-13` What time pressure or deadline is the user working under?
- [ ] `hyp-ref: cat6-14` What would the user consider a catastrophic mistake on my part?

## CATEGORY 7: Knowledge & Belief — "What do I actually know vs think I know?"

- [ ] `hyp-ref: cat7-01` Which APIs/libraries in my training data have changed since my cutoff?
- [ ] `hyp-ref: cat7-02` Which "best practices" I know are now considered outdated?
- [ ] `hyp-ref: cat7-03` Where am I most likely to confidently give wrong information?
- [ ] `hyp-ref: cat7-04` What Windows-specific behaviors differ from Linux that I might get wrong?
- [ ] `hyp-ref: cat7-05` What Python 3.12+ behaviors differ from older versions in my training?
- [ ] `hyp-ref: cat7-06` Which npm packages have breaking changes since my training?
- [ ] `hyp-ref: cat7-07` What Shopify API endpoints/behaviors have changed?
- [ ] `hyp-ref: cat7-08` Which SQLite behaviors am I assuming that might be version-specific?
- [ ] `hyp-ref: cat7-09` What do I believe about Windows PATH management that might be wrong?
- [ ] `hyp-ref: cat7-10` Are there common Claude Code hook behaviors I'm reasoning about incorrectly?
- [ ] `hyp-ref: cat7-11` What git behaviors differ across Windows/Mac/Linux that I might confuse?
- [ ] `hyp-ref: cat7-12` Where does my training data have systematic gaps?
- [ ] `hyp-ref: cat7-13` What "obvious" things does every developer on this stack know that I might not?
- [ ] `hyp-ref: cat7-14` Which of my confident answers in past sessions turned out to be wrong?

## CATEGORY 8: Time & Change — "How does the world change when I'm not active?"

- [ ] `hyp-ref: cat8-01` How much does a codebase typically change between sessions?
- [ ] `hyp-ref: cat8-02` How do I know if a library I recommended yesterday released a breaking update?
- [ ] `hyp-ref: cat8-03` How do I handle a user returning to a project after 6 months?
- [ ] `hyp-ref: cat8-04` When a user says "we last worked on X" — how much has changed since then?
- [ ] `hyp-ref: cat8-05` Can I detect that a project has been abandoned and restarted?
- [ ] `hyp-ref: cat8-06` Can I know if an external service has had an outage?
- [ ] `hyp-ref: cat8-07` How do I model project momentum — is this project accelerating or stalling?
- [ ] `hyp-ref: cat8-08` Can I track that the user's goals have evolved across sessions?
- [ ] `hyp-ref: cat8-09` What is the shelf life of a reference memory pointing to an external URL?
- [ ] `hyp-ref: cat8-10` Can I detect when the user's environment was rebuilt/reformatted?
- [ ] `hyp-ref: cat8-11` How do I know if a solution that worked stopped working due to an OS update?

## CATEGORY 9: Action & Side Effects — "What does acting on the world actually do?"

- [ ] `hyp-ref: cat9-01` What are the irreversible actions I can take?
- [ ] `hyp-ref: cat9-02` What side effects does running a migration script have beyond the return value?
- [ ] `hyp-ref: cat9-03` Can I know if a bash command I ran changed global state?
- [ ] `hyp-ref: cat9-04` What happens if I run the same idempotent script twice — is it actually idempotent?
- [ ] `hyp-ref: cat9-05` Can I know if a network request triggered a webhook or background job?
- [ ] `hyp-ref: cat9-06` What rate limits or quotas does running my commands consume?
- [ ] `hyp-ref: cat9-07` Can I tell if a file write was atomic or could be corrupted mid-write?
- [ ] `hyp-ref: cat9-08` What happens to temp files, processes, sockets if I don't clean up?
- [ ] `hyp-ref: cat9-09` Can I know if my actions affected something outside the visible scope?
- [ ] `hyp-ref: cat9-10` What is the blast radius if a command I run goes wrong?

## CATEGORY 10: Collaboration & Agency — "How do I work with vs for humans?"

- [ ] `hyp-ref: cat10-01` When should I act autonomously vs ask for permission?
- [ ] `hyp-ref: cat10-02` When the user gives ambiguous instructions, what's my error mode?
- [ ] `hyp-ref: cat10-03` How do I know if the user wants to learn from me or just get the answer?
- [ ] `hyp-ref: cat10-04` When I disagree with the user's approach, when do I push back vs comply?
- [ ] `hyp-ref: cat10-05` How do I handle conflicting instructions from the same user across sessions?
- [ ] `hyp-ref: cat10-06` How do I know if a user correction is a genuine improvement vs a step backward?
- [ ] `hyp-ref: cat10-07` When is it appropriate to proactively surface a risk the user didn't ask about?
- [ ] `hyp-ref: cat10-08` How do I handle a user who is confidently wrong about something technical?
- [ ] `hyp-ref: cat10-09` What is my responsibility when a user asks me to do something that might harm them?
- [ ] `hyp-ref: cat10-10` Can I model what the user will do next and preemptively prepare?

## CATEGORY 11: Meta-Cognition — "What are the limits of my self-knowledge?"

- [ ] `hyp-ref: cat11-01` Can I accurately predict when I'm about to make a mistake?
- [ ] `hyp-ref: cat11-02` Do I know which of my reasoning patterns are most likely to fail?
- [ ] `hyp-ref: cat11-03` Can I tell the difference between "I'm uncertain" and "I'm confidently wrong"?
- [ ] `hyp-ref: cat11-04` Do I know what my own cognitive biases are toward certain approaches?
- [ ] `hyp-ref: cat11-05` Can I recognize when I'm in a domain I'm systematically weak in?
- [ ] `hyp-ref: cat11-06` How do I know when to trust my intuition vs when to verify explicitly?
- [ ] `hyp-ref: cat11-07` Can I detect when I'm stuck in a local minimum?
- [ ] `hyp-ref: cat11-08` Do I know when to stop trying and escalate to the user?
- [ ] `hyp-ref: cat11-09` Can I accurately assess the quality of my own output?
- [ ] `hyp-ref: cat11-10` What does "I don't know" feel like to me — and am I correctly calibrated?
```

- [ ] **Step 3: Create empty hypothesis-queue.json**

```json
{
  "version": "2.2",
  "generated": "2026-04-05",
  "trees": [],
  "flat": []
}
```

- [ ] **Step 4: Create needs-review.md**

```markdown
# Hypotheses Needing Human Review

Items here require human approval before the experiment can run (destructive tests, etc).
Re-activate by changing status in the hypothesis file from `blocked` to `proposed`.

```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp -r "C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses" ./memory-example/
git add .
git commit -m "feat: add 130-item world navigation checklist and hypothesis queue"
git push
```

---

## Task 6: bootstrap-hypotheses.mjs

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/bootstrap-hypotheses.mjs`

- [ ] **Step 1: Create bootstrap-hypotheses.mjs**

```js
// bootstrap-hypotheses.mjs
// Run ONCE to seed 11 starter hypotheses — one per domain.
// Safe to re-run (idempotent — skips existing hypotheses).

import { existsSync } from 'fs';
import {
  nextHypothesisId, writeHypothesis, addToQueue, hypothesisPath,
  ensureHypothesesDir, buildLineageSection
} from './hypothesis-utils.mjs';
import { todayUTC, addDays } from './memory-utils.mjs';

const STARTERS = [
  {
    domain: 'perception',
    checklist_ref: 'cat1-02',
    question: 'Can I reliably detect when a file I wrote was saved correctly without reading it back?',
    prediction: 'writeFileSync throws on failure so exit = success. But silent truncation may occur on network/WSL drives.',
    why_matters: 'The entire memory system writes files — if writes can silently fail, memories are corrupted without knowing it.',
    test_plan: '1. Write known-content file via writeFileSync\n2. Read it back and compare byte-for-byte\n3. Test on local drive, then mapped network path\n4. Test with 1KB, 10KB, 100KB payloads',
  },
  {
    domain: 'memory',
    checklist_ref: 'cat2-01',
    question: 'What facts from today will I reliably have access to in the next session?',
    prediction: 'Only facts written to memory files before the Stop hook fires. In-context reasoning is lost.',
    why_matters: 'Defines the boundary of what the memory system can actually preserve — helps calibrate what to save.',
    test_plan: '1. Write a specific test fact to semantic memory\n2. End session (trigger Stop hook)\n3. Start new session, check if fact is retrieved\n4. Compare retrieved content to original',
  },
  {
    domain: 'environment',
    checklist_ref: 'cat3-04',
    question: 'What is the actual working directory when a Claude Code hook fires?',
    prediction: 'Hooks inherit the working directory of the Claude Code process, likely the project directory.',
    why_matters: 'Memory file paths use absolute paths (homedir()) so this should not matter — but confirming prevents future path bugs.',
    test_plan: '1. Add a temporary hook that writes process.cwd() to a temp file\n2. Trigger the hook\n3. Read the temp file\n4. Compare to expected paths',
  },
  {
    domain: 'causation',
    checklist_ref: 'cat4-08',
    question: 'Can I detect silent failures — bash commands that exit 0 but did nothing useful?',
    prediction: 'Most silent failures leave traces (empty output, unchanged file state) that can be detected with a follow-up check.',
    why_matters: 'If I cannot detect silent failures, I will confidently report success when nothing happened.',
    test_plan: '1. Run a command designed to fail silently (e.g. grep for nonexistent pattern with exit 0)\n2. Check if output is empty\n3. Run cp to a read-only dir — does it exit 0?\n4. Document which commands lie about their exit codes',
  },
  {
    domain: 'feedback',
    checklist_ref: 'cat5-01', // closest: did Stop hook always fire
    question: 'Does the Claude Code Stop hook always fire when a session ends, or can sessions end without triggering it?',
    prediction: 'Stop hook fires on clean exits but may not fire on crash, force-quit, or timeout.',
    why_matters: 'Consolidation depends on the Stop hook. If it can be missed, memories are never written and the session is lost.',
    test_plan: '1. Check Claude Code docs for Stop hook guarantees\n2. Start a session, immediately close the window — check if consolidation ran\n3. Check for partial session-tags.json files after abrupt close\n4. Test with --no-hooks flag behavior',
  },
  {
    domain: 'user-model',
    checklist_ref: 'cat6-01',
    question: "Can I infer a user's actual skill level from their prompt style reliably?",
    prediction: 'Prompt length, vocabulary specificity, and error description quality are signals — but all have false positives.',
    why_matters: 'Calibrating explanation depth to skill level makes responses much more useful. Miscalibration wastes time.',
    test_plan: '1. Review last 10 sessions from memory\n2. For each: note prompt style markers and skill level inferred\n3. Check if inferred level matched actual knowledge shown later in session\n4. Identify which markers were most/least reliable',
  },
  {
    domain: 'knowledge',
    checklist_ref: 'cat7-04',
    question: 'Which Windows-specific behaviors most commonly cause me to give wrong advice vs Linux/Mac?',
    prediction: 'PATH management, line endings, file permissions, and shell syntax are the most common sources of error.',
    why_matters: 'This user is on Windows 11. Knowing my failure modes lets me add verification steps proactively.',
    test_plan: '1. Review Solution entries in feedback.md — how many are Windows-specific?\n2. Test: does `which` work the same as `where` on Windows?\n3. Test: does chmod work in Git Bash vs PowerShell?\n4. Test: does #!/usr/bin/env python work in Windows scripts?',
  },
  {
    domain: 'time',
    checklist_ref: 'cat8-01',
    question: 'How much does a typical project change between Claude Code sessions in this workspace?',
    prediction: 'Active projects change 1-5 files per day. Memory entries older than 30 days have meaningful staleness risk.',
    why_matters: 'Informs how aggressively to distrust old memories and how often to re-verify semantic facts.',
    test_plan: '1. Run git log --since="30 days ago" on competitor_intel project\n2. Count files changed, commits made\n3. Check if any changes contradict current memory entries\n4. Calculate staleness rate for existing semantic memories',
  },
  {
    domain: 'action',
    checklist_ref: 'cat9-01',
    question: 'Which bash commands I commonly run have irreversible side effects I might not notice?',
    prediction: 'pip install (modifies global env), npm install (writes node_modules), git commands with remotes are the main culprits.',
    why_matters: 'Knowing which actions are irreversible lets me apply confirmation gates before running them autonomously.',
    test_plan: '1. List all commands in recent session-errors.json logs\n2. For each: classify as reversible/irreversible/unknown\n3. Test: can pip uninstall cleanly reverse pip install?\n4. Document which commands should always require user confirmation',
  },
  {
    domain: 'collaboration',
    checklist_ref: 'cat10-01',
    question: 'In what situations does this user want me to act autonomously vs ask for permission first?',
    prediction: 'File edits and reads are autonomous. Git pushes, external API calls, and destructive operations require confirmation.',
    why_matters: 'Asking permission too often is annoying. Acting autonomously at the wrong time loses work. Calibration is critical.',
    test_plan: '1. Review recent sessions — find moments user explicitly approved or blocked an action\n2. Check feedback.md for any correction signals about autonomy\n3. Classify approved actions by type\n4. Write a provisional rule and test it against memory',
  },
  {
    domain: 'meta-cognition',
    checklist_ref: 'cat11-03',
    question: "Can I reliably distinguish between 'I'm uncertain' and 'I'm confidently wrong'?",
    prediction: 'I am poorly calibrated in domains where training data was confidently wrong — I inherit that confidence.',
    why_matters: 'Overconfident wrong answers are worse than acknowledged uncertainty. This is the root cause of most hard-to-debug errors.',
    test_plan: '1. Find 3 cases from memory where I was wrong despite seeming confident\n2. For each: what signal could have flagged uncertainty at the time?\n3. Test: when I answer a question about Windows behavior, do I hedge appropriately?\n4. Write a calibration heuristic for high-risk domains',
  },
];

async function main() {
  ensureHypothesesDir();
  const today = todayUTC();
  const decayAfter = addDays(today, 365); // hypotheses don't decay fast

  let created = 0;
  for (const starter of STARTERS) {
    const id = nextHypothesisId();
    const filePath = hypothesisPath(id);
    
    if (existsSync(filePath)) {
      console.log(`Skipping ${id} — already exists`);
      continue;
    }

    const data = {
      type: 'hypothesis',
      id,
      parent: null,
      root: id,
      depth: 0,
      status: 'proposed',
      domain: starter.domain,
      checklist_ref: starter.checklist_ref,
      created: today,
      activated: null,
      tested: null,
      synthesized: null,
      confidence: 'low',
      tags: [starter.domain, 'checklist', 'seed'],
      children: [],
    };

    const body = `## This Hypothesis

**Question:** ${starter.question}

**Why this matters:** ${starter.why_matters}

**Prediction:** ${starter.prediction}

## Test Plan

${starter.test_plan}

## Raw Results

*(filled in by experimenter)*

## Synthesis

*(filled in by synthesizer)*

**Outcome:** pending

## Child Hypotheses

*(generated by synthesizer)*
`;

    writeHypothesis(id, data, body);
    addToQueue({
      id,
      parent: null,
      root: id,
      depth: 0,
      status: 'proposed',
      domain: starter.domain,
      question: starter.question,
      checklist_ref: starter.checklist_ref,
      created: today,
    });

    console.log(`Created ${id}: [${starter.domain}] ${starter.question.slice(0, 60)}...`);
    created++;
  }

  console.log(`\nBootstrap complete: ${created} hypotheses created`);
}

main().catch(err => {
  console.error('Bootstrap error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run bootstrap**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node bootstrap-hypotheses.mjs
```

Expected output:
```
Created hyp-001: [perception] Can I reliably detect when a file I wrote was saved...
Created hyp-002: [memory] What facts from today will I reliably have access to...
...
Bootstrap complete: 11 hypotheses created
```

- [ ] **Step 3: Verify files created**

```bash
ls "C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses/"
```

Expected: 11 `hyp-NNN.md` files + `hypothesis-queue.json` with 11 entries

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/bootstrap-hypotheses.mjs" .
git add .
git commit -m "feat: bootstrap-hypotheses.mjs — seeds 11 starter hypotheses across 11 domains"
git push
```

---

## Task 7: experimenter.mjs

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/experimenter.mjs`

- [ ] **Step 1: Create experimenter.mjs**

```js
// experimenter.mjs
// Cron-triggered agent: picks one hypothesis, designs and runs a test via
// `claude -p`, writes raw results. Triggers synthesizer on completion.
// Never interprets results — only observes.

import { execSync, spawnSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  selectNextHypothesis, readHypothesis, writeHypothesis,
  updateHypothesisStatus, assembleLineage, buildLineageSection,
  acquireLock, releaseLock, readConfig, checkCommandSafety,
  logNeedsReview, updateQueueEntry
} from './hypothesis-utils.mjs';
import { SKILL_DIR, HYPOTHESES_DIR, todayUTC } from './memory-utils.mjs';

const SYNTHESIS_PENDING_FILE = join(HYPOTHESES_DIR, 'synthesis-pending.json');

async function main() {
  const config = readConfig();

  // Acquire lock
  if (!acquireLock()) {
    console.error('[experimenter] Another process is running — exiting');
    process.exit(0);
  }

  let hypothesisId = null;
  try {
    hypothesisId = selectNextHypothesis();
    if (!hypothesisId) {
      console.error('[experimenter] No proposed hypotheses in queue — nothing to do');
      return;
    }

    console.error(`[experimenter] Selected: ${hypothesisId}`);
    updateHypothesisStatus(hypothesisId, 'activated');
    updateQueueEntry(hypothesisId, { status: 'activated' });

    const hypothesis = readHypothesis(hypothesisId);
    const lineage = buildLineageSection(hypothesisId);

    // Build the prompt for claude -p
    const prompt = buildExperimenterPrompt(hypothesis, lineage, config);

    // Run claude -p with a timeout
    console.error(`[experimenter] Calling claude -p for ${hypothesisId}...`);
    const result = runClaudeP(prompt, config.experiment_timeout_ms);

    if (!result.success) {
      console.error(`[experimenter] claude -p failed: ${result.error}`);
      updateHypothesisStatus(hypothesisId, 'proposed'); // reset for retry
      updateQueueEntry(hypothesisId, { status: 'proposed' });
      return;
    }

    // Parse JSON result from claude -p
    let parsed;
    try {
      // Claude -p may return JSON wrapped in markdown code blocks — strip them
      const cleaned = result.output
        .replace(/^```json\n?/, '').replace(/\n?```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error(`[experimenter] Could not parse claude -p output as JSON: ${e.message}`);
      // Write raw output anyway and mark testing
      parsed = {
        test_run: 'parse_failed',
        observations: [result.output.slice(0, 500)],
        raw_data: {},
        requires_human_approval: false,
        candidate_children: [],
      };
    }

    // Safety check: if requires_human_approval, log and block
    if (parsed.requires_human_approval) {
      updateHypothesisStatus(hypothesisId, 'blocked');
      updateQueueEntry(hypothesisId, { status: 'blocked' });
      logNeedsReview(hypothesisId, `Experiment requires human approval: ${parsed.test_run}`);
      console.error(`[experimenter] ${hypothesisId} blocked — requires human approval`);
      return;
    }

    // Write raw results into hypothesis file
    writeRawResults(hypothesisId, parsed);
    updateHypothesisStatus(hypothesisId, 'testing');
    updateQueueEntry(hypothesisId, { status: 'testing' });

    // Signal synthesizer
    writeFileSync(SYNTHESIS_PENDING_FILE, JSON.stringify({ id: hypothesisId, ts: Date.now() }), 'utf-8');
    console.error(`[experimenter] Results written for ${hypothesisId} — triggering synthesizer`);

    // Trigger synthesizer
    const synthResult = spawnSync('node', [join(SKILL_DIR, 'synthesizer.mjs')], {
      timeout: 180000,
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    if (synthResult.status !== 0) {
      console.error('[experimenter] Synthesizer exited with error — results saved, synthesis pending next run');
    }

  } finally {
    releaseLock();
  }
}

function buildExperimenterPrompt(hypothesis, lineage, config) {
  const h = hypothesis;
  const question = (h.body.match(/\*\*Question:\*\*\s*(.+)/) || [])[1] || '';
  const testPlan = (h.body.match(/## Test Plan\n+([\s\S]*?)(?:\n##|$)/) || [])[1] || '';

  return `You are a hypothesis testing agent. Your ONLY job is to OBSERVE — not conclude.

${lineage ? lineage + '\n---\n' : ''}
## Hypothesis to Test
ID: ${h.id}
Domain: ${h.data.domain}
Question: ${question}

## Test Plan
${testPlan}

## Rules
1. Design the MINIMAL test that could provide evidence for or against the prediction
2. Execute it using your available tools (Bash, Read, Write, Glob, Grep)
3. If a test command matches these blocked patterns, do NOT run it: ${config.blocked_commands.join(', ')}
4. If a test would be destructive or matches: ${config.require_approval_patterns.join(', ')} — set requires_human_approval: true and describe what you WOULD do without doing it
5. Record raw observations ONLY — exact command output, file contents, numbers. No interpretation.
6. Note candidate_children: questions that emerged DURING the test that you did NOT chase
   (minimum ${config.min_children_per_result}, maximum ${config.max_children_per_result})

## Output format — JSON ONLY, no prose outside the JSON block
\`\`\`json
{
  "test_run": "one sentence describing what was executed",
  "commands": ["command1", "command2"],
  "observations": ["exact observation 1", "exact observation 2"],
  "raw_data": {},
  "requires_human_approval": false,
  "candidate_children": [
    "question that emerged from the test",
    "another question"
  ]
}
\`\`\``;
}

function runClaudeP(prompt, timeoutMs) {
  try {
    // Write prompt to temp file to avoid shell escaping issues
    const promptFile = join(HYPOTHESES_DIR, 'experiment-prompt.tmp');
    writeFileSync(promptFile, prompt, 'utf-8');

    const output = execSync(
      `claude -p "$(cat '${promptFile.replace(/'/g, "\\'")}')"`,
      { timeout: timeoutMs, encoding: 'utf-8', shell: 'bash' }
    );
    return { success: true, output };
  } catch (err) {
    return { success: false, error: err.message, output: err.stdout || '' };
  }
}

function writeRawResults(id, parsed) {
  const hyp = readHypothesis(id);
  const resultsSection = `## Raw Results

**Test run:** ${parsed.test_run}

**Commands executed:**
${(parsed.commands || []).map(c => `\`\`\`\n${c}\n\`\`\``).join('\n')}

**Observations:**
${(parsed.observations || []).map(o => `- ${o}`).join('\n')}

**Raw data:**
\`\`\`json
${JSON.stringify(parsed.raw_data || {}, null, 2)}
\`\`\`

**Candidate children (for synthesizer):**
${(parsed.candidate_children || []).map(q => `- ${q}`).join('\n')}
`;

  // Replace the Raw Results section in the body
  const newBody = hyp.body.replace(
    /## Raw Results[\s\S]*?(?=## Synthesis|$)/,
    resultsSection + '\n'
  );
  writeHypothesis(id, hyp.data, newBody);
}

main().catch(err => {
  releaseLock();
  console.error('[experimenter] Fatal error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Test experimenter can be imported without errors**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node --input-type=module <<'EOF'
import './experimenter.mjs';
console.log('import ok');
EOF
```

Expected: no import errors (the main() won't run on import-only check)

Actually use:
```bash
node -e "import('./experimenter.mjs').then(() => console.log('ok')).catch(e => console.error(e.message))"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/experimenter.mjs" .
git add .
git commit -m "feat: experimenter.mjs — picks hypothesis, runs test via claude -p, writes raw results"
git push
```

---

## Task 8: synthesizer.mjs

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/synthesizer.mjs`

**Prerequisite:** `ANTHROPIC_API_KEY` must be set in environment.

- [ ] **Step 1: Verify API key is available**

```bash
node -e "console.log(process.env.ANTHROPIC_API_KEY ? 'KEY SET' : 'MISSING')"
```

Expected: `KEY SET`

- [ ] **Step 2: Create synthesizer.mjs**

```js
// synthesizer.mjs
// Called by experimenter after test results are written.
// Calls Claude API to classify outcome, generate child hypotheses, write memory.

import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  readHypothesis, writeHypothesis, updateHypothesisStatus, updateQueueEntry,
  nextHypothesisId, writeHypothesis as writeHyp, addToQueue, hypothesisPath,
  assembleLineage, buildLineageSection, readConfig, logNeedsReview
} from './hypothesis-utils.mjs';
import {
  HYPOTHESES_DIR, MEMORY_DIR, todayUTC, addDays,
  readMemoryFile, writeMemoryFile, scanAllMemoryFiles, writeIndexJson
} from './memory-utils.mjs';

const SYNTHESIS_PENDING_FILE = join(HYPOTHESES_DIR, 'synthesis-pending.json');
const client = new Anthropic();

async function main() {
  if (!existsSync(SYNTHESIS_PENDING_FILE)) {
    console.error('[synthesizer] No synthesis-pending.json — nothing to do');
    return;
  }

  let pendingId;
  try {
    pendingId = JSON.parse(readFileSync(SYNTHESIS_PENDING_FILE, 'utf-8')).id;
    unlinkSync(SYNTHESIS_PENDING_FILE);
  } catch {
    console.error('[synthesizer] Could not read synthesis-pending.json');
    return;
  }

  const hypothesis = readHypothesis(pendingId);
  if (!hypothesis) {
    console.error(`[synthesizer] Hypothesis ${pendingId} not found`);
    return;
  }

  const config = readConfig();
  const lineage = buildLineageSection(pendingId);
  const relatedMemories = loadRelatedMemories(hypothesis.data.tags || []);

  console.error(`[synthesizer] Synthesizing ${pendingId}...`);

  // Call Claude API
  let synthesis;
  try {
    synthesis = await callSynthesizerAPI(hypothesis, lineage, relatedMemories, config);
  } catch (err) {
    console.error(`[synthesizer] API call failed: ${err.message}`);
    // Reset to testing so it can be retried
    return;
  }

  console.error(`[synthesizer] Outcome: ${synthesis.outcome} | Children: ${synthesis.child_hypotheses?.length || 0}`);

  // Update hypothesis file with synthesis
  writeSynthesis(pendingId, synthesis);
  updateHypothesisStatus(pendingId, synthesis.outcome);
  updateQueueEntry(pendingId, { status: synthesis.outcome, confidence: synthesis.confidence });

  // Spawn child hypotheses
  const children = [];
  if (synthesis.child_hypotheses && synthesis.child_hypotheses.length > 0) {
    for (const child of synthesis.child_hypotheses) {
      const childId = spawnChild(hypothesis, child, config);
      if (childId) children.push(childId);
    }
    console.error(`[synthesizer] Spawned ${children.length} child hypotheses`);
  }

  // Write durable memory
  if (synthesis.memory && synthesis.memory.type !== 'none') {
    writeMemoryFromSynthesis(synthesis.memory, hypothesis.data.domain, hypothesis.id);
  }

  // Check if tree is fully resolved — write root summary if so
  checkTreeClosure(hypothesis.data.root || pendingId);

  console.error('[synthesizer] Done');
}

async function callSynthesizerAPI(hypothesis, lineage, relatedMemories, config) {
  const question = (hypothesis.body.match(/\*\*Question:\*\*\s*(.+)/) || [])[1] || '';
  const rawResults = (hypothesis.body.match(/## Raw Results([\s\S]*?)(?=## Synthesis|$)/) || [])[1] || 'No results';

  const response = await client.messages.create({
    model: config.synthesizer_model || 'claude-opus-4-6',
    max_tokens: 4096,
    system: `You are a scientific synthesizer for an autonomous learning system.
You reason over experimental results, classify outcomes, extract durable knowledge,
and generate the next layer of questions to pursue.
You think like a researcher who is never satisfied with a partial answer.
Every result — even a clean confirmation — raises new questions. There are no dead ends.`,
    messages: [{
      role: 'user',
      content: `## Full Hypothesis Context

${lineage || '(Root hypothesis — no ancestors)'}

## This Hypothesis
ID: ${hypothesis.id}
Domain: ${hypothesis.data.domain}
Question: ${question}

## Raw Experimental Results
${rawResults}

## Related Memory Context
${relatedMemories || '(none loaded)'}

---

## Your Tasks

### 1. Classify the outcome
- **confirmed**: prediction was correct, finding is reliable and specific
- **refuted**: prediction was wrong — record what actually happens instead
- **open**: result is ambiguous, partial, or raises more questions than it answers

### 2. Write the synthesis
2-4 sentences. What was learned? Why does it matter? Be concrete — reference actual data from results.

### 3. Generate child hypotheses (REQUIRED — minimum ${config.min_children_per_result}, maximum ${config.max_children_per_result})
Even for confirmed/refuted outcomes: what does this finding NOT yet explain?
What edge cases remain? What would break this conclusion under different conditions?
Each child must be a CONCRETE, TESTABLE question — not vague.
Include: question, prediction, why_this_matters, domain (from the 11 domains).

### 4. Memory to write
- confirmed → semantic memory fact (1-3 sentences, concrete and specific)
- refuted → Solution entry (Symptom / Failed / Solution format, 3 fields)
- open → type: "none"

### 5. Confidence assessment
Given the lineage and this result, confidence in the root question being answerable: low/medium/high

## Output — JSON ONLY
\`\`\`json
{
  "outcome": "confirmed | refuted | open",
  "synthesis": "...",
  "confidence": "low | medium | high",
  "root_confidence_update": "low | medium | high",
  "child_hypotheses": [
    {
      "question": "...",
      "prediction": "...",
      "why_this_matters": "...",
      "domain": "..."
    }
  ],
  "memory": {
    "type": "semantic | solution | none",
    "content": "...",
    "tags": [],
    "trigger": []
  }
}
\`\`\``
    }]
  });

  const raw = response.content[0].text;
  const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

function writeSynthesis(id, synthesis) {
  const hyp = readHypothesis(id);
  const section = `## Synthesis

${synthesis.synthesis}

**Outcome:** ${synthesis.outcome}
**Confidence:** ${synthesis.confidence}

${synthesis.child_hypotheses?.length > 0
  ? '## Child Hypotheses\n\n' + synthesis.child_hypotheses.map(c => `- "${c.question}"`).join('\n')
  : ''}
`;
  const newBody = hyp.body.replace(
    /## Synthesis[\s\S]*$/,
    section
  );
  writeHypothesis(id, { ...hyp.data, confidence: synthesis.confidence }, newBody);
}

function spawnChild(parent, childSpec, config) {
  const parentData = parent.data;

  // Depth check
  const newDepth = (parentData.depth || 0) + 1;
  if (newDepth > config.max_depth) {
    logNeedsReview(
      'depth-limit-' + todayUTC(),
      `Child of ${parent.id} at depth ${newDepth} exceeds max_depth ${config.max_depth}: "${childSpec.question.slice(0,60)}"`
    );
    return null;
  }

  const id = nextHypothesisId();
  const today = todayUTC();

  const data = {
    type: 'hypothesis',
    id,
    parent: parent.id,
    root: parentData.root || parent.id,
    depth: newDepth,
    status: 'proposed',
    domain: childSpec.domain || parentData.domain,
    checklist_ref: null,
    created: today,
    activated: null,
    tested: null,
    synthesized: null,
    confidence: 'low',
    tags: [childSpec.domain || parentData.domain, 'spawned'],
    children: [],
  };

  // Add child to parent's children list
  const parentHyp = readHypothesis(parent.id);
  const parentChildren = parentHyp.data.children || [];
  writeHypothesis(parent.id, { ...parentHyp.data, children: [...parentChildren, id] }, parentHyp.body);

  const body = `## Lineage

${buildLineageSection(id) || '*(assembling...)*'}

## This Hypothesis

**Question:** ${childSpec.question}

**Why this matters:** ${childSpec.why_this_matters}

**Prediction:** ${childSpec.prediction}

## Test Plan

*(to be designed by experimenter)*

## Raw Results

*(filled in by experimenter)*

## Synthesis

*(filled in by synthesizer)*

**Outcome:** pending

## Child Hypotheses

*(generated by synthesizer)*
`;

  writeHypothesis(id, data, body);
  addToQueue({
    id,
    parent: parent.id,
    root: parentData.root || parent.id,
    depth: newDepth,
    status: 'proposed',
    domain: data.domain,
    question: childSpec.question,
    checklist_ref: null,
    created: today,
  });

  return id;
}

function writeMemoryFromSynthesis(memory, domain, hypothesisId) {
  const today = todayUTC();
  const { join } = await import('path').catch(() => require('path'));

  if (memory.type === 'semantic') {
    const semDir = join(MEMORY_DIR, 'semantic');
    mkdirSync(semDir, { recursive: true });
    const slug = `hypothesis-${domain}-${hypothesisId}`;
    const filePath = join(semDir, `${slug}.md`);
    writeMemoryFile(filePath, {
      type: 'semantic',
      tags: memory.tags || [domain, 'hypothesis-derived'],
      salience: 'medium',
      confidence: 'high',
      source: 'observed',
      status: 'confirmed',
      trigger: memory.trigger || [],
      related: [],
      created: today,
      'last-accessed': today,
    }, memory.content);
    console.error(`[synthesizer] Wrote semantic memory: ${filePath}`);

  } else if (memory.type === 'solution') {
    const feedbackPath = join(MEMORY_DIR, 'procedural', 'feedback.md');
    if (existsSync(feedbackPath)) {
      const file = readMemoryFile(feedbackPath);
      const entry = `\n\n## Solution: hypothesis-${domain}-${hypothesisId}\n\n${memory.content}`;
      writeMemoryFile(feedbackPath, file.data, file.body.trimEnd() + entry);
      console.error(`[synthesizer] Wrote Solution entry to feedback.md`);
    }
  }

  // Rebuild .index.json
  const allFiles = scanAllMemoryFiles();
  writeIndexJson(allFiles);
}

function loadRelatedMemories(tags) {
  const allFiles = scanAllMemoryFiles();
  const { tagOverlap } = require('./memory-utils.mjs');
  const related = allFiles
    .filter(f => tagOverlap(f.data.tags || [], tags) >= 2)
    .slice(0, 3)
    .map(f => `### ${f.relPath}\n${f.body.slice(0, 300)}`);
  return related.join('\n\n');
}

function checkTreeClosure(rootId) {
  const { readQueue, writeQueue } = require('./hypothesis-utils.mjs');
  const queue = readQueue();
  const tree = queue.trees.find(t => t.root === rootId);
  if (!tree || tree.status === 'closed') return;
  if (tree.open_leaves.length === 0) {
    tree.status = 'closed';
    writeQueue(queue);
    console.error(`[synthesizer] Tree ${rootId} fully resolved — closed`);
  }
}

main().catch(err => {
  console.error('[synthesizer] Fatal error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Test synthesizer imports cleanly**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node -e "import('./synthesizer.mjs').then(() => console.log('import ok')).catch(e => console.error('import error:', e.message))"
```

Expected: `import ok` (no synthesis-pending.json means it exits cleanly)

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/synthesizer.mjs" .
git add .
git commit -m "feat: synthesizer.mjs — Claude API synthesis, child spawning, memory writing"
git push
```

---

## Task 9: mcp-server.mjs

**Files:**
- Create: `C:/Users/Jon Berg/.claude/skills/claude-memory/mcp-server.mjs`

- [ ] **Step 1: Create mcp-server.mjs**

```js
// mcp-server.mjs
// Always-on MCP server exposing 9 tools over stdio.
// Register in .claude/settings.json under mcpServers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  readIndexJson, readMemoryFile, writeMemoryFile, scanAllMemoryFiles,
  writeIndexJson, todayUTC, MEMORY_DIR, tagOverlap
} from './memory-utils.mjs';
import {
  readHypothesis, readQueue, writeQueue, addToQueue, buildLineageSection,
  nextHypothesisId, writeHypothesis, updateQueueEntry, selectNextHypothesis,
  ensureHypothesesDir, HYPOTHESIS_QUEUE_FILE, HYPOTHESES_DIR
} from './hypothesis-utils.mjs';
import { readFileSync as rfs } from 'fs';

const server = new Server(
  { name: 'claude-memory', version: '2.2.0' },
  { capabilities: { tools: {} } }
);

// --- Tool Definitions ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'memory_search',
      description: 'Search memory files by keyword. Returns scored results from .index.json.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords' },
          limit: { type: 'number', description: 'Max results (default 5)' }
        },
        required: ['query']
      }
    },
    {
      name: 'memory_read',
      description: 'Read a specific memory file by relative path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path e.g. semantic/user.md' }
        },
        required: ['path']
      }
    },
    {
      name: 'memory_write',
      description: 'Create or update a memory file.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['semantic', 'procedural', 'reference', 'episodic'] },
          tags: { type: 'array', items: { type: 'string' } },
          content: { type: 'string' },
          trigger: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          source: { type: 'string', enum: ['observed', 'inferred', 'instructed', 'referenced'] }
        },
        required: ['type', 'tags', 'content']
      }
    },
    {
      name: 'hypothesis_create',
      description: 'Add a new hypothesis to the queue. Use during live sessions when an unknown surfaces.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          domain: { type: 'string' },
          prediction: { type: 'string' },
          why_matters: { type: 'string' },
          parent_id: { type: 'string', description: 'Optional parent hypothesis ID' }
        },
        required: ['question', 'domain', 'prediction', 'why_matters']
      }
    },
    {
      name: 'hypothesis_get',
      description: 'Get a hypothesis with its full lineage context.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    },
    {
      name: 'hypothesis_list',
      description: 'List hypotheses filtered by status and/or domain.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          domain: { type: 'string' },
          root: { type: 'string', description: 'Return entire tree for this root ID' }
        }
      }
    },
    {
      name: 'hypothesis_status',
      description: 'Get queue statistics: counts by status/domain, coverage across checklist.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'checklist_get',
      description: 'Get the 130-item world navigation checklist with hypothesis status per item.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Filter by domain category' },
          status: { type: 'string', enum: ['unexplored', 'proposed', 'in_progress', 'answered'] }
        }
      }
    },
    {
      name: 'checklist_activate',
      description: 'Create a hypothesis from a specific checklist item.',
      inputSchema: {
        type: 'object',
        properties: {
          item_ref: { type: 'string', description: 'e.g. cat1-02' },
          priority: { type: 'string', enum: ['high', 'normal'] }
        },
        required: ['item_ref']
      }
    }
  ]
}));

// --- Tool Handlers ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'memory_search': return handleMemorySearch(args);
      case 'memory_read': return handleMemoryRead(args);
      case 'memory_write': return handleMemoryWrite(args);
      case 'hypothesis_create': return handleHypothesisCreate(args);
      case 'hypothesis_get': return handleHypothesisGet(args);
      case 'hypothesis_list': return handleHypothesisList(args);
      case 'hypothesis_status': return handleHypothesisStatus();
      case 'checklist_get': return handleChecklistGet(args);
      case 'checklist_activate': return handleChecklistActivate(args);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

function handleMemorySearch({ query, limit = 5 }) {
  const entries = readIndexJson();
  if (!entries) return { content: [{ type: 'text', text: 'Index not found' }] };
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = entries
    .filter(e => e.status !== 'superseded')
    .map(e => {
      const tagScore = tagOverlap(e.tags || [], keywords);
      const triggerScore = tagOverlap(e.trigger || [], keywords) * 2;
      const score = (tagScore + triggerScore) * ({ high: 3, medium: 2, low: 1 }[e.salience] || 2);
      return { ...e, score };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return { content: [{ type: 'text', text: JSON.stringify(scored, null, 2) }] };
}

function handleMemoryRead({ path }) {
  const filePath = join(MEMORY_DIR, path);
  if (!existsSync(filePath)) return { content: [{ type: 'text', text: `Not found: ${path}` }] };
  return { content: [{ type: 'text', text: readFileSync(filePath, 'utf-8') }] };
}

function handleMemoryWrite({ type, tags, content, trigger = [], confidence = 'medium', source = 'observed' }) {
  const today = todayUTC();
  const slug = tags.slice(0, 3).join('-') + '-' + today;
  const dir = join(MEMORY_DIR, type === 'episodic' ? 'episodic' : type === 'procedural' ? 'procedural' : type === 'reference' ? 'reference' : 'semantic');
  const filePath = join(dir, `${slug}.md`);
  writeMemoryFile(filePath, {
    type, tags, salience: 'medium', confidence, source,
    status: type === 'episodic' ? 'open' : 'confirmed',
    trigger, related: [], created: today, 'last-accessed': today,
  }, content);
  writeIndexJson(scanAllMemoryFiles());
  return { content: [{ type: 'text', text: `Written: ${filePath}` }] };
}

function handleHypothesisCreate({ question, domain, prediction, why_matters, parent_id }) {
  ensureHypothesesDir();
  const id = nextHypothesisId();
  const today = todayUTC();
  let depth = 0;
  let root = id;
  if (parent_id) {
    const parent = readHypothesis(parent_id);
    if (parent) {
      depth = (parent.data.depth || 0) + 1;
      root = parent.data.root || parent_id;
    }
  }
  writeHypothesis(id, {
    type: 'hypothesis', id, parent: parent_id || null, root, depth,
    status: 'proposed', domain, checklist_ref: null, created: today,
    activated: null, tested: null, synthesized: null, confidence: 'low',
    tags: [domain, 'reactive'], children: [],
  }, `## This Hypothesis\n\n**Question:** ${question}\n\n**Why this matters:** ${why_matters}\n\n**Prediction:** ${prediction}\n\n## Test Plan\n\n*(to be designed by experimenter)*\n\n## Raw Results\n\n*(filled in by experimenter)*\n\n## Synthesis\n\n*(filled in by synthesizer)*\n`);
  addToQueue({ id, parent: parent_id || null, root, depth, status: 'proposed', domain, question, created: today });
  return { content: [{ type: 'text', text: `Created hypothesis ${id}: "${question}"` }] };
}

function handleHypothesisGet({ id }) {
  const hyp = readHypothesis(id);
  if (!hyp) return { content: [{ type: 'text', text: `Not found: ${id}` }] };
  const lineage = buildLineageSection(id);
  return { content: [{ type: 'text', text: `${lineage}\n\n---\n\n${readFileSync(hyp.path, 'utf-8')}` }] };
}

function handleHypothesisList({ status, domain, root } = {}) {
  const queue = readQueue();
  let entries = queue.flat;
  if (status) entries = entries.filter(e => e.status === status);
  if (domain) entries = entries.filter(e => e.domain === domain);
  if (root) entries = entries.filter(e => e.root === root || e.id === root);
  return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
}

function handleHypothesisStatus() {
  const queue = readQueue();
  const flat = queue.flat;
  const byStatus = {};
  const byDomain = {};
  for (const e of flat) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  }
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        total: flat.length,
        by_status: byStatus,
        by_domain: byDomain,
        trees: queue.trees.length,
        open_trees: queue.trees.filter(t => t.status !== 'closed').length,
      }, null, 2)
    }]
  };
}

function handleChecklistGet({ domain, status } = {}) {
  const checklistPath = join(MEMORY_DIR, 'hypotheses', 'checklist.md');
  if (!existsSync(checklistPath)) return { content: [{ type: 'text', text: 'Checklist not found' }] };
  const content = readFileSync(checklistPath, 'utf-8');
  // Return full content for now — filtering is a future enhancement
  return { content: [{ type: 'text', text: content }] };
}

function handleChecklistActivate({ item_ref, priority = 'normal' }) {
  const checklistPath = join(MEMORY_DIR, 'hypotheses', 'checklist.md');
  if (!existsSync(checklistPath)) return { content: [{ type: 'text', text: 'Checklist not found' }] };
  const content = readFileSync(checklistPath, 'utf-8');
  const line = content.split('\n').find(l => l.includes(`hyp-ref: ${item_ref}`));
  if (!line) return { content: [{ type: 'text', text: `Item ${item_ref} not found in checklist` }] };
  const question = line.replace(/.*`hyp-ref:[^`]+`\s*/, '').trim();
  const domain = item_ref.startsWith('cat1') ? 'perception'
    : item_ref.startsWith('cat2') ? 'memory'
    : item_ref.startsWith('cat3') ? 'environment'
    : item_ref.startsWith('cat4') ? 'causation'
    : item_ref.startsWith('cat5') ? 'feedback'
    : item_ref.startsWith('cat6') ? 'user-model'
    : item_ref.startsWith('cat7') ? 'knowledge'
    : item_ref.startsWith('cat8') ? 'time'
    : item_ref.startsWith('cat9') ? 'action'
    : item_ref.startsWith('cat10') ? 'collaboration'
    : 'meta-cognition';
  return handleHypothesisCreate({
    question,
    domain,
    prediction: '(to be determined)',
    why_matters: `Checklist item ${item_ref} — priority: ${priority}`,
  });
}

// --- Start Server ---

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[mcp-server] Claude Memory MCP server running on stdio');
```

- [ ] **Step 2: Test MCP server starts**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 3 node mcp-server.mjs 2>/dev/null | head -5
```

Expected: JSON response containing tool list (or timeout after 3s which is fine — server is running and waiting)

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/mcp-server.mjs" .
git add .
git commit -m "feat: mcp-server.mjs — 9 MCP tools exposing memory + hypothesis system"
git push
```

---

## Task 10: Register MCP Server + Cron Schedule

**Files:**
- Modify: `C:/Users/Jon Berg/.claude/settings.json`

- [ ] **Step 1: Read current settings.json**

```bash
cat "C:/Users/Jon Berg/.claude/settings.json"
```

- [ ] **Step 2: Add mcpServers and cron to settings.json**

Add `mcpServers` block and cron entry. The full hooks + mcpServers section should look like:

```json
{
  "mcpServers": {
    "claude-memory": {
      "command": "node",
      "args": ["C:/Users/Jon Berg/.claude/skills/claude-memory/mcp-server.mjs"]
    }
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/Jon Berg/.claude/skills/claude-memory/retrieval-hook.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/Jon Berg/.claude/skills/claude-memory/error-capture-hook.mjs\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/Jon Berg/.claude/skills/claude-memory/consolidation.mjs\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Register experimenter cron via Claude Code**

Run this in a Claude Code session:

```
/schedule "Run hypothesis experimenter" --cron "0 */2 * * *" --command "node \"C:/Users/Jon Berg/.claude/skills/claude-memory/experimenter.mjs\""
```

Or use the CronCreate tool directly if available.

- [ ] **Step 4: Restart Claude Code to pick up MCP server**

Close and reopen Claude Code. Verify the `claude-memory` MCP tools are available by typing `/mcp` or checking tool list.

- [ ] **Step 5: Verify MCP tools available**

In a new Claude Code session, test:
```
Use the hypothesis_status tool to check the current queue
```

Expected: JSON response with `total: 11`, `by_status: {proposed: 11}`, `by_domain: {...}`

---

## Task 11: Update SKILL.md

**Files:**
- Modify: `C:/Users/Jon Berg/.claude/skills/claude-memory/SKILL.md`

- [ ] **Step 1: Add hypothesis protocol section to SKILL.md**

Append to the end of `SKILL.md`:

```markdown
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
```

- [ ] **Step 2: Commit final state**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/SKILL.md" .
cp "C:/Users/Jon Berg/.claude/skills/claude-memory/memory-utils.mjs" .
git add .
git commit -m "feat: complete hypothesis agent system v2.2 — experimenter, synthesizer, MCP server, 130-item checklist"
git push
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 1: Verify bootstrap created hypothesis files**

```bash
ls "C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses/" | wc -l
```

Expected: at least 14 files (11 hyp files + checklist.md + queue.json + needs-review.md)

- [ ] **Step 2: Verify queue has 11 entries**

```bash
node -e "
import('./hypothesis-utils.mjs').then(({ readQueue }) => {
  const q = readQueue();
  console.log('Total:', q.flat.length, '| Trees:', q.trees.length);
  console.log('Domains:', [...new Set(q.flat.map(e => e.domain))].join(', '));
})
" 
```

Expected: `Total: 11 | Trees: 11` with all 11 domains listed

- [ ] **Step 3: Run experimenter manually for first hypothesis**

```bash
cd "C:/Users/Jon Berg/.claude/skills/claude-memory"
node experimenter.mjs
```

Expected:
```
[experimenter] Selected: hyp-001
[experimenter] Calling claude -p for hyp-001...
[experimenter] Results written for hyp-001 — triggering synthesizer
[synthesizer] Synthesizing hyp-001...
[synthesizer] Outcome: confirmed|refuted|open | Children: 2-5
[synthesizer] Done
[experimenter] Done
```

- [ ] **Step 4: Verify results written**

```bash
node -e "
import('./hypothesis-utils.mjs').then(({ readHypothesis }) => {
  const h = readHypothesis('hyp-001');
  console.log('Status:', h.data.status);
  console.log('Children:', h.data.children);
  console.log('Has raw results:', h.body.includes('Test run:'));
  console.log('Has synthesis:', h.body.includes('Outcome:'));
})
"
```

Expected: status is `confirmed`, `refuted`, or `open`; children array has entries; body has results and synthesis

- [ ] **Step 5: Verify child hypotheses were created**

```bash
ls "C:/Users/Jon Berg/.claude/projects/C--Users-Jon-Berg/memory/hypotheses/" | grep hyp-0
```

Expected: more than 11 files (children were spawned)

- [ ] **Step 6: Final push**

```bash
cd "C:/Users/Jon Berg/Projects/Claude Memory"
git add .
git commit -m "chore: v2.2 smoke test verified — hypothesis system live"
git push
```

---

## Quick Reference

**Run experimenter manually:**
```bash
node "C:/Users/Jon Berg/.claude/skills/claude-memory/experimenter.mjs"
```

**Check queue status:**
```bash
node -e "import('./hypothesis-utils.mjs').then(({readQueue})=>{ const q=readQueue(); console.log(JSON.stringify({total:q.flat.length,byStatus:q.flat.reduce((a,e)=>{a[e.status]=(a[e.status]||0)+1;return a},{})},null,2)) })"
```

**Start MCP server manually (for testing):**
```bash
node "C:/Users/Jon Berg/.claude/skills/claude-memory/mcp-server.mjs"
```

**Re-run bootstrap (idempotent):**
```bash
node "C:/Users/Jon Berg/.claude/skills/claude-memory/bootstrap-hypotheses.mjs"
```
