// consolidation.mjs v3
// Stop hook — consolidates episodic notes into semantic/procedural layers,
// and upserts new learnings to Pinecone.
// Runs after each session via the Stop hook in settings.json.
// No stdin input required; reads memory directory directly.

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_HOST = 'https://claude-memory-hr7dpkh.svc.aped-4627-b74a.pinecone.io';
const PINECONE_NAMESPACE = 'memories';

// Upsert newly extracted claims to Pinecone so they're retrievable next session.
async function upsertClaimsToPinecone(claims) {
  if (!PINECONE_API_KEY || claims.length === 0) return;
  const records = claims.map(c => ({
    _id: `learned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: c.text,
    type: c.type,
    domain: c.domain || 'general',
    project: c.project || 'all',
    salience: c.salience || 'medium',
    confidence: c.confidence || 'medium',
  }));

  try {
    const response = await fetch(
      `${PINECONE_HOST}/records/namespaces/${PINECONE_NAMESPACE}/upsert`,
      {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/x-ndjson',
          'X-Pinecone-API-Version': '2025-04',
        },
        body: records.map(r => JSON.stringify(r)).join('\n'),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      console.error(`[consolidation] Pinecone upsert error: status=${response.status} body=${err || '(empty)'}`);
    } else {
      console.error(`[consolidation] Upserted ${records.length} new claim(s) to Pinecone`);
    }
  } catch (err) {
    console.error(`[consolidation] Pinecone upsert failed: ${err.message}`);
  }
}

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, renameSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import {
  MEMORY_DIR, MEMORY_MD, MEMORY_TMP, INDEX_JSON, INDEX_TMP,
  SESSION_TAGS_FILE, SESSION_ERRORS_FILE,
  readMemoryFile, writeMemoryFile, scanAllMemoryFiles,
  tagOverlap, todayUTC, addDays, isExpired, buildMemoryIndex, writeIndexJson
} from './memory-utils.mjs';

// Track claims extracted this session for Pinecone upsert
const newClaims = [];

// Track Pinecone records whose confidence needs updating (Reflexion loop)
const pineconeConfidenceUpdates = {};

// --- Session outcome classification ---

// Returns 'blocked_resolved' | 'blocked_unresolved' | 'exploratory' | 'routine'
function classifySessionOutcome(sessionErrors, sessionTagSet) {
  const hasErrors = sessionErrors.errors && sessionErrors.errors.length > 0;
  if (hasErrors) {
    // If the Stop hook ran, the session completed — assume errors were resolved
    return 'blocked_resolved';
  }
  // No errors: classify by topic breadth
  const uniqueTags = sessionTagSet.size;
  return uniqueTags >= 4 ? 'exploratory' : 'routine';
}

// Claim extraction threshold per session outcome.
// Higher = more conservative (only save strong claims).
// Lower = more aggressive (save everything).
const OUTCOME_THRESHOLD = {
  blocked_resolved: 0,    // save all — this session learned something
  exploratory:      1,    // save medium+ (default)
  routine:          2,    // save only high-confidence-looking claims
  blocked_unresolved: Infinity, // skip extraction entirely
};

// --- Confidence update helpers ---

const CONFIDENCE_ORDER = ['low', 'medium', 'high'];

function demoteConfidence(current) {
  const idx = CONFIDENCE_ORDER.indexOf(current);
  return CONFIDENCE_ORDER[Math.max(0, idx - 1)];
}

function promoteConfidence(current) {
  const idx = CONFIDENCE_ORDER.indexOf(current);
  return CONFIDENCE_ORDER[Math.min(CONFIDENCE_ORDER.length - 1, idx + 1)];
}

// Apply correction signals: demote confidence of affected files and Pinecone records.
function applyCorrections(corrections, retrievedRecords = {}) {
  if (!corrections || corrections.length === 0) return;
  for (const signal of corrections) {
    // File-based (legacy paths)
    for (const relPath of signal.paths || []) {
      const filePath = join(MEMORY_DIR, relPath);
      if (!existsSync(filePath)) continue;
      const file = readMemoryFile(filePath);
      const current = file.data.confidence || 'medium';
      const demoted = demoteConfidence(current);
      if (demoted !== current) {
        writeMemoryFile(filePath, { ...file.data, confidence: demoted }, file.body);
        console.error(`[consolidation] Correction: demoted file ${relPath} ${current} → ${demoted}`);
      }
    }
    // Pinecone records (V3 ids)
    for (const id of signal.ids || []) {
      const record = retrievedRecords[id];
      if (!record) continue;
      const current = record.confidence || 'medium';
      const demoted = demoteConfidence(current);
      if (demoted !== current) {
        pineconeConfidenceUpdates[id] = { ...record, confidence: demoted };
        console.error(`[consolidation] Correction: queued Pinecone demote ${id} ${current} → ${demoted}`);
      }
    }
  }
}

// Apply approval signals: promote confidence of affected files and Pinecone records.
function applyApprovals(approvals, retrievedRecords = {}) {
  if (!approvals || approvals.length === 0) return;
  for (const signal of approvals) {
    // File-based (legacy paths)
    for (const relPath of signal.paths || []) {
      const filePath = join(MEMORY_DIR, relPath);
      if (!existsSync(filePath)) continue;
      const file = readMemoryFile(filePath);
      const current = file.data.confidence || 'medium';
      const promoted = promoteConfidence(current);
      if (promoted !== current) {
        writeMemoryFile(filePath, { ...file.data, confidence: promoted }, file.body);
        console.error(`[consolidation] Approval: promoted file ${relPath} ${current} → ${promoted}`);
      }
    }
    // Pinecone records (V3 ids)
    for (const id of signal.ids || []) {
      const record = retrievedRecords[id];
      if (!record) continue;
      const current = record.confidence || 'medium';
      const promoted = promoteConfidence(current);
      if (promoted !== current) {
        pineconeConfidenceUpdates[id] = { ...record, confidence: promoted };
        console.error(`[consolidation] Approval: queued Pinecone promote ${id} ${current} → ${promoted}`);
      }
    }
  }
}

// Flush all queued Pinecone confidence updates as a single upsert batch.
async function flushPineconeConfidenceUpdates() {
  const records = Object.entries(pineconeConfidenceUpdates).map(([id, fields]) => ({
    _id: id,
    text: fields.text,
    type: fields.type || 'feedback',
    domain: fields.domain || 'general',
    project: fields.project || 'all',
    salience: fields.salience || 'medium',
    confidence: fields.confidence,
  }));
  if (records.length === 0 || !PINECONE_API_KEY) return;
  try {
    const response = await fetch(
      `${PINECONE_HOST}/records/namespaces/${PINECONE_NAMESPACE}/upsert`,
      {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/x-ndjson',
          'X-Pinecone-API-Version': '2025-04',
        },
        body: records.map(r => JSON.stringify(r)).join('\n'),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      console.error(`[consolidation] Reflexion upsert error: status=${response.status} body=${err || '(empty)'}`);
    } else {
      console.error(`[consolidation] Reflexion: updated confidence for ${records.length} Pinecone record(s)`);
    }
  } catch (err) {
    console.error(`[consolidation] Reflexion upsert failed: ${err.message}`);
  }
}

// Write a draft episodic file for unresolved errors so they surface next session.
function writeDraftErrorEpisodic(sessionErrors) {
  const episodicDir = join(MEMORY_DIR, 'episodic');
  mkdirSync(episodicDir, { recursive: true });
  const today = todayUTC();
  const slug = 'error-unresolved';
  const filePath = join(episodicDir, `${today}-${slug}.md`);
  if (existsSync(filePath)) return; // don't overwrite existing draft
  const errorSummary = sessionErrors.errors
    .map(e => `- \`${e.command.slice(0, 80)}\`: ${e.snippet.split('\n')[0].slice(0, 100)}`)
    .join('\n');
  const tags = [...new Set(sessionErrors.errors.flatMap(e => e.tags || []))].slice(0, 6);
  writeMemoryFile(filePath, {
    type: 'episodic',
    tags: tags.length ? tags : ['error', 'unresolved'],
    salience: 'medium',
    confidence: 'low',
    source: 'observed',
    status: 'open',
    retention: 'temporary',
    created: today,
    'last-accessed': today,
    'decay-after': addDays(today, 14), // shorter decay — resolve or discard quickly
  }, `## Unresolved errors from session ${today}\n\n${errorSummary}\n\nReview and create Solution entries if patterns emerge.`);
  console.error(`[consolidation] Wrote unresolved error episodic: ${filePath}`);
}

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

// Auto-generated by wip-checkpoint.mjs; not semantic content.
// Format: "HH:MM (Write|Edit): `path` — content"
const ACTIVITY_LOG_LINE = /^\d{1,2}:\d{2}\s+(Write|Edit):/;

// Extract individual claims from episodic file body at sentence level (claim-aware).
// Filters out wip-checkpoint activity-log lines so they don't pollute Pinecone with
// huge concatenated paragraphs that exceed the embedding model's token budget.
// Falls back to line splitting if sentence extraction yields nothing useful.
export function extractClaims(body) {
  const claims = [];

  for (const paragraph of body.split(/\n{2,}/)) {
    // Strip list/blockquote markers but keep heading markers visible so we can filter them.
    const stripped = paragraph.replace(/^[-*>]\s+/gm, '').trim();
    if (!stripped) continue;

    const proseLines = stripped
      .split('\n')
      .filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (/^#+\s/.test(t)) return false;          // markdown heading
        if (ACTIVITY_LOG_LINE.test(t)) return false; // wip-checkpoint output
        return true;
      })
      .join('\n')
      .trim();
    if (!proseLines) continue;

    // Sentence-level split: split on ". ", "! ", "? " followed by capital letter,
    // or end of string. Preserves the sentence terminator.
    const sentences = proseLines
      .split(/(?<=[.!?])\s+(?=[A-Z`"'])/)
      .map(s => s.trim())
      .filter(s => s.length > 15);

    if (sentences.length > 0) {
      claims.push(...sentences);
    } else if (proseLines.length > 15) {
      claims.push(proseLines);
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
// threshold controls minimum claim length — higher = more conservative extraction.
function phase1(episodicFiles, threshold = 1) {
  if (threshold === Infinity) {
    console.error('[consolidation] Phase 1: skipping (blocked_unresolved session)');
    return;
  }
  const minLength = threshold === 0 ? 10 : threshold === 1 ? 15 : 30;
  for (const epFile of episodicFiles) {
    const claims = extractClaims(epFile.body).filter(c => c.length >= minLength);
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
  newClaims.push({ text: claim, type: 'feedback', domain: 'general', project: 'all' });
}

function absorbToSemantic(claim, episodicTags) {
  const best = findBestSemanticFile(episodicTags);
  if (best) {
    if (isDuplicate(claim, best.body)) return;
    const newBody = best.body.trimEnd() + '\n\n' + claim;
    writeMemoryFile(best.path, best.data, newBody);
  } else {
    const today = todayUTC();
    const slug = episodicTags.slice(0, 3).join('-') || 'misc';
    const newPath = join(MEMORY_DIR, 'semantic', `${slug}.md`);
    if (existsSync(newPath)) {
      const existing = readMemoryFile(newPath);
      if (isDuplicate(claim, existing.body)) return;
      writeMemoryFile(newPath, existing.data, existing.body.trimEnd() + '\n\n' + claim);
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
  newClaims.push({ text: claim, type: 'semantic', domain: episodicTags[0] || 'general', project: 'all' });
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
    try {
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
    } catch (err) {
      console.error(`[consolidation] phase3: skipping ${file.relPath}: ${err.message}`);
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
// Each step is independent — a failure in one does not block Phase 5 (Pinecone upsert)
// or the other rebuild.
function phase4() {
  let allFiles;
  try {
    allFiles = scanAllMemoryFiles();
  } catch (err) {
    console.error(`[consolidation] phase4: scanAllMemoryFiles failed: ${err.stack || err.message}`);
    return;
  }

  try {
    const mdContent = buildMemoryIndex(allFiles);
    writeFileSync(MEMORY_TMP, mdContent, 'utf-8');
    renameSync(MEMORY_TMP, MEMORY_MD);
    console.error('[consolidation] MEMORY.md rebuilt');
  } catch (err) {
    console.error(`[consolidation] phase4: MEMORY.md rebuild failed: ${err.stack || err.message}`);
  }

  try {
    writeIndexJson(allFiles);
    console.error('[consolidation] .index.json rebuilt');
  } catch (err) {
    console.error(`[consolidation] phase4: .index.json rebuild failed: ${err.stack || err.message}`);
  }
}

// Main entry point
async function main() {
  // Handle crash recovery: clean up stale tmp files
  if (existsSync(MEMORY_TMP)) {
    unlinkSync(MEMORY_TMP);
    console.error('[consolidation] Deleted stale MEMORY.md.tmp from previous crash');
  }
  if (existsSync(INDEX_TMP)) {
    unlinkSync(INDEX_TMP);
    console.error('[consolidation] Deleted stale .index.json.tmp from previous crash');
  }

  // Read session tag set + correction/approval signals written by retrieval hook.
  let sessionTagSet = new Set();
  let retrievedPaths = [];
  let retrievedRecords = {};
  let corrections = [];
  let approvals = [];
  try {
    if (existsSync(SESSION_TAGS_FILE)) {
      const sessionData = JSON.parse(readFileSync(SESSION_TAGS_FILE, 'utf-8'));
      if (Array.isArray(sessionData)) {
        sessionData.forEach(t => sessionTagSet.add(t.toLowerCase()));
      } else {
        (sessionData.tags || []).forEach(t => sessionTagSet.add(t.toLowerCase()));
        retrievedPaths = sessionData.retrievedPaths || [];
        retrievedRecords = sessionData.retrievedRecords || {};
        corrections = sessionData.corrections || [];
        approvals = sessionData.approvals || [];
      }
      unlinkSync(SESSION_TAGS_FILE);
    }
  } catch (err) {
    console.error(`[consolidation] session-tags.json read failed: ${err.message}`);
    try { unlinkSync(SESSION_TAGS_FILE); } catch {}
  }

  // Read session errors written by error-capture hook.
  let sessionErrors = { errors: [] };
  try {
    if (existsSync(SESSION_ERRORS_FILE)) {
      sessionErrors = JSON.parse(readFileSync(SESSION_ERRORS_FILE, 'utf-8'));
      unlinkSync(SESSION_ERRORS_FILE);
    }
  } catch (err) {
    console.error(`[consolidation] session-errors.json read failed: ${err.message}`);
    try { unlinkSync(SESSION_ERRORS_FILE); } catch {}
  }

  // Classify session outcome.
  const outcome = classifySessionOutcome(sessionErrors, sessionTagSet);
  const threshold = OUTCOME_THRESHOLD[outcome] ?? 1;
  console.error(`[consolidation] Session outcome: ${outcome} (extraction threshold: ${threshold})`);

  // Apply correction/approval confidence signals (files + Pinecone).
  if (corrections.length > 0) {
    console.error(`[consolidation] Applying ${corrections.length} correction signal(s)`);
    applyCorrections(corrections, retrievedRecords);
  }
  if (approvals.length > 0) {
    console.error(`[consolidation] Applying ${approvals.length} approval signal(s)`);
    applyApprovals(approvals, retrievedRecords);
  }

  // For blocked_unresolved sessions: write a draft episodic for follow-up.
  if (outcome === 'blocked_unresolved' && sessionErrors.errors.length > 0) {
    writeDraftErrorEpisodic(sessionErrors);
  }

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

  // Tag episodic files with session outcome.
  for (const epFile of recentEpisodic) {
    const current = epFile.data['session-outcome'];
    if (!current) {
      writeMemoryFile(epFile.path, { ...epFile.data, 'session-outcome': outcome }, epFile.body);
    }
  }

  console.error(`[consolidation] Phase 1: absorbing ${recentEpisodic.length} recent episodic files (threshold=${threshold})`);
  phase1(recentEpisodic, threshold);

  console.error('[consolidation] Phase 2: decay pass');
  phase2();

  console.error('[consolidation] Phase 3: salience update');
  phase3(sessionTagSet);
  updateLastAccessed(retrievedPaths);

  console.error('[consolidation] Phase 4: rebuilding indexes');
  phase4();

  if (newClaims.length > 0) {
    console.error(`[consolidation] Phase 5: upserting ${newClaims.length} new claim(s) to Pinecone`);
    await upsertClaimsToPinecone(newClaims);
  }

  const reflexionCount = Object.keys(pineconeConfidenceUpdates).length;
  if (reflexionCount > 0) {
    console.error(`[consolidation] Reflexion: flushing ${reflexionCount} confidence update(s) to Pinecone`);
    await flushPineconeConfidenceUpdates();
  }

  console.error('[consolidation] Done');
}

// Only run main() when this file is executed directly (as the Stop hook), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('[consolidation] Fatal:', err.stack || err.message);
    process.exit(1);
  });
}
