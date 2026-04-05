// synthesizer.mjs
// Called by experimenter after test results are written.
// Calls Claude API to classify outcome, generate child hypotheses, write memory.

import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  readHypothesis, writeHypothesis, updateHypothesisStatus, updateQueueEntry,
  nextHypothesisId, addToQueue, hypothesisPath,
  buildLineageSection, readConfig, logNeedsReview, readQueue, writeQueue
} from './hypothesis-utils.mjs';
import {
  HYPOTHESES_DIR, MEMORY_DIR, todayUTC, tagOverlap
} from './memory-utils.mjs';

const SYNTHESIS_PENDING_FILE = join(HYPOTHESES_DIR, 'synthesis-pending.json');

async function main() {
  if (!existsSync(SYNTHESIS_PENDING_FILE)) {
    console.error('[synthesizer] No synthesis-pending.json — nothing to do');
    return;
  }

  let pendingId;
  try {
    pendingId = JSON.parse(readFileSync(SYNTHESIS_PENDING_FILE, 'utf-8')).id;
    unlinkSync(SYNTHESIS_PENDING_FILE);
  } catch {
    console.error('[synthesizer] Could not read synthesis-pending.json');
    return;
  }

  const hypothesis = readHypothesis(pendingId);
  if (!hypothesis) {
    console.error(`[synthesizer] Hypothesis ${pendingId} not found`);
    return;
  }

  const config = readConfig();
  const lineage = buildLineageSection(pendingId);
  const relatedMemories = loadRelatedMemories(hypothesis.data.tags || []);

  console.error(`[synthesizer] Synthesizing ${pendingId}...`);

  const client = new Anthropic();
  let synthesis;
  try {
    synthesis = await callSynthesizerAPI(client, hypothesis, lineage, relatedMemories, config);
  } catch (err) {
    console.error(`[synthesizer] API call failed: ${err.message}`);
    return;
  }

  console.error(`[synthesizer] Outcome: ${synthesis.outcome} | Children: ${synthesis.child_hypotheses?.length || 0}`);

  writeSynthesis(pendingId, synthesis);
  updateHypothesisStatus(pendingId, synthesis.outcome);
  updateQueueEntry(pendingId, { status: synthesis.outcome, confidence: synthesis.confidence });

  const children = [];
  if (synthesis.child_hypotheses && synthesis.child_hypotheses.length > 0) {
    for (const child of synthesis.child_hypotheses) {
      const childId = spawnChild(hypothesis, child, config);
      if (childId) children.push(childId);
    }
    console.error(`[synthesizer] Spawned ${children.length} child hypotheses`);
  }

  if (synthesis.memory && synthesis.memory.type !== 'none') {
    writeMemoryFromSynthesis(synthesis.memory, hypothesis.data.domain, hypothesis.id);
  }

  checkTreeClosure(hypothesis.data.root || pendingId);

  console.error('[synthesizer] Done');
}

