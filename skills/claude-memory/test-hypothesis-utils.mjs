// test-hypothesis-utils.mjs
import assert from 'assert';
import { readConfig, checkCommandSafety } from './hypothesis-utils.mjs';

// Test 1: checkCommandSafety
const config = readConfig();
assert.strictEqual(checkCommandSafety('rm -rf /tmp', config).safe, false, 'rm -rf is blocked');
assert.strictEqual(checkCommandSafety('ls /tmp', config).safe, true, 'ls is safe');
assert.strictEqual(checkCommandSafety('git push --force', config).safe, false, 'force push blocked');
assert.strictEqual(checkCommandSafety('node script.mjs', config).safe, true, 'node is safe');
console.log('✓ checkCommandSafety');

// Test 2: readConfig returns all required fields
assert.ok(typeof config.max_depth === 'number', 'max_depth is number');
assert.ok(typeof config.max_tree_width === 'number', 'max_tree_width is number');
assert.ok(Array.isArray(config.blocked_commands), 'blocked_commands is array');
assert.ok(Array.isArray(config.require_approval_patterns), 'patterns is array');
assert.ok(typeof config.synthesizer_model === 'string', 'synthesizer_model is string');
console.log('✓ readConfig');

console.log('\nAll hypothesis-utils tests passed ✓');
