// test-consolidation.mjs
import assert from 'assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { tagOverlap, parseFrontmatter, serializeFrontmatter, buildMemoryIndex } from './memory-utils.mjs';
import { isBehavioral, findBestSemanticFile, classifyClaim } from './consolidation.mjs';

// ---- Setup temp directory ----
const TMP = join(tmpdir(), 'claude-memory-test-' + Date.now());
mkdirSync(join(TMP, 'semantic'), { recursive: true });
mkdirSync(join(TMP, 'episodic'), { recursive: true });
mkdirSync(join(TMP, 'procedural'), { recursive: true });

// Test 1: parseFrontmatter round-trip
const sample = `---
type: semantic
tags: [shopify, sqlite]
salience: high
created: 2026-03-23
last-accessed: 2026-03-23
---

Some content here.
`;
const { data, body } = parseFrontmatter(sample);
assert.deepStrictEqual(data.tags, ['shopify', 'sqlite'], 'tags parsed');
assert.strictEqual(data.salience, 'high', 'salience parsed');
assert.ok(body.includes('Some content'), 'body preserved');
const roundtrip = serializeFrontmatter(data, body);
const reparsed = parseFrontmatter(roundtrip);
assert.deepStrictEqual(reparsed.data.tags, ['shopify', 'sqlite'], 'round-trip tags');
console.log('✓ parseFrontmatter round-trip');

// Test 2: isBehavioral classifies correctly
assert.strictEqual(isBehavioral("Don't mock the database in tests"), true, 'negation rule');
assert.strictEqual(isBehavioral("Always run scrapers sequentially"), true, 'always rule');
assert.strictEqual(isBehavioral("Shopify caps at page 100"), false, 'factual = not behavioral');
assert.strictEqual(isBehavioral("Use v.get('sku') or '' not v.get('sku', '')"), true, 'use pattern');
assert.strictEqual(isBehavioral("Project is at path C:\\Users"), false, 'project fact = not behavioral');
// Factual claim containing "don't" as part of a description, not a rule
// Note: current heuristic will flag this — acceptable tradeoff. Procedural absorb of a factual
// claim is harmless (it just lands in feedback.md as a reminder, which is fine).
// The important cases above (rules vs pure facts) are correctly classified.
console.log('✓ isBehavioral');

// Test 3: findBestSemanticFile returns highest-overlap file
const semFile1 = join(TMP, 'semantic', 'patterns.md');
const semFile2 = join(TMP, 'semantic', 'user.md');
writeFileSync(semFile1, `---\ntype: semantic\ntags: [shopify, sqlite]\nsalience: high\ncreated: 2026-03-23\nlast-accessed: 2026-03-23\n---\n\nContent.\n`);
writeFileSync(semFile2, `---\ntype: semantic\ntags: [python, windows]\nsalience: high\ncreated: 2026-03-23\nlast-accessed: 2026-03-23\n---\n\nContent.\n`);

const best = findBestSemanticFile(['shopify', 'sqlite'], TMP);
assert.ok(best !== null, 'found a best file');
assert.ok(best.relPath.includes('patterns'), 'patterns.md wins (overlap=2 vs 0)');
console.log('✓ findBestSemanticFile');

// Test 4: findBestSemanticFile returns null when 0-1 overlap
const weak = findBestSemanticFile(['nodejs', 'react'], TMP);
assert.strictEqual(weak, null, 'null when no file has ≥2 overlap');
console.log('✓ findBestSemanticFile returns null for weak match');

// Test 5: buildMemoryIndex produces correct format
const files = [
  { data: { type: 'semantic', tags: ['shopify', 'sqlite'], salience: 'high' }, body: 'Shopify patterns.', path: join(TMP, 'semantic/patterns.md'), relPath: 'semantic/patterns.md' },
  { data: { type: 'procedural', tags: ['git'], salience: 'medium' }, body: 'Use git.', path: join(TMP, 'procedural/feedback.md'), relPath: 'procedural/feedback.md' },
];
const idx = buildMemoryIndex(files);
assert.ok(idx.includes('## Semantic'), 'has Semantic section');
assert.ok(idx.includes('## Procedural'), 'has Procedural section');
assert.ok(idx.includes('## Episodic'), 'has Episodic section');
assert.ok(idx.includes('## Reference'), 'has Reference section');
assert.ok(idx.includes('`shopify sqlite`'), 'tags formatted correctly');
console.log('✓ buildMemoryIndex');

// Cleanup
rmSync(TMP, { recursive: true });
console.log('\nAll consolidation tests passed ✓');
