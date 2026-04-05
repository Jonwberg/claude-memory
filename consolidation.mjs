// consolidation.mjs
// Stop hook — consolidates episodic notes into semantic/procedural layers.
// Runs after each session via the Stop hook in settings.json.
// No stdin input required; reads memory directory directly.

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { join, basename } from 'path';
import {
  MEMORY_DIR, MEMORY_MD, MEMORY_TMP, INDEX_JSON, INDEX_TMP, SESSION_TAGS_FILE,
  readMemoryFile, writeMemoryFile, scanAllMemoryFiles,
  tagOverlap, todayUTC, isExpired, buildMemoryIndex, writeIndexJson
} from './memory-utils.mjs';

const BEHAVIORAL_PATTERNS = [
  /\bdon'?t\b/i, /\bnever\b/i, /\balways\b/i, /\bshould\b/i, /\bmust\b/i,
  /\bavoid\b/i, /\bprefer\b/i, /\buse\b.*\binstead\b/i, /\bstop\b/i,
  /\brun\b.*\bsequentially\b/i, /\bcheck\b.*\bbefore\b/i,
  /^\s*use\b/i,
];

export function isBehavioral(claim) {
  return BEHAVIORAL_PATTERNS.some(p => p.test(claim));
}

// Find semantic file with highest tag overlap. Returns { relPath, path, data, body } or null if <2.
export function findBestSemanticFile(tags, memoryDir = MEMORY_DIR) {
  const semDir = join(memoryDir, 'semantic');
  if (!existsSync(semDir)) return null;
  let best = null;
  let bestOverlap = 0;
  let bestSalience = 0;
  let bestLastAccessed = '';
  const SALIENCE_SCORE = { high: 3, medium: 2, low: 1 };

  for (const f of readdirSync(semDir)) {
    if (!f.endsWith('.md')) continue;
    const filePath = join(semDir, f);
    const file = readMemoryFile(filePath);
    const overlap = tagOverlap(tags, file.data.tags || []);
    const salience = SALIENCE_SCORE[file.data.salience] ?? 2;
    const lastAccessed = file.data['last-accessed'] || '';
    const isBetter = overlap > bestOverlap
      || (overlap === bestOverlap && salience > bestSalience)
      || (overlap === bestOverlap && salience === bestSalience && lastAccessed > bestLastAccessed);
    if (isBetter) {
      bestOverlap = overlap;
      bestSalience = salience;
      bestLastAccessed = lastAccessed;
      best = file;
    }
  }
  return bestOverlap >= 2 ? best : null;
}

export function classifyClaim(claim) {
  return isBehavioral(claim) ? 'procedural' : 'semantic';
}

