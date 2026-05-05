// test-retrieval.mjs
// Tests for the live Pinecone-backed retrieval-hook (V3).
// Older V2 file-based scoring functions (scoreEntry/extractKeywords/selectTopN)
// no longer exist — those tests were retired with the V2 hook.
import assert from 'assert';
import { tagOverlap } from './memory-utils.mjs';
import { detectSignal } from './retrieval-hook.mjs';

// Test 1: tagOverlap counts correctly (case-insensitive token overlap)
assert.strictEqual(tagOverlap(['shopify', 'sqlite'], ['shopify', 'pagination']), 1, 'overlap=1');
assert.strictEqual(tagOverlap(['shopify', 'sqlite', 'pagination'], ['shopify', 'pagination']), 2, 'overlap=2');
assert.strictEqual(tagOverlap(['shopify'], ['python', 'windows']), 0, 'overlap=0');
assert.strictEqual(tagOverlap(['SHOPIFY'], ['shopify']), 1, 'case-insensitive');
console.log('✓ tagOverlap');

// Test 2: detectSignal — correction patterns
const correctionCases = [
  "that's wrong",
  "that didn't work",
  "no, that's not right",
  "actually, the answer is different",
  "wrong approach",
  "that's not what I meant",
  "not quite",
];
for (const prompt of correctionCases) {
  assert.strictEqual(detectSignal(prompt), 'correction', `expected correction for: "${prompt}"`);
}

// Test 3: detectSignal — approval patterns
const approvalCases = [
  "perfect",
  "that worked",
  "yes, exactly",
  "well done",
  "that's correct",
  "excellent",
];
for (const prompt of approvalCases) {
  assert.strictEqual(detectSignal(prompt), 'approval', `expected approval for: "${prompt}"`);
}

// Test 4: detectSignal — neutral prompts return null
const neutralCases = [
  "what's the time?",
  "open the file",
  "let me think about it",
  "show me the diff",
];
for (const prompt of neutralCases) {
  assert.strictEqual(detectSignal(prompt), null, `expected null for: "${prompt}"`);
}
console.log('✓ detectSignal');

console.log('\nAll retrieval tests passed ✓');