async function callSynthesizerAPI(client, hypothesis, lineage, relatedMemories, config) {
  const question = (hypothesis.body.match(/\*\*Question:\*\*\s*(.+)/) || [])[1] || '';
  const rawResults = (hypothesis.body.match(/## Raw Results([\s\S]*?)(?=## Synthesis|$)/) || [])[1] || 'No results';

  const response = await client.messages.create({
    model: config.synthesizer_model || 'claude-opus-4-6',
    max_tokens: 4096,
    system: `You are a scientific synthesizer for an autonomous learning system.
You reason over experimental results, classify outcomes, extract durable knowledge,
and generate the next layer of questions to pursue.
You think like a researcher who is never satisfied with a partial answer.
Every result — even a clean confirmation — raises new questions. There are no dead ends.`,
    messages: [{
      role: 'user',
      content: `## Full Hypothesis Context

${lineage || '(Root hypothesis — no ancestors)'}

## This Hypothesis
ID: ${hypothesis.id}
Domain: ${hypothesis.data.domain}
Question: ${question}

## Raw Experimental Results
${rawResults}

## Related Memory Context
${relatedMemories || '(none loaded)'}

---

## Your Tasks

### 1. Classify the outcome
- **confirmed**: prediction was correct, finding is reliable and specific
- **refuted**: prediction was wrong — record what actually happens instead
- **open**: result is ambiguous, partial, or raises more questions than it answers

### 2. Write the synthesis
2-4 sentences. What was learned? Why does it matter? Be concrete — reference actual data from results.

### 3. Generate child hypotheses (REQUIRED — minimum ${config.min_children_per_result}, maximum ${config.max_children_per_result})
Even for confirmed/refuted outcomes: what does this finding NOT yet explain?
What edge cases remain? What would break this conclusion under different conditions?
Each child must be a CONCRETE, TESTABLE question — not vague.
Include: question, prediction, why_this_matters, domain (from the 11 domains).

### 4. Memory to write
- confirmed → semantic memory fact (1-3 sentences, concrete and specific)
- refuted → Solution entry (Symptom / Failed / Solution format, 3 fields)
- open → type: "none"

### 5. Confidence assessment
Given the lineage and this result, confidence in the root question being answerable: low/medium/high

## Output — JSON ONLY
\`\`\`json
{
  "outcome": "confirmed | refuted | open",
  "synthesis": "...",
  "confidence": "low | medium | high",
  "root_confidence_update": "low | medium | high",
  "child_hypotheses": [
    {
      "question": "...",
      "prediction": "...",
      "why_this_matters": "...",
      "domain": "..."
    }
  ],
  "memory": {
    "type": "semantic | solution | none",
    "content": "...",
    "tags": [],
    "trigger": []
  }
}
\`\`\``
    }]
  });

  const raw = response.content[0].text;
  const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

function writeSynthesis(id, synthesis) {
  const hyp = readHypothesis(id);
  const childLines = synthesis.child_hypotheses?.length > 0
    ? '## Child Hypotheses\n\n' + synthesis.child_hypotheses.map(c => `- "${c.question}"`).join('\n')
    : '';
  const section = `## Synthesis

${synthesis.synthesis}

**Outcome:** ${synthesis.outcome}
**Confidence:** ${synthesis.confidence}

${childLines}
`;
  const newBody = hyp.body.replace(/## Synthesis[\s\S]*$/, section);
  writeHypothesis(id, { ...hyp.data, confidence: synthesis.confidence }, newBody);
}

function spawnChild(parent, childSpec, config) {
  const parentData = parent.data;
  const newDepth = (parentData.depth || 0) + 1;

  if (newDepth > config.max_depth) {
    logNeedsReview(
      'depth-limit-' + todayUTC(),
      `Child of ${parent.id} at depth ${newDepth} exceeds max_depth ${config.max_depth}: "${childSpec.question.slice(0, 60)}"`
    );
    return null;
  }

  const id = nextHypothesisId();
  const today = todayUTC();

  const data = {
    type: 'hypothesis',
    id,
    parent: parent.id,
    root: parentData.root || parent.id,
    depth: newDepth,
    status: 'proposed',
    domain: childSpec.domain || parentData.domain,
    checklist_ref: null,
    created: today,
    activated: null,
    tested: null,
    synthesized: null,
    confidence: 'low',
    tags: [childSpec.domain || parentData.domain, 'spawned'],
    children: [],
  };

  const parentHyp = readHypothesis(parent.id);
  const parentChildren = parentHyp.data.children || [];
  writeHypothesis(parent.id, { ...parentHyp.data, children: [...parentChildren, id] }, parentHyp.body);

  const body = `## Lineage

${buildLineageSection(id) || '*(assembling...)*'}

## This Hypothesis

**Question:** ${childSpec.question}

**Why this matters:** ${childSpec.why_this_matters}

**Prediction:** ${childSpec.prediction}

## Test Plan

*(to be designed by experimenter)*

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
    parent: parent.id,
    root: parentData.root || parent.id,
    depth: newDepth,
    status: 'proposed',
    domain: data.domain,
    question: childSpec.question,
    checklist_ref: null,
    created: today,
  });

  return id;
}

function writeMemoryFromSynthesis(memory, domain, hypothesisId) {
  const today = todayUTC();

  if (memory.type === 'semantic') {
    const semDir = join(MEMORY_DIR, 'semantic');
    mkdirSync(semDir, { recursive: true });
    const slug = `hypothesis-${domain}-${hypothesisId}`;
    const filePath = join(semDir, `${slug}.md`);
    const frontmatter = [
      '---',
      'type: semantic',
      `tags: [${(memory.tags || [domain, 'hypothesis-derived']).join(', ')}]`,
      'salience: medium',
      'confidence: high',
      'source: observed',
      'status: confirmed',
      `trigger: [${(memory.trigger || []).join(', ')}]`,
      'related: []',
      `created: ${today}`,
      `last-accessed: ${today}`,
      '---',
      '',
    ].join('\n');
    writeFileSync(filePath, frontmatter + memory.content, 'utf-8');
    console.error(`[synthesizer] Wrote semantic memory: ${filePath}`);

  } else if (memory.type === 'solution') {
    const feedbackPath = join(MEMORY_DIR, 'procedural', 'feedback.md');
    if (existsSync(feedbackPath)) {
      const existing = readFileSync(feedbackPath, 'utf-8');
      const entry = `\n\n## Solution: hypothesis-${domain}-${hypothesisId}\n\n${memory.content}`;
      writeFileSync(feedbackPath, existing.trimEnd() + entry, 'utf-8');
      console.error(`[synthesizer] Wrote Solution entry to feedback.md`);
    }
  }
}

function loadRelatedMemories(tags) {
  const semanticDir = join(MEMORY_DIR, 'semantic');
  if (!existsSync(semanticDir)) return '';
  try {
    const files = readdirSync(semanticDir).filter(f => f.endsWith('.md'));
    const related = [];
    for (const f of files) {
      const content = readFileSync(join(semanticDir, f), 'utf-8');
      // Simple keyword match against tags
      const fileTags = (content.match(/^tags:\s*\[([^\]]*)\]/m) || [])[1] || '';
      const fileTagList = fileTags.split(',').map(t => t.trim().replace(/['"]/g, ''));
      const overlap = tags.filter(t => fileTagList.includes(t)).length;
      if (overlap >= 2) {
        related.push(`### ${f}\n${content.slice(0, 300)}`);
        if (related.length >= 3) break;
      }
    }
    return related.join('\n\n');
  } catch {
    return '';
  }
}

function checkTreeClosure(rootId) {
  const queue = readQueue();
  const tree = queue.trees.find(t => t.root === rootId);
  if (!tree || tree.status === 'closed') return;
  if (tree.open_leaves.length === 0) {
    tree.status = 'closed';
    writeQueue(queue);
    console.error(`[synthesizer] Tree ${rootId} fully resolved — closed`);
  }
}

main().catch(err => {
  console.error('[synthesizer] Fatal error:', err.message);
  process.exit(1);
});
