// test-retrieval.mjs
import assert from 'assert';
import { tagOverlap, parseMemoryIndex } from './memory-utils.mjs';
import { scoreEntry, extractKeywords, selectTopN } from './retrieval-hook.mjs';

// Test 1: tagOverlap counts correctly
assert.strictEqual(tagOverlap(['shopify', 'sqlite'], ['shopify', 'pagination']), 1, 'overlap=1');
assert.strictEqual(tagOverlap(['shopify', 'sqlite', 'pagination'], ['shopify', 'pagination']), 2, 'overlap=2');
assert.strictEqual(tagOverlap(['shopify'], ['python', 'windows']), 0, 'overlap=0');
assert.strictEqual(tagOverlap(['SHOPIFY'], ['shopify']), 1, 'case-insensitive');
console.log('✓ tagOverlap');

// Test 2: extractKeywords strips stop words, returns canonical nouns
const kw = extractKeywords("let's work on the shopify scraper pagination issue today");
assert.ok(kw.includes('shopify'), 'has shopify');
assert.ok(kw.includes('pagination'), 'has pagination');
assert.ok(!kw.includes('the'), 'no stop word: the');
assert.ok(!kw.includes("let's"), "no stop word: let's");
console.log('✓ extractKeywords');

// Test 3: scoreEntry computes correctly
const entry = { relPath: 'semantic/patterns.md', tags: ['shopify', 'sqlite', 'pagination'], section: 'semantic' };
// salience comes from the actual file; we test with injected salience
const score = scoreEntry(entry, ['shopify', 'pagination'], 'high', false);
assert.strictEqual(score, (2 * 3) + 0, 'score = (2 overlap * 3 high) + 0 recency = 6');

const scoreRecent = scoreEntry(entry, ['shopify'], 'medium', true);
assert.strictEqual(scoreRecent, (1 * 2) + 1, 'score = (1 * 2) + 1 recency = 3');

const scoreNoMatch = scoreEntry(entry, ['python', 'windows'], 'high', false);
assert.strictEqual(scoreNoMatch, 0, 'no match = 0');
console.log('✓ scoreEntry');

// Test 4: selectTopN respects N=5 cap, returns only score>0 entries
const entries = [
  { score: 6, relPath: 'a.md' },
  { score: 3, relPath: 'b.md' },
  { score: 2, relPath: 'c.md' },
  { score: 1, relPath: 'd.md' },
  { score: 1, relPath: 'e.md' },
  { score: 1, relPath: 'f.md' },
];
const top = selectTopN(entries, 5);
assert.strictEqual(top.length, 5, 'returns exactly 5');
assert.strictEqual(top[0].relPath, 'a.md', 'highest first');
console.log('✓ selectTopN');

console.log('\nAll retrieval tests passed ✓');
