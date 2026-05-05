// retrieval-hook.mjs v3
// UserPromptSubmit hook — queries Pinecone for semantic memory retrieval.
// Input: JSON on stdin with { prompt, session_id }
// Output: JSON to stdout with { additionalContext }

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_HOST = 'https://claude-memory-hr7dpkh.svc.aped-4627-b74a.pinecone.io';
const PINECONE_NAMESPACE = 'memories';
const TOP_K = 5;
const MIN_SCORE = 0.35;

const MEMORY_DIR = join(homedir(), '.claude', 'projects', 'C--Users-Jon-Berg', 'memory');
const SESSION_TAGS_FILE = join(MEMORY_DIR, 'session-tags.json');

const CORRECTION_PATTERNS = [
  /\bthat('s| is| was)?\s+(wrong|incorrect|not right|off|bad)\b/i,
  /\bno[,.]?\s+(that|this|it)\b/i,
  /\bthat didn'?t work\b/i,
  /\bactually[,\s]/i,
  /\bnot quite\b/i,
  /\bwrong approach\b/i,
  /\bthat'?s\s+not\s+what\b/i,
];

const APPROVAL_PATTERNS = [
  /\b(perfect|excellent|exactly right|that'?s\s+(right|correct|it|perfect))\b/i,
  /\bthat worked\b/i,
  /\byes[,!]\s+(exactly|perfect|correct|that'?s\s+it)\b/i,
  /\bwell done\b/i,
];

export function detectSignal(prompt) {
  if (CORRECTION_PATTERNS.some(p => p.test(prompt))) return 'correction';
  if (APPROVAL_PATTERNS.some(p => p.test(prompt))) return 'approval';
  return null;
}

async function searchPinecone(queryText) {
  let response;
  try {
    response = await fetch(
      `${PINECONE_HOST}/records/namespaces/${PINECONE_NAMESPACE}/search`,
      {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2025-04',
        },
        body: JSON.stringify({
          query: {
            inputs: { text: queryText },
            top_k: TOP_K,
            filter: { confidence: { '$ne': 'low' } },
          },
          fields: ['text', 'type', 'domain', 'project', 'salience', 'confidence'],
        }),
        signal: AbortSignal.timeout(5000),
      }
    );
  } catch (err) {
    process.stderr.write(`retrieval-hook: Pinecone fetch failed: ${err.message}\n`);
    return [];
  }

  if (!response.ok) {
    const err = await response.text();
    process.stderr.write(`retrieval-hook: Pinecone error ${response.status}: ${err}\n`);
    return [];
  }

  const data = await response.json();
  return (data.result?.hits || []).filter(h => h._score >= MIN_SCORE);
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const { prompt = '' } = JSON.parse(input || '{}');

  if (!PINECONE_API_KEY) {
    process.stderr.write('retrieval-hook: PINECONE_API_KEY not set\n');
    process.stdout.write(JSON.stringify({ additionalContext: '' }));
    return;
  }

  const hits = await searchPinecone(prompt);
  const hitIds = hits.map(h => h._id);

  // Persist session data for consolidation hook
  try {
    let sessionData = { retrievedIds: [], retrievedRecords: {}, corrections: [], approvals: [] };
    if (existsSync(SESSION_TAGS_FILE)) {
      try {
        sessionData = { ...sessionData, ...JSON.parse(readFileSync(SESSION_TAGS_FILE, 'utf-8')) };
      } catch {}
    }
    sessionData.retrievedIds = [...new Set([...sessionData.retrievedIds, ...hitIds])];
    // Store full record fields so consolidation can re-upsert without a fetch round-trip
    for (const hit of hits) {
      sessionData.retrievedRecords[hit._id] = { ...hit.fields, id: hit._id };
    }
    const signal = detectSignal(prompt);
    if (signal === 'correction' && hitIds.length > 0) {
      sessionData.corrections.push({ ids: hitIds, prompt: prompt.slice(0, 120) });
    } else if (signal === 'approval' && hitIds.length > 0) {
      sessionData.approvals.push({ ids: hitIds, prompt: prompt.slice(0, 120) });
    }
    writeFileSync(SESSION_TAGS_FILE, JSON.stringify(sessionData), 'utf-8');
  } catch (err) {
    process.stderr.write('retrieval-hook: failed to write session data: ' + err.message + '\n');
  }

  if (hits.length === 0) {
    process.stdout.write(JSON.stringify({ additionalContext: '' }));
    return;
  }

  const contextParts = ['<!-- Claude Memory V3: Retrieved from Pinecone -->'];
  for (const hit of hits) {
    const f = hit.fields || {};
    const meta = [f.type, f.domain, f.project].filter(Boolean).join(' / ');
    contextParts.push(
      `\n### [${hit._id}] (score: ${hit._score.toFixed(2)}, ${meta})\n\n${f.text || ''}`
    );
  }

  process.stdout.write(JSON.stringify({
    additionalContext: contextParts.join('\n'),
  }));
}

// Only run main() when this file is executed directly (as the hook), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    process.stderr.write('retrieval-hook error: ' + err.message + '\n');
    process.stdout.write(JSON.stringify({ additionalContext: '' }));
  });
}
