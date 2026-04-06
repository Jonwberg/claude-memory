// wip-checkpoint.mjs
// PostToolUse hook — fires after Write or Edit tool calls.
// Creates/appends to an episodic WIP file recording what was changed.
// This episodic file survives abrupt exits where the Stop hook never fires,
// because the consolidation script picks up recent episodic files at session start.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MEMORY_DIR, todayUTC, addDays, writeMemoryFile, readMemoryFile } from './memory-utils.mjs';

const EPISODIC_DIR = join(MEMORY_DIR, 'episodic');

// Paths that should never be recorded (system/temp files)
const SKIP_PATTERNS = [
  /[/\\]\.claude[/\\]/,
  /\.tmp$/i,
  /\.temp$/i,
  /[/\\]node_modules[/\\]/,
  /[/\\]__pycache__[/\\]/,
  /\.pyc$/i,
];

function shouldSkip(filePath) {
  if (!filePath) return true;
  return SKIP_PATTERNS.some(p => p.test(filePath));
}

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function deriveTagsFromPath(filePath) {
  // Normalise separators, split on / \ - _ . and filter noise
  const STOP = new Set(['the','a','an','is','in','at','to','for','of','and','or','not','with','from','that','this','it','md','mjs','js','py','ts','json','txt','yml','yaml']);
  const tokens = filePath
    .replace(/\\/g, '/')
    .split(/[/\-_.]/)
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
  return [...new Set(tokens)].slice(0, 8);
}

function buildDescription(toolName, toolInput) {
  if (toolName === 'Write') {
    const content = toolInput.content || '';
    const firstLine = content.split('\n').find(l => l.trim()) || '';
    return firstLine.slice(0, 80) || 'new file';
  }
  if (toolName === 'Edit') {
    const newStr = toolInput.new_string || '';
    const firstLine = newStr.split('\n').find(l => l.trim()) || '';
    const preview = firstLine.slice(0, 60) || newStr.slice(0, 60) || '(empty)';
    return `edited — ${preview}`;
  }
  return 'modified';
}

function buildFrontmatter(today, tags) {
  const decayAfter = addDays(today, 14);
  return {
    type: 'episodic',
    tags,
    salience: 'medium',
    confidence: 'medium',
    source: 'observed',
    status: 'open',
    retention: 'temporary',
    created: today,
    'last-accessed': today,
    'decay-after': decayAfter,
  };
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let parsed;
  try {
    parsed = JSON.parse(input || '{}');
  } catch {
    process.exit(0);
  }

  const toolName = parsed.tool_name || '';
  if (toolName !== 'Write' && toolName !== 'Edit') process.exit(0);

  const toolInput = parsed.tool_input || {};
  const filePath = toolInput.file_path || '';

  if (shouldSkip(filePath)) process.exit(0);

  const today = todayUTC();
  const time = nowHHMM();
  const description = buildDescription(toolName, toolInput);
  const tags = deriveTagsFromPath(filePath);

  // Ensure episodic dir exists
  mkdirSync(EPISODIC_DIR, { recursive: true });

  const wipFile = join(EPISODIC_DIR, `${today}-wip.md`);
  const newEntry = `- ${time} ${toolName}: \`${filePath}\` — ${description}`;

  if (existsSync(wipFile)) {
    // Append to existing file — update last-accessed in frontmatter and add entry
    let existing;
    try {
      existing = readMemoryFile(wipFile);
    } catch {
      // If we can't parse it, just append raw
      const raw = readFileSync(wipFile, 'utf-8');
      writeFileSync(wipFile, raw.trimEnd() + '\n' + newEntry + '\n', 'utf-8');
      process.exit(0);
    }

    const updatedData = { ...existing.data, 'last-accessed': today };
    const updatedBody = (existing.body.trimEnd() + '\n' + newEntry).trimStart();
    writeMemoryFile(wipFile, updatedData, updatedBody);
  } else {
    // Create new WIP file with frontmatter
    const data = buildFrontmatter(today, tags);
    const body = `# WIP Checkpoint — ${today}\n\n${newEntry}`;
    writeMemoryFile(wipFile, data, body);
  }

  process.exit(0);
}

main().catch(err => {
  process.stderr.write('[wip-checkpoint] Hook error: ' + err.message + '\n');
  process.exit(0); // never block Claude
});
