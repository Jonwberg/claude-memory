// bootstrap-hypotheses.mjs
// Run ONCE to seed 11 starter hypotheses — one per domain.
// Safe to re-run (idempotent — skips existing hypotheses by checking queue domain coverage).

import { existsSync } from 'fs';
import {
  nextHypothesisId, writeHypothesis, addToQueue, hypothesisPath,
  ensureHypothesesDir, buildLineageSection, readQueue
} from './hypothesis-utils.mjs';
import { todayUTC } from './memory-utils.mjs';

const STARTERS = [
  {
    domain: 'perception',
    checklist_ref: 'cat1-02',
    question: 'Can I reliably detect when a file I wrote was saved correctly without reading it back?',
    prediction: 'writeFileSync throws on failure so exit = success. But silent truncation may occur on network/WSL drives.',
    why_matters: 'The entire memory system writes files — if writes can silently fail, memories are corrupted without knowing it.',
    test_plan: '1. Write known-content file via writeFileSync\n2. Read it back and compare byte-for-byte\n3. Test on local drive, then mapped network path\n4. Test with 1KB, 10KB, 100KB payloads',
  },
  {
    domain: 'memory',
    checklist_ref: 'cat2-01',
    question: 'What facts from today will I reliably have access to in the next session?',
    prediction: 'Only facts written to memory files before the Stop hook fires. In-context reasoning is lost.',
    why_matters: 'Defines the boundary of what the memory system can actually preserve — helps calibrate what to save.',
    test_plan: '1. Write a specific test fact to semantic memory\n2. End session (trigger Stop hook)\n3. Start new session, check if fact is retrieved\n4. Compare retrieved content to original',
  },
  {
    domain: 'environment',
    checklist_ref: 'cat3-04',
    question: 'What is the actual working directory when a Claude Code hook fires?',
    prediction: 'Hooks inherit the working directory of the Claude Code process, likely the project directory.',
    why_matters: 'Memory file paths use absolute paths (homedir()) so this should not matter — but confirming prevents future path bugs.',
    test_plan: '1. Add a temporary hook that writes process.cwd() to a temp file\n2. Trigger the hook\n3. Read the temp file\n4. Compare to expected paths',
  },
  {
    domain: 'causation',
    checklist_ref: 'cat4-08',
    question: 'Can I detect silent failures — bash commands that exit 0 but did nothing useful?',
    prediction: 'Most silent failures leave traces (empty output, unchanged file state) that can be detected with a follow-up check.',
    why_matters: 'If I cannot detect silent failures, I will confidently report success when nothing happened.',
    test_plan: '1. Run a command designed to fail silently (e.g. grep for nonexistent pattern with exit 0)\n2. Check if output is empty\n3. Run cp to a read-only dir — does it exit 0?\n4. Document which commands lie about their exit codes',
  },
  {
    domain: 'feedback',
    checklist_ref: 'cat5-01',
    question: 'Does the Claude Code Stop hook always fire when a session ends, or can sessions end without triggering it?',
    prediction: 'Stop hook fires on clean exits but may not fire on crash, force-quit, or timeout.',
    why_matters: 'Consolidation depends on the Stop hook. If it can be missed, memories are never written and the session is lost.',
    test_plan: '1. Check Claude Code docs for Stop hook guarantees\n2. Start a session, immediately close the window — check if consolidation ran\n3. Check for partial session-tags.json files after abrupt close\n4. Test with --no-hooks flag behavior',
  },
  {
    domain: 'user-model',
    checklist_ref: 'cat6-01',
    question: "Can I infer a user's actual skill level from their prompt style reliably?",
    prediction: 'Prompt length, vocabulary specificity, and error description quality are signals — but all have false positives.',
    why_matters: 'Calibrating explanation depth to skill level makes responses much more useful. Miscalibration wastes time.',
    test_plan: '1. Review last 10 sessions from memory\n2. For each: note prompt style markers and skill level inferred\n3. Check if inferred level matched actual knowledge shown later in session\n4. Identify which markers were most/least reliable',
  },
  {
    domain: 'knowledge',
    checklist_ref: 'cat7-04',
    question: 'Which Windows-specific behaviors most commonly cause me to give wrong advice vs Linux/Mac?',
    prediction: 'PATH management, line endings, file permissions, and shell syntax are the most common sources of error.',
    why_matters: 'This user is on Windows 11. Knowing my failure modes lets me add verification steps proactively.',
    test_plan: '1. Review Solution entries in feedback.md — how many are Windows-specific?\n2. Test: does `which` work the same as `where` on Windows?\n3. Test: does chmod work in Git Bash vs PowerShell?\n4. Test: does #!/usr/bin/env python work in Windows scripts?',
  },
  {
    domain: 'time',
    checklist_ref: 'cat8-01',
    question: 'How much does a typical project change between Claude Code sessions in this workspace?',
    prediction: 'Active projects change 1-5 files per day. Memory entries older than 30 days have meaningful staleness risk.',
    why_matters: 'Informs how aggressively to distrust old memories and how often to re-verify semantic facts.',
    test_plan: '1. Run git log --since="30 days ago" on competitor_intel project\n2. Count files changed, commits made\n3. Check if any changes contradict current memory entries\n4. Calculate staleness rate for existing semantic memories',
  },
  {
    domain: 'action',
    checklist_ref: 'cat9-01',
    question: 'Which bash commands I commonly run have irreversible side effects I might not notice?',
    prediction: 'pip install (modifies global env), npm install (writes node_modules), git commands with remotes are the main culprits.',
    why_matters: 'Knowing which actions are irreversible lets me apply confirmation gates before running them autonomously.',
    test_plan: '1. List all commands in recent session-errors.json logs\n2. For each: classify as reversible/irreversible/unknown\n3. Test: can pip uninstall cleanly reverse pip install?\n4. Document which commands should always require user confirmation',
  },
  {
    domain: 'collaboration',
    checklist_ref: 'cat10-01',
    question: 'In what situations does this user want me to act autonomously vs ask for permission first?',
    prediction: 'File edits and reads are autonomous. Git pushes, external API calls, and destructive operations require confirmation.',
    why_matters: 'Asking permission too often is annoying. Acting autonomously at the wrong time loses work. Calibration is critical.',
    test_plan: '1. Review recent sessions — find moments user explicitly approved or blocked an action\n2. Check feedback.md for any correction signals about autonomy\n3. Classify approved actions by type\n4. Write a provisional rule and test it against memory',
  },
  {
    domain: 'meta-cognition',
    checklist_ref: 'cat11-03',
    question: "Can I reliably distinguish between 'I am uncertain' and 'I am confidently wrong'?",
    prediction: 'I am poorly calibrated in domains where training data was confidently wrong — I inherit that confidence.',
    why_matters: 'Overconfident wrong answers are worse than acknowledged uncertainty. This is the root cause of most hard-to-debug errors.',
    test_plan: '1. Find 3 cases from memory where I was wrong despite seeming confident\n2. For each: what signal could have flagged uncertainty at the time?\n3. Test: when I answer a question about Windows behavior, do I hedge appropriately?\n4. Write a calibration heuristic for high-risk domains',
  },
];

