// error-capture-hook.mjs
// PostToolUse hook — fires after every Bash tool call.
// Detects error patterns in output and appends to session-errors.json.
// Consolidation reads this file at session end to classify outcome and
// create draft Solution entries.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { MEMORY_DIR, SESSION_ERRORS_FILE, todayUTC } from './memory-utils.mjs';

// Error signals — any match means this bash call failed in a meaningful way.
const ERROR_PATTERNS = [
  /\bError:/,
  /\berror:/i,
  /\bERROR\b/,
  /\bTraceback \(most recent call last\)/,
  /\bSyntaxError\b/,
  /\bModuleNotFoundError\b/,
  /\bImportError\b/,
  /\bAttributeError\b/,
  /\bTypeError\b/,
  /\bValueError\b/,
  /\bFileNotFoundError\b/,
  /\bPermissionError\b/,
  /\bENOENT\b/,
  /\bEACCES\b/,
  /\bEPERM\b/,
  /\bcommand not found\b/i,
  /\bnot found\b.*\bcommand\b/i,
  /\bNo such file or directory\b/,
  /\bfailed with exit code [^0]/i,
  /\bnpm ERR!\b/,
  /\bCannot find module\b/,
  /\bfatal:\s/i,
  /\bcould not\b.*\b(find|load|open|read)\b/i,
];

// Noise — errors we don't want to capture (transient, non-informative)
const NOISE_PATTERNS = [
  /^warning:/i,
  /^npm warn/i,
  /^hint:/i,
  /DeprecationWarning/,
];

function isSignificantError(output) {
  if (!output || typeof output !== 'string') return false;
  const lines = output.split('\n');
  // Must match at least one error pattern and NOT be all noise
  const hasError = ERROR_PATTERNS.some(p => p.test(output));
  if (!hasError) return false;
  const significantLines = lines.filter(l => l.trim() && !NOISE_PATTERNS.some(p => p.test(l)));
  return significantLines.length > 0;
}

function extractErrorSnippet(output) {
  // Return first ~200 chars of error-looking lines
  const lines = output.split('\n').filter(l => l.trim());
  const errorStart = lines.findIndex(l => ERROR_PATTERNS.some(p => p.test(l)));
  const start = errorStart >= 0 ? errorStart : 0;
  return lines.slice(start, start + 5).join('\n').slice(0, 300);
}

function extractKeywordsFromError(command, snippet) {
  // Pull meaningful tokens from command + error for tagging
  const combined = (command + ' ' + snippet).toLowerCase();
  const STOP = new Set(['the','a','an','is','in','at','to','for','of','and','or','not','with','from','that','this','it']);
  const tokens = combined
    .replace(/[^a-z0-9\-_/\.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  // Dedupe and take top 6
  return [...new Set(tokens)].slice(0, 6);
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let parsed;
  try {
    parsed = JSON.parse(input || '{}');
  } catch {
    process.exit(0); // non-JSON input — skip silently
  }

  // Support both flat and nested tool_response formats
  const toolName = parsed.tool_name || '';
  if (toolName !== 'Bash') process.exit(0);

  const command = parsed.tool_input?.command || '';
  const rawResponse = parsed.tool_response;
  const output = typeof rawResponse === 'string'
    ? rawResponse
    : (rawResponse?.output || rawResponse?.stderr || '');

  if (!isSignificantError(output)) process.exit(0);

  const snippet = extractErrorSnippet(output);
  const tags = extractKeywordsFromError(command, snippet);

  // Read or initialise session-errors.json
  let sessionErrors = { errors: [] };
  try {
    if (existsSync(SESSION_ERRORS_FILE)) {
      sessionErrors = JSON.parse(readFileSync(SESSION_ERRORS_FILE, 'utf-8'));
    }
  } catch {}

  // Dedup: don't append the same error twice
  const alreadyLogged = sessionErrors.errors.some(e =>
    e.snippet && snippet && e.snippet.slice(0, 60) === snippet.slice(0, 60)
  );
  if (!alreadyLogged) {
    sessionErrors.errors.push({
      command: command.slice(0, 200),
      snippet,
      tags,
      timestamp: new Date().toISOString(),
    });
    writeFileSync(SESSION_ERRORS_FILE, JSON.stringify(sessionErrors, null, 2), 'utf-8');
    process.stderr.write(`[error-capture] Logged error: ${snippet.split('\n')[0].slice(0, 80)}\n`);
  }

  process.exit(0);
}

main().catch(err => {
  process.stderr.write('[error-capture] Hook error: ' + err.message + '\n');
  process.exit(0); // never block Claude
});
