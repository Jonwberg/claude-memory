// memory-utils.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, renameSync } from 'fs';
import { join, relative, basename } from 'path';
import { homedir } from 'os';

export const MEMORY_DIR = join(homedir(), '.claude', 'projects', 'C--Users-Jon-Berg', 'memory');
export const MEMORY_MD = join(MEMORY_DIR, 'MEMORY.md');
export const MEMORY_TMP = join(MEMORY_DIR, 'MEMORY.md.tmp');
export const INDEX_JSON = join(MEMORY_DIR, '.index.json');
export const INDEX_TMP = join(MEMORY_DIR, '.index.json.tmp');
export const SESSION_TAGS_FILE = join(MEMORY_DIR, 'session-tags.json');
export const SESSION_ERRORS_FILE = join(MEMORY_DIR, 'session-errors.json');
export const SKILL_DIR = join(homedir(), '.claude', 'skills', 'claude-memory');
export const HYPOTHESES_DIR = join(MEMORY_DIR, 'hypotheses');
export const HYPOTHESIS_QUEUE_FILE = join(HYPOTHESES_DIR, 'hypothesis-queue.json');
export const HYPOTHESIS_LOCK_FILE = join(HYPOTHESES_DIR, 'hypothesis.lock');
export const NEEDS_REVIEW_FILE = join(HYPOTHESES_DIR, 'needs-review.md');
export const MEMORY_CONTEXT_BUDGET_TOKENS = 40000;

// Parse YAML frontmatter from a markdown file.
// Returns { data: {field: value}, body: string }
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };
  const fm = match[1];
  const body = match[2] || '';
  const data = {};
  for (const line of fm.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      // YAML inline array: [a, b, c]
      data[key] = raw.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else {
      data[key] = raw;
    }
  }
  return { data, body };
}

// Serialize frontmatter back to string.
export function serializeFrontmatter(data, body) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.join(', ')}]`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body.trim());
  return lines.join('\n') + '\n';
}

// Read a memory file. Returns { data, body, path, relPath }.
export function readMemoryFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { data, body } = parseFrontmatter(content);
  const relPath = relative(MEMORY_DIR, filePath).replace(/\\/g, '/');
  return { data, body, path: filePath, relPath };
}

// Write a memory file with updated frontmatter.
export function writeMemoryFile(filePath, data, body) {
  writeFileSync(filePath, serializeFrontmatter(data, body), 'utf-8');
}

// Scan all memory files in all layers. Returns array of { data, body, path, relPath }.
export function scanAllMemoryFiles() {
  const layers = ['semantic', 'procedural', 'reference', 'episodic'];
  const files = [];
  for (const layer of layers) {
    const dir = join(MEMORY_DIR, layer);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      files.push(readMemoryFile(join(dir, f)));
    }
  }
  return files;
}

// Count tag overlap between two string arrays (case-insensitive, exact tokens).
export function tagOverlap(tagsA, tagsB) {
  if (!tagsA || !tagsB) return 0;
  const setB = new Set(tagsB.map(t => t.toLowerCase()));
  return tagsA.filter(t => setB.has(t.toLowerCase())).length;
}

// Parse MEMORY.md and return array of { relPath, tags, summary, section }.
// Used as fallback when .index.json is missing.
export function parseMemoryIndex() {
  if (!existsSync(MEMORY_MD)) return [];
  const content = readFileSync(MEMORY_MD, 'utf-8');
  const entries = [];
  let currentSection = '';
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase();
      continue;
    }
    // Match: - [filename](path) `tags` — summary
    const m = line.match(/^- \[([^\]]+)\]\(([^)]+)\)\s+`([^`]*)`\s+—\s+(.+)$/);
    if (!m) continue;
    const [, , relPath, tagStr, summary] = m;
    const tags = tagStr.split(' ').filter(Boolean);
    entries.push({ relPath, tags, summary, section: currentSection });
  }
  return entries;
}

// Read .index.json and return entries array, or null if missing/corrupt.
export function readIndexJson() {
  if (!existsSync(INDEX_JSON)) return null;
  try {
    const raw = readFileSync(INDEX_JSON, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.entries || null;
  } catch {
    return null;
  }
}

// Build .index.json content object from all current files.
export function buildIndexJson(files) {
  const SALIENCE_ORDER = { high: 0, medium: 1, low: 2 };
  const entries = [];

  for (const f of files) {
    const type = f.data.type || 'semantic';
    const tags = f.data.tags || [];
    const summary = f.body.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 120);
    const entry = {
      path: f.relPath,
      filename: basename(f.path),
      type,
      tags,
      salience: f.data.salience || 'medium',
      confidence: f.data.confidence || 'medium',
      source: f.data.source || 'observed',
      created: f.data.created || '',
      last_accessed: f.data['last-accessed'] || '',
      summary,
      related: f.data.related || [],
      project: f.data.project || null,
      status: f.data.status || (type === 'episodic' ? 'open' : 'confirmed'),
      trigger: f.data.trigger ? (Array.isArray(f.data.trigger) ? f.data.trigger : f.data.trigger.split(',').map(s => s.trim()).filter(Boolean)) : [],
    };
    if (type === 'episodic') {
      entry.retention = f.data.retention || 'temporary';
      if (f.data['decay-after']) entry.decay_after = f.data['decay-after'];
    }
    entries.push(entry);
  }

  // Sort: salience order, then type order, then alpha
  const TYPE_ORDER = { semantic: 0, procedural: 1, reference: 2, episodic: 3 };
  entries.sort((a, b) => {
    const sd = (SALIENCE_ORDER[a.salience] ?? 1) - (SALIENCE_ORDER[b.salience] ?? 1);
    if (sd !== 0) return sd;
    const td = (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
    if (td !== 0) return td;
    return a.filename.localeCompare(b.filename);
  });

  return {
    version: '2.1',
    generated: todayUTC(),
    entries,
  };
}

// Atomically write .index.json via tmp file.
export function writeIndexJson(files) {
  const obj = buildIndexJson(files);
  writeFileSync(INDEX_TMP, JSON.stringify(obj, null, 2), 'utf-8');
  renameSync(INDEX_TMP, INDEX_JSON);
}

// Get today's date as ISO string (UTC, calendar date only).
export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Add N days to an ISO date string (UTC).
export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Return true if isoDate is before today (UTC).
export function isExpired(isoDate) {
  if (!isoDate) return false;
  return isoDate < todayUTC();
}

// Build MEMORY.md content from all current files (human-readable index).
export function buildMemoryIndex(files) {
  const SALIENCE_ORDER = { high: 0, medium: 1, low: 2 };
  const sections = { semantic: [], procedural: [], episodic: [], reference: [] };

  for (const f of files) {
    const layer = f.data.type;
    if (!sections[layer]) continue;
    const tags = (f.data.tags || []).join(' ');
    const summary = f.body.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 80);
    sections[layer].push({
      filename: basename(f.path),
      relPath: f.relPath,
      tags,
      summary,
      salience: f.data.salience || 'medium',
    });
  }

  // Sort each section: salience order, then alpha by filename
  for (const sec of Object.values(sections)) {
    sec.sort((a, b) => {
      const sd = (SALIENCE_ORDER[a.salience] ?? 1) - (SALIENCE_ORDER[b.salience] ?? 1);
      return sd !== 0 ? sd : a.filename.localeCompare(b.filename);
    });
  }

  const lines = ['# Memory Index', ''];
  for (const [sectionName, entries] of Object.entries(sections)) {
    lines.push(`## ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}`);
    for (const e of entries) {
      lines.push(`- [${e.filename}](${e.relPath}) \`${e.tags}\` — ${e.summary}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
