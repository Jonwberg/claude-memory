// mcp-server.mjs
// Always-on MCP server exposing 9 tools over stdio.
// Register in .claude/settings.json under mcpServers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  readIndexJson, MEMORY_DIR, tagOverlap, todayUTC,
  writeIndexJson, scanAllMemoryFiles
} from './memory-utils.mjs';
import {
  readHypothesis, readQueue, writeQueue, addToQueue, buildLineageSection,
  nextHypothesisId, writeHypothesis, updateQueueEntry,
  ensureHypothesesDir
} from './hypothesis-utils.mjs';
import { HYPOTHESES_DIR } from './memory-utils.mjs';

const server = new Server(
  { name: 'claude-memory', version: '2.2.0' },
  { capabilities: { tools: {} } }
);

// --- Tool Definitions ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'memory_search',
      description: 'Search memory files by keyword. Returns scored results from .index.json.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords' },
          limit: { type: 'number', description: 'Max results (default 5)' }
        },
        required: ['query']
      }
    },
    {
      name: 'memory_read',
      description: 'Read a specific memory file by relative path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path e.g. semantic/user.md' }
        },
        required: ['path']
      }
    },
    {
      name: 'memory_write',
      description: 'Create or update a memory file.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['semantic', 'procedural', 'reference', 'episodic'] },
          tags: { type: 'array', items: { type: 'string' } },
          content: { type: 'string' },
          trigger: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          source: { type: 'string', enum: ['observed', 'inferred', 'instructed', 'referenced'] }
        },
        required: ['type', 'tags', 'content']
      }
    },
    {
      name: 'hypothesis_create',
      description: 'Add a new hypothesis to the queue. Use during live sessions when an unknown surfaces.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          domain: { type: 'string' },
          prediction: { type: 'string' },
          why_matters: { type: 'string' },
          parent_id: { type: 'string', description: 'Optional parent hypothesis ID' }
        },
        required: ['question', 'domain', 'prediction', 'why_matters']
      }
    },
    {
      name: 'hypothesis_get',
      description: 'Get a hypothesis with its full lineage context.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    },
    {
      name: 'hypothesis_list',
      description: 'List hypotheses filtered by status and/or domain.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          domain: { type: 'string' },
          root: { type: 'string', description: 'Return entire tree for this root ID' }
        }
      }
    },
    {
      name: 'hypothesis_status',
      description: 'Get queue statistics: counts by status/domain, coverage across checklist.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'checklist_get',
      description: 'Get the world navigation checklist with hypothesis status per item.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Filter by domain category' },
          status: { type: 'string', enum: ['unexplored', 'proposed', 'in_progress', 'answered'] }
        }
      }
    },
    {
      name: 'checklist_activate',
      description: 'Create a hypothesis from a specific checklist item.',
      inputSchema: {
        type: 'object',
        properties: {
          item_ref: { type: 'string', description: 'e.g. cat1-02' },
          priority: { type: 'string', enum: ['high', 'normal'] }
        },
        required: ['item_ref']
      }
    }
  ]
}));

// --- Tool Handlers ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'memory_search': return handleMemorySearch(args);
      case 'memory_read': return handleMemoryRead(args);
      case 'memory_write': return handleMemoryWrite(args);
      case 'hypothesis_create': return handleHypothesisCreate(args);
      case 'hypothesis_get': return handleHypothesisGet(args);
      case 'hypothesis_list': return handleHypothesisList(args);
      case 'hypothesis_status': return handleHypothesisStatus();
      case 'checklist_get': return handleChecklistGet(args);
      case 'checklist_activate': return handleChecklistActivate(args);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

