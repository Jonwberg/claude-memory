// experimenter.mjs
// Cron-triggered agent: picks one hypothesis, designs and runs a test via
// `claude -p`, writes raw results. Triggers synthesizer on completion.
// Never interprets results — only observes.

import { execSync, spawnSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  selectNextHypothesis, readHypothesis, writeHypothesis,
  updateHypothesisStatus, buildLineageSection,
  acquireLock, releaseLock, readConfig,
  logNeedsReview, updateQueueEntry
} from './hypothesis-utils.mjs';
import { SKILL_DIR, HYPOTHESES_DIR, todayUTC } from './memory-utils.mjs';

const SYNTHESIS_PENDING_FILE = join(HYPOTHESES_DIR, 'synthesis-pending.json');

async function main() {
  const config = readConfig();

  if (!acquireLock()) {
    console.error('[experimenter] Another process is running — exiting');
    process.exit(0);
  }

  try {
    const hypothesisId = selectNextHypothesis();
    if (!hypothesisId) {
      console.error('[experimenter] No proposed hypotheses in queue — nothing to do');
      return;
    }

    console.error(`[experimenter] Selected: ${hypothesisId}`);
    updateHypothesisStatus(hypothesisId, 'activated');
    updateQueueEntry(hypothesisId, { status: 'activated' });

    const hypothesis = readHypothesis(hypothesisId);
    const lineage = buildLineageSection(hypothesisId);
    const prompt = buildExperimenterPrompt(hypothesis, lineage, config);

    console.error(`[experimenter] Calling claude -p for ${hypothesisId}...`);
    const result = runClaudeP(prompt, config.experiment_timeout_ms);

    if (!result.success) {
      console.error(`[experimenter] claude -p failed: ${result.error}`);
      updateHypothesisStatus(hypothesisId, 'proposed');
      updateQueueEntry(hypothesisId, { status: 'proposed' });
      return;
    }

    let parsed;
    try {
      const cleaned = result.output
        .replace(/^```json\n?/, '').replace(/\n?```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error(`[experimenter] Could not parse claude -p output as JSON: ${e.message}`);
      parsed = {
        test_run: 'parse_failed',
        observations: [result.output.slice(0, 500)],
        raw_data: {},
        requires_human_approval: false,
        candidate_children: [],
      };
    }

    if (parsed.requires_human_approval) {
      updateHypothesisStatus(hypothesisId, 'blocked');
      updateQueueEntry(hypothesisId, { status: 'blocked' });
      logNeedsReview(hypothesisId, `Experiment requires human approval: ${parsed.test_run}`);
      console.error(`[experimenter] ${hypothesisId} blocked — requires human approval`);
      return;
    }

    writeRawResults(hypothesisId, parsed);
    updateHypothesisStatus(hypothesisId, 'testing');
    updateQueueEntry(hypothesisId, { status: 'testing' });

    writeFileSync(SYNTHESIS_PENDING_FILE, JSON.stringify({ id: hypothesisId, ts: Date.now() }), 'utf-8');
    console.error(`[experimenter] Results written for ${hypothesisId} — triggering synthesizer`);

    const synthResult = spawnSync('node', [join(SKILL_DIR, 'synthesizer.mjs')], {
      timeout: 180000,
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    if (synthResult.status !== 0) {
      console.error('[experimenter] Synthesizer exited with error — results saved, synthesis pending next run');
    }

  } finally {
    releaseLock();
  }
}

function buildExperimenterPrompt(hypothesis, lineage, config) {
  const question = (hypothesis.body.match(/\*\*Question:\*\*\s*(.+)/) || [])[1] || '';
  const testPlan = (hypothesis.body.match(/## Test Plan\n+([\s\S]*?)(?:\n##|$)/) || [])[1] || '';

  return `You are a hypothesis testing agent. Your ONLY job is to OBSERVE — not conclude.

${lineage ? lineage + '\n---\n' : ''}
## Hypothesis to Test
ID: ${hypothesis.id}
Domain: ${hypothesis.data.domain}
Question: ${question}

## Test Plan
${testPlan}

## Rules
1. Design the MINIMAL test that could provide evidence for or against the prediction
2. Execute it using your available tools (Bash, Read, Write, Glob, Grep)
3. If a test command matches these blocked patterns, do NOT run it: ${config.blocked_commands.join(', ')}
4. If a test would be destructive or matches: ${config.require_approval_patterns.join(', ')} — set requires_human_approval: true and describe what you WOULD do without doing it
5. Record raw observations ONLY — exact command output, file contents, numbers. No interpretation.
6. Note candidate_children: questions that emerged DURING the test that you did NOT chase
   (minimum ${config.min_children_per_result}, maximum ${config.max_children_per_result})

## Output format — JSON ONLY, no prose outside the JSON block
\`\`\`json
{
  "test_run": "one sentence describing what was executed",
  "commands": ["command1", "command2"],
  "observations": ["exact observation 1", "exact observation 2"],
  "raw_data": {},
  "requires_human_approval": false,
  "candidate_children": [
    "question that emerged from the test",
    "another question"
  ]
}
\`\`\``;
}

function runClaudeP(prompt, timeoutMs) {
  try {
    const promptFile = join(HYPOTHESES_DIR, 'experiment-prompt.tmp');
    writeFileSync(promptFile, prompt, 'utf-8');

    const output = execSync(
      `claude -p "$(cat '${promptFile.replace(/\\/g, '/').replace(/'/g, "'\\''")}')"`,
      { timeout: timeoutMs, encoding: 'utf-8', shell: 'bash' }
    );
    return { success: true, output };
  } catch (err) {
    return { success: false, error: err.message, output: err.stdout || '' };
  }
}

function writeRawResults(id, parsed) {
  const hyp = readHypothesis(id);
  const resultsSection = `## Raw Results

**Test run:** ${parsed.test_run}

**Commands executed:**
${(parsed.commands || []).map(c => `\`\`\`\n${c}\n\`\`\``).join('\n')}

**Observations:**
${(parsed.observations || []).map(o => `- ${o}`).join('\n')}

**Raw data:**
\`\`\`json
${JSON.stringify(parsed.raw_data || {}, null, 2)}
\`\`\`

**Candidate children (for synthesizer):**
${(parsed.candidate_children || []).map(q => `- ${q}`).join('\n')}
`;

  const newBody = hyp.body.replace(
    /## Raw Results[\s\S]*?(?=## Synthesis|$)/,
    resultsSection + '\n'
  );
  writeHypothesis(id, hyp.data, newBody);
}

main().catch(err => {
  releaseLock();
  console.error('[experimenter] Fatal error:', err.message);
  process.exit(1);
});
