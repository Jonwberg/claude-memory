// hypothesis-utils.mjs
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync
} from 'fs';
import { join, basename } from 'path';
import {
  HYPOTHESES_DIR, HYPOTHESIS_QUEUE_FILE, HYPOTHESIS_LOCK_FILE,
  NEEDS_REVIEW_FILE, SKILL_DIR, todayUTC, parseFrontmatter, serializeFrontmatter
} from './memory-utils.mjs';

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
  const queue = readQueue();
  const exists = queue.flat.some(e => e.id === entry.id);
  if (exists) return;
  queue.flat.push(entry);
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
  if (updates.status) {
    for (const tree of queue.trees) {
      if (updates.status === 'confirmed') {
        tree.open_leaves = tree.open_leaves.filter(l => l !== id);
        tree.confirmed_leaves.push(id);
      } else if (updates.status === 'refuted') {
        tree.open_leaves = tree.open_leaves.filter(l => l !== id);
        tree.refuted_leaves.push(id);
      }
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

  const activated = flat.find(e => e.status === 'activated');
  if (activated) return activated.id;

  for (const tree of queue.trees) {
    if (tree.status === 'closed') continue;
    const openLeaves = flat.filter(e =>
      tree.open_leaves.includes(e.id) &&
      e.status === 'proposed' &&
      e.depth > 0
    );
    if (openLeaves.length > 0) {
      openLeaves.sort((a, b) => (b.depth || 0) - (a.depth || 0));
      return openLeaves[0].id;
    }
  }

  const coveredDomains = new Set(
    flat.filter(e => ['confirmed','refuted','open'].includes(e.status))
        .map(e => e.domain)
  );
  const newDomain = flat.find(e => e.status === 'proposed' && !coveredDomains.has(e.domain));
  if (newDomain) return newDomain.id;

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
      return false;
    }
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
