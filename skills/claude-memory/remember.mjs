// remember.mjs — append a prose claim to today's episodic WIP for the Enzo memory pipeline.
// Invoked by the /remember slash command. Argv after argv[1] is joined as the claim.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MEMORY_DIR = join(homedir(), '.claude', 'projects', 'C--Users-Jon-Berg', 'memory');
const NOTES_HEADING = '## Notes (manual)';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function decayDate(daysOut = 14) {
  return new Date(Date.now() + daysOut * 86400000).toISOString().slice(0, 10);
}

function buildFreshWip(today, claim) {
  return `---
type: episodic
tags: [notes]
salience: medium
confidence: medium
source: observed
status: open
retention: temporary
created: ${today}
last-accessed: ${today}
decay-after: ${decayDate()}
---

# WIP Checkpoint — ${today}

${NOTES_HEADING}

${claim}
`;
}

function main() {
  const claim = process.argv.slice(2).join(' ').trim();
  if (!claim) {
    console.error('usage: remember.mjs <claim text>');
    process.exit(1);
  }

  const today = todayUTC();
  const wipFile = join(MEMORY_DIR, 'episodic', `${today}-wip.md`);

  if (!existsSync(wipFile)) {
    writeFileSync(wipFile, buildFreshWip(today, claim), 'utf-8');
    console.log(`Created ${wipFile} with 1 note.`);
    return;
  }

  const content = readFileSync(wipFile, 'utf-8');
  const updated = content.includes(NOTES_HEADING)
    ? content.trimEnd() + `\n\n${claim}\n`
    : content.trimEnd() + `\n\n${NOTES_HEADING}\n\n${claim}\n`;
  writeFileSync(wipFile, updated, 'utf-8');
  console.log(`Appended note to ${wipFile}.`);
}

main();