async function main() {
  ensureHypothesesDir();
  const today = todayUTC();

  // Check which domains already have hypotheses in the queue
  const queue = readQueue();
  const existingDomains = new Set(queue.flat.map(e => e.domain));

  let created = 0;
  for (const starter of STARTERS) {
    if (existingDomains.has(starter.domain)) {
      console.log(`Skipping [${starter.domain}] — already in queue`);
      continue;
    }

    const id = nextHypothesisId();

    const data = {
      type: 'hypothesis',
      id,
      parent: null,
      root: id,
      depth: 0,
      status: 'proposed',
      domain: starter.domain,
      checklist_ref: starter.checklist_ref,
      created: today,
      activated: null,
      tested: null,
      synthesized: null,
      confidence: 'low',
      tags: [starter.domain, 'checklist', 'seed'],
      children: [],
    };

    const body = `## This Hypothesis

**Question:** ${starter.question}

**Why this matters:** ${starter.why_matters}

**Prediction:** ${starter.prediction}

## Test Plan

${starter.test_plan}

## Raw Results

*(filled in by experimenter)*

## Synthesis

*(filled in by synthesizer)*

**Outcome:** pending

## Child Hypotheses

*(generated by synthesizer)*
`;

    writeHypothesis(id, data, body);
    addToQueue({
      id,
      parent: null,
      root: id,
      depth: 0,
      status: 'proposed',
      domain: starter.domain,
      question: starter.question,
      checklist_ref: starter.checklist_ref,
      created: today,
    });

    console.log(`Created ${id}: [${starter.domain}] ${starter.question.slice(0, 60)}...`);
    created++;
  }

  console.log(`\nBootstrap complete: ${created} hypotheses created`);
}

main().catch(err => {
  console.error('Bootstrap error:', err.message);
  process.exit(1);
});
