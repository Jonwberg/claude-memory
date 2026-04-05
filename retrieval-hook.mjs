// retrieval-hook.mjs
// UserPromptSubmit hook — scores .index.json entries against cue, injects top-N memory files.
// Called by Claude Code on every user prompt submission.
// Input: JSON on stdin with { prompt, session_id }
// Output: JSON to stdout with { additionalContext }

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  MEMORY_DIR, INDEX_JSON, SESSION_TAGS_FILE, MEMORY_CONTEXT_BUDGET_TOKENS,
  readIndexJson, parseMemoryIndex, readMemoryFile, tagOverlap, todayUTC
} from './memory-utils.mjs';

const CORRECTION_PATTERNS = [
  /\bthat('s| is| was)?\s+(wrong|incorrect|not right|off|bad)\b/i,
  /\bno[,.]?\s+(that|this|it)\b/i,
  /\bthat didn'?t work\b/i,
  /\bactually[,\s]/i,
  /\bnot quite\b/i,
  /\bwrong approach\b/i,
  /\btry\s+(a\s+)?different\b/i,
  /\bthat'?s\s+not\s+what\b/i,
  /\byou\s+(got|have)\s+it\s+wrong\b/i,
];

const APPROVAL_PATTERNS = [
  /\b(perfect|excellent|exactly right|that'?s\s+(right|correct|it|perfect))\b/i,
  /\bthat worked\b/i,
  /\bwell done\b/i,
  /\bgreat[,.]?\s+(yes|job|work|thanks)\b/i,
  /\byes[,!]\s+(exactly|perfect|correct|that'?s\s+it)\b/i,
];

function detectSignal(prompt) {
  if (CORRECTION_PATTERNS.some(p => p.test(prompt))) return 'correction';
  if (APPROVAL_PATTERNS.some(p => p.test(prompt))) return 'approval';
  return null;
}

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','through','during','is','are','was','were','be',
  'been','being','have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','need','dare','ought','used','let',
  'it','its','this','that','these','those','i','you','he','she','we','they',
  'me','him','her','us','them','my','your','his','our','their','what','which',
  'who','whom','how','when','where','why','all','each','every','both','few',
  "let's","i'm","we're","it's","don't","doesn't","won't","can't"
]);

export function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/['".,!?;:()\[\]{}\/\\]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function scoreEntry(entry, keywords, salience, isRecentEpisodic) {
  const SALIENCE_WEIGHT = { high: 3, medium: 2, low: 1 };
  const tagScore = tagOverlap(entry.tags, keywords);
  // trigger matches count double — they are high-signal symptom keywords
  const triggerScore = tagOverlap(entry.trigger || [], keywords) * 2;
  const totalOverlap = tagScore + triggerScore;
  if (totalOverlap === 0 && !isRecentEpisodic) return 0;
  const weight = SALIENCE_WEIGHT[salience] ?? 2;
  const recency = isRecentEpisodic ? 1 : 0;
  return (totalOverlap * weight) + recency;
}

export function selectTopN(scoredEntries, n) {
  return scoredEntries
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// Build index entries from .index.json (primary) or MEMORY.md (fallback).
function loadIndexEntries() {
  const jsonEntries = readIndexJson();
  if (jsonEntries) {
    // Normalize to the shape retrieval expects
    return jsonEntries.map(e => ({
      relPath: e.path,
      tags: e.tags || [],
      summary: e.summary || '',
      section: e.type || 'semantic',
      salience: e.salience || 'medium',
      created: e.created || '',
      status: e.status || 'confirmed',
    }));
  }
  // Fallback: parse MEMORY.md (v2.0 compat)
  return parseMemoryIndex();
}

async function main() {
  // Read input from stdin
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const { prompt = '' } = JSON.parse(input || '{}');

  // Handle missing index — fallback to empty
  if (!existsSync(INDEX_JSON)) {
    const { MEMORY_MD } = await import('./memory-utils.mjs');
    if (!existsSync(MEMORY_MD)) {
      process.stdout.write(JSON.stringify({ additionalContext: '' }));
      return;
    }
  }

  const keywords = extractKeywords(prompt);
  const today = todayUTC();
  const sevenDaysAgo = new Date(today + 'T00:00:00Z');
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysCutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const indexEntries = loadIndexEntries();
  const sessionTagSet = new Set();
  const scored = [];

  for (const entry of indexEntries) {
    // Skip superseded entries
    if (entry.status === 'superseded') continue;

    const filePath = join(MEMORY_DIR, entry.relPath);
    if (!existsSync(filePath)) continue;

    // Use salience from index (already read from file during index build)
    // Fall back to reading file only if salience missing from index
    const salience = entry.salience || (() => {
      const { data } = readMemoryFile(filePath);
      return data.salience || 'medium';
    })();

    const created = entry.created || '';
    const isEpisodic = entry.section === 'episodic';
    const isRecentEpisodic = isEpisodic && created >= sevenDaysCutoff;

    const score = scoreEntry(entry, keywords, salience, isRecentEpisodic);
    if (score > 0) {
      entry.tags.forEach(t => sessionTagSet.add(t));
      scored.push({ ...entry, score, filePath });
    }
  }

  // Fallback: no matches → load all semantic/high
  let toLoad = [];
  if (scored.length === 0) {
    for (const entry of indexEntries) {
      if (entry.section !== 'semantic') continue;
      if (entry.status === 'superseded') continue;
      const filePath = join(MEMORY_DIR, entry.relPath);
      if (!existsSync(filePath)) continue;
      if (entry.salience === 'high') toLoad.push({ ...entry, filePath, score: 0 });
    }
  } else {
    toLoad = selectTopN(scored, 5);
  }

  // Budget check: drop lowest-scoring if over budget (rough estimate: 1 token ≈ 4 chars)
  let totalChars = 0;
  const budget = MEMORY_CONTEXT_BUDGET_TOKENS * 4;
  const finalLoad = [];
  for (const entry of toLoad) {
    const content = readFileSync(entry.filePath, 'utf-8');
    if (totalChars + content.length > budget && finalLoad.length >= 1) continue;
    finalLoad.push({ ...entry, content });
    totalChars += content.length;
  }

  // Related expansion (one hop, outbound, counts against budget)
  const loadedPaths = new Set(finalLoad.map(e => e.relPath));
  const primaryEntries = [...finalLoad];
  for (const entry of primaryEntries) {
    const filePath = join(MEMORY_DIR, entry.relPath);
    const { data } = readMemoryFile(filePath);
    const related = data.related || [];
    for (const relPath of related) {
      if (loadedPaths.has(relPath)) continue;
      const absPath = join(MEMORY_DIR, relPath);
      if (!existsSync(absPath)) continue;
      const content = readFileSync(absPath, 'utf-8');
      if (totalChars + content.length > budget) continue;
      finalLoad.push({ relPath, content });
      loadedPaths.add(relPath);
      totalChars += content.length;
    }
  }

  // Build additionalContext
  if (finalLoad.length === 0) {
    process.stdout.write(JSON.stringify({ additionalContext: '' }));
    return;
  }

  const contextParts = [
    '<!-- Claude Memory 2.1: Relevant memory files loaded for this session -->',
  ];
  for (const entry of finalLoad) {
    contextParts.push(`\n### Memory: ${entry.relPath}\n\n${entry.content}`);
  }

  // Detect correction/approval signal in this prompt and attribute to loaded paths
  const signal = detectSignal(prompt);
  const loadedPaths = finalLoad.map(e => e.relPath);

  // Persist session data for consolidation hook — merge with existing if present
  try {
    let sessionData = { tags: [], retrievedPaths: [], corrections: [], approvals: [] };
    if (existsSync(SESSION_TAGS_FILE)) {
      try { sessionData = { ...sessionData, ...JSON.parse(readFileSync(SESSION_TAGS_FILE, 'utf-8')) }; } catch {}
    }
    // Merge tags
    for (const t of sessionTagSet) sessionData.tags.push(t);
    sessionData.tags = [...new Set(sessionData.tags)];
    // Merge retrieved paths
    sessionData.retrievedPaths = [...new Set([...sessionData.retrievedPaths, ...loadedPaths])];
    // Append signal if detected
    if (signal === 'correction' && loadedPaths.length > 0) {
      sessionData.corrections.push({ paths: loadedPaths, prompt: prompt.slice(0, 120) });
    } else if (signal === 'approval' && loadedPaths.length > 0) {
      sessionData.approvals.push({ paths: loadedPaths, prompt: prompt.slice(0, 120) });
    }
    writeFileSync(SESSION_TAGS_FILE, JSON.stringify(sessionData), 'utf-8');
  } catch (err) {
    process.stderr.write('retrieval-hook: failed to write session tags: ' + err.message + '\n');
  }

  process.stdout.write(JSON.stringify({
    additionalContext: contextParts.join('\n')
  }));
}

main().catch(err => {
  process.stderr.write('retrieval-hook error: ' + err.message + '\n');
  process.stdout.write(JSON.stringify({ additionalContext: '' }));
});