// Extract individual claims from episodic file body at sentence level (claim-aware).
// Falls back to line splitting if sentence extraction yields nothing useful.
export function extractClaims(body) {
  const claims = [];

  // Split paragraphs first, then extract sentences within each paragraph.
  for (const paragraph of body.split(/\n{2,}/)) {
    const stripped = paragraph.replace(/^[-*#>]\s+/gm, '').trim();
    if (!stripped) continue;

    // Sentence-level split: split on ". ", "! ", "? " followed by capital letter,
    // or end of string. Preserves the sentence terminator.
    const sentences = stripped
      .split(/(?<=[.!?])\s+(?=[A-Z`"'])/)
      .map(s => s.trim())
      .filter(s => s.length > 15);

    if (sentences.length > 0) {
      claims.push(...sentences);
    } else {
      // Fallback: treat entire stripped paragraph as one claim if long enough
      if (stripped.length > 15) claims.push(stripped);
    }
  }

  return claims;
}

// Check if a claim already exists in a file (simple substring dedup).
function isDuplicate(claim, existingBody) {
  const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return existingBody.toLowerCase().includes(normalize(claim).slice(0, 40));
}

// Phase 1: Absorb new/modified episodic files into semantic/procedural.
function phase1(episodicFiles) {
  for (const epFile of episodicFiles) {
    const claims = extractClaims(epFile.body);
    for (const claim of claims) {
      if (isBehavioral(claim)) {
        absorbToProcedural(claim);
      } else {
        absorbToSemantic(claim, epFile.data.tags || []);
      }
    }
  }
}

function absorbToProcedural(claim) {
  const feedbackPath = join(MEMORY_DIR, 'procedural', 'feedback.md');
  if (!existsSync(feedbackPath)) return;
  const file = readMemoryFile(feedbackPath);
  if (isDuplicate(claim, file.body)) return;
  const newBody = file.body.trimEnd() + '\n\n' + claim;
  writeMemoryFile(feedbackPath, file.data, newBody);
}

function absorbToSemantic(claim, episodicTags) {
  const best = findBestSemanticFile(episodicTags);
  if (best) {
    if (isDuplicate(claim, best.body)) return;
    const newBody = best.body.trimEnd() + '\n\n' + claim;
    writeMemoryFile(best.path, best.data, newBody);
  } else {
    // Create or append to slug-named semantic file
    const today = todayUTC();
    const slug = episodicTags.slice(0, 3).join('-') || 'misc';
    const newPath = join(MEMORY_DIR, 'semantic', `${slug}.md`);
    if (existsSync(newPath)) {
      const existing = readMemoryFile(newPath);
      if (!isDuplicate(claim, existing.body)) {
        writeMemoryFile(newPath, existing.data, existing.body.trimEnd() + '\n\n' + claim);
      }
    } else {
      writeMemoryFile(newPath, {
        type: 'semantic',
        tags: episodicTags,
        salience: 'medium',
        confidence: 'medium',
        source: 'observed',
        status: 'confirmed',
        related: [],
        created: today,
        'last-accessed': today,
      }, claim);
    }
  }
}

// Phase 2: Decay pass — absorb and delete expired episodic files.
function phase2() {
  const episodicDir = join(MEMORY_DIR, 'episodic');
  if (!existsSync(episodicDir)) return;
  for (const f of readdirSync(episodicDir)) {
    if (!f.endsWith('.md')) continue;
    const filePath = join(episodicDir, f);
    const file = readMemoryFile(filePath);
    if (!isExpired(file.data['decay-after'])) continue;
    // Absorb all claims unconditionally (threshold waived)
    const claims = extractClaims(file.body);
    for (const claim of claims) {
      if (isBehavioral(claim)) {
        absorbToProcedural(claim);
      } else {
        absorbToSemanticUnconditional(claim, file.data.tags || []);
      }
    }
    unlinkSync(filePath);
    console.error(`[consolidation] Deleted expired episodic: ${f}`);
  }
}

function absorbToSemanticUnconditional(claim, episodicTags) {
  const semDir = join(MEMORY_DIR, 'semantic');
  if (!existsSync(semDir)) return;
  // Find any semantic file with overlap >= 1
  let best = null;
  let bestOverlap = 0;
  for (const f of readdirSync(semDir)) {
    if (!f.endsWith('.md')) continue;
    const file = readMemoryFile(join(semDir, f));
    const overlap = tagOverlap(episodicTags, file.data.tags || []);
    if (overlap > bestOverlap) { bestOverlap = overlap; best = file; }
  }
  if (best && bestOverlap >= 1) {
    if (!isDuplicate(claim, best.body)) {
      writeMemoryFile(best.path, best.data, best.body.trimEnd() + '\n\n' + claim);
    }
  } else {
    const today = todayUTC();
    const slug = episodicTags.slice(0, 3).join('-') || 'misc';
    const newPath = join(semDir, `${slug}.md`);
    if (existsSync(newPath)) {
      const existing = readMemoryFile(newPath);
      if (!isDuplicate(claim, existing.body)) {
        writeMemoryFile(newPath, existing.data, existing.body.trimEnd() + '\n\n' + claim);
      }
    } else {
      writeMemoryFile(newPath, {
        type: 'semantic', tags: episodicTags, salience: 'medium',
        confidence: 'medium', source: 'observed', status: 'confirmed',
        related: [], created: today, 'last-accessed': today,
      }, claim);
    }
  }
}

// Phase 3: Update salience and last-accessed.
function phase3(sessionTagSet) {
  const today = todayUTC();
  const ninetyDaysAgo = new Date(today + 'T00:00:00Z');
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const staleDate = ninetyDaysAgo.toISOString().slice(0, 10);

  const allFiles = scanAllMemoryFiles().filter(f => f.data.type !== 'episodic');
  for (const file of allFiles) {
    const tags = file.data.tags || [];
    const lastAccessed = file.data['last-accessed'] || '';
    let newSalience;
    if (tags.some(t => sessionTagSet.has(t.toLowerCase()))) {
      newSalience = 'high';
    } else if (lastAccessed < staleDate) {
      newSalience = 'low';
    } else {
      newSalience = 'medium';
    }
    if (newSalience !== file.data.salience) {
      const updated = { ...file.data, salience: newSalience };
      writeMemoryFile(file.path, updated, file.body);
    }
  }
}

function updateLastAccessed(retrievedRelPaths) {
  const today = todayUTC();
  for (const relPath of retrievedRelPaths) {
    const filePath = join(MEMORY_DIR, relPath);
    if (!existsSync(filePath)) continue;
    const file = readMemoryFile(filePath);
    const updated = { ...file.data, 'last-accessed': today };
    writeMemoryFile(filePath, updated, file.body);
  }
}

// Phase 4: Atomically rebuild both MEMORY.md and .index.json.
function phase4() {
  const allFiles = scanAllMemoryFiles();

  // Rebuild MEMORY.md
  const mdContent = buildMemoryIndex(allFiles);
  writeFileSync(MEMORY_TMP, mdContent, 'utf-8');
  renameSync(MEMORY_TMP, MEMORY_MD);
  console.error('[consolidation] MEMORY.md rebuilt');

  // Rebuild .index.json
  writeIndexJson(allFiles);
  console.error('[consolidation] .index.json rebuilt');
}

// Main entry point
async function main() {
  // Handle crash recovery: clean up stale tmp files
  if (existsSync(MEMORY_TMP)) {
    unlinkSync(MEMORY_TMP);
    console.error('[consolidation] Deleted stale MEMORY.md.tmp from previous crash');
  }
  const { INDEX_TMP } = await import('./memory-utils.mjs');
  if (existsSync(INDEX_TMP)) {
    unlinkSync(INDEX_TMP);
    console.error('[consolidation] Deleted stale .index.json.tmp from previous crash');
  }

  // Read session tag set written by retrieval hook at session start.
  let sessionTagSet = new Set();
  let retrievedPaths = [];
  try {
    if (existsSync(SESSION_TAGS_FILE)) {
      const sessionData = JSON.parse(readFileSync(SESSION_TAGS_FILE, 'utf-8'));
      if (Array.isArray(sessionData)) {
        sessionData.forEach(t => sessionTagSet.add(t.toLowerCase()));
      } else {
        (sessionData.tags || []).forEach(t => sessionTagSet.add(t.toLowerCase()));
        retrievedPaths = sessionData.retrievedPaths || [];
      }
      unlinkSync(SESSION_TAGS_FILE);
    }
  } catch {}

  // Get new/modified episodic files (created today or yesterday)
  const today = todayUTC();
  const yesterday = new Date(today + 'T00:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const episodicDir = join(MEMORY_DIR, 'episodic');
  const recentEpisodic = [];
  if (existsSync(episodicDir)) {
    for (const f of readdirSync(episodicDir)) {
      if (!f.endsWith('.md')) continue;
      const file = readMemoryFile(join(episodicDir, f));
      const created = file.data.created || '';
      if (created >= yesterdayStr) recentEpisodic.push(file);
    }
  }

  console.error(`[consolidation] Phase 1: absorbing ${recentEpisodic.length} recent episodic files`);
  phase1(recentEpisodic);

  console.error('[consolidation] Phase 2: decay pass');
  phase2();

  console.error('[consolidation] Phase 3: salience update');
  phase3(sessionTagSet);
  updateLastAccessed(retrievedPaths);

  console.error('[consolidation] Phase 4: rebuilding indexes');
  phase4();

  console.error('[consolidation] Done');
}

main().catch(err => {
  console.error('[consolidation] Error:', err.message);
  process.exit(1);
});