function handleMemorySearch({ query, limit = 5 }) {
  const entries = readIndexJson();
  if (!entries) return { content: [{ type: 'text', text: 'Index not found' }] };
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = entries
    .filter(e => e.status !== 'superseded')
    .map(e => {
      const tagScore = tagOverlap(e.tags || [], keywords);
      const triggerScore = tagOverlap(e.trigger || [], keywords) * 2;
      const score = (tagScore + triggerScore) * ({ high: 3, medium: 2, low: 1 }[e.salience] || 2);
      return { ...e, score };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return { content: [{ type: 'text', text: JSON.stringify(scored, null, 2) }] };
}

function handleMemoryRead({ path }) {
  const filePath = join(MEMORY_DIR, path);
  if (!existsSync(filePath)) return { content: [{ type: 'text', text: `Not found: ${path}` }] };
  return { content: [{ type: 'text', text: readFileSync(filePath, 'utf-8') }] };
}

function handleMemoryWrite({ type, tags, content, trigger = [], confidence = 'medium', source = 'observed' }) {
  const today = todayUTC();
  const slug = tags.slice(0, 3).join('-') + '-' + today;
  const subdir = type === 'episodic' ? 'episodic'
    : type === 'procedural' ? 'procedural'
    : type === 'reference' ? 'reference'
    : 'semantic';
  const dir = join(MEMORY_DIR, subdir);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${slug}.md`);
  const frontmatter = [
    '---',
    `type: ${type}`,
    `tags: [${tags.join(', ')}]`,
    'salience: medium',
    `confidence: ${confidence}`,
    `source: ${source}`,
    `status: ${type === 'episodic' ? 'open' : 'confirmed'}`,
    `trigger: [${trigger.join(', ')}]`,
    'related: []',
    `created: ${today}`,
    `last-accessed: ${today}`,
    '---',
    '',
  ].join('\n');
  writeFileSync(filePath, frontmatter + content, 'utf-8');
  if (scanAllMemoryFiles) {
    try { writeIndexJson(scanAllMemoryFiles()); } catch {}
  }
  return { content: [{ type: 'text', text: `Written: ${filePath}` }] };
}

function handleHypothesisCreate({ question, domain, prediction, why_matters, parent_id }) {
  ensureHypothesesDir();
  const id = nextHypothesisId();
  const today = todayUTC();
  let depth = 0;
  let root = id;
  if (parent_id) {
    const parent = readHypothesis(parent_id);
    if (parent) {
      depth = (parent.data.depth || 0) + 1;
      root = parent.data.root || parent_id;
    }
  }
  writeHypothesis(id, {
    type: 'hypothesis', id, parent: parent_id || null, root, depth,
    status: 'proposed', domain, checklist_ref: null, created: today,
    activated: null, tested: null, synthesized: null, confidence: 'low',
    tags: [domain, 'reactive'], children: [],
  }, `## This Hypothesis\n\n**Question:** ${question}\n\n**Why this matters:** ${why_matters}\n\n**Prediction:** ${prediction}\n\n## Test Plan\n\n*(to be designed by experimenter)*\n\n## Raw Results\n\n*(filled in by experimenter)*\n\n## Synthesis\n\n*(filled in by synthesizer)*\n`);
  addToQueue({ id, parent: parent_id || null, root, depth, status: 'proposed', domain, question, created: today });
  return { content: [{ type: 'text', text: `Created hypothesis ${id}: "${question}"` }] };
}

function handleHypothesisGet({ id }) {
  const hyp = readHypothesis(id);
  if (!hyp) return { content: [{ type: 'text', text: `Not found: ${id}` }] };
  const lineage = buildLineageSection(id);
  return { content: [{ type: 'text', text: `${lineage}\n\n---\n\n${readFileSync(hyp.path, 'utf-8')}` }] };
}

function handleHypothesisList({ status, domain, root } = {}) {
  const queue = readQueue();
  let entries = queue.flat;
  if (status) entries = entries.filter(e => e.status === status);
  if (domain) entries = entries.filter(e => e.domain === domain);
  if (root) entries = entries.filter(e => e.root === root || e.id === root);
  return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
}

function handleHypothesisStatus() {
  const queue = readQueue();
  const flat = queue.flat;
  const byStatus = {};
  const byDomain = {};
  for (const e of flat) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  }
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        total: flat.length,
        by_status: byStatus,
        by_domain: byDomain,
        trees: queue.trees.length,
        open_trees: queue.trees.filter(t => t.status !== 'closed').length,
      }, null, 2)
    }]
  };
}

function handleChecklistGet({ domain, status } = {}) {
  const checklistPath = join(HYPOTHESES_DIR, 'checklist.md');
  if (!existsSync(checklistPath)) return { content: [{ type: 'text', text: 'Checklist not found' }] };
  return { content: [{ type: 'text', text: readFileSync(checklistPath, 'utf-8') }] };
}

function handleChecklistActivate({ item_ref, priority = 'normal' }) {
  const checklistPath = join(HYPOTHESES_DIR, 'checklist.md');
  if (!existsSync(checklistPath)) return { content: [{ type: 'text', text: 'Checklist not found' }] };
  const content = readFileSync(checklistPath, 'utf-8');
  const line = content.split('\n').find(l => l.includes(`hyp-ref: ${item_ref}`));
  if (!line) return { content: [{ type: 'text', text: `Item ${item_ref} not found in checklist` }] };
  const question = line.replace(/.*`hyp-ref:[^`]+`\s*/, '').trim();
  const domain = item_ref.startsWith('cat1-') ? 'perception'
    : item_ref.startsWith('cat2-') ? 'memory'
    : item_ref.startsWith('cat3-') ? 'environment'
    : item_ref.startsWith('cat4-') ? 'causation'
    : item_ref.startsWith('cat5-') ? 'feedback'
    : item_ref.startsWith('cat6-') ? 'user-model'
    : item_ref.startsWith('cat7-') ? 'knowledge'
    : item_ref.startsWith('cat8-') ? 'time'
    : item_ref.startsWith('cat9-') ? 'action'
    : item_ref.startsWith('cat10-') ? 'collaboration'
    : 'meta-cognition';
  return handleHypothesisCreate({
    question,
    domain,
    prediction: '(to be determined)',
    why_matters: `Checklist item ${item_ref} — priority: ${priority}`,
  });
}

// --- Start Server ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[mcp-server] Claude Memory MCP server running on stdio');
