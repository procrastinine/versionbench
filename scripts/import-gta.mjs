import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { SourceSnapshot, stableJSON } from './source-snapshot.mjs';
import { captureGtaUpdates, syncGtaUpdates } from './gta-updates.mjs';

const { values } = parseArgs({
  options: {
    refresh: { type: 'boolean' },
    offline: { type: 'boolean' },
    apply: { type: 'boolean' },
    snapshot: { type: 'string', default: 'output/gta-updates/snapshot.json' },
    report: { type: 'string', default: 'output/gta-updates/catalog.json' },
  },
});
if (values.refresh && values.offline) throw new Error('Choose --refresh or --offline');
const root = fileURLToPath(new URL('../', import.meta.url));
const dataPath = resolve(root, 'data/releases.json');
const evidencePath = resolve(root, 'data/evidence/gta-updates.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const reviews = JSON.parse(await readFile(resolve(root, 'data/gta-update-reviews.json'), 'utf8'));
let evidence;
if (values.refresh || values.offline) {
  const client = values.offline
    ? await SourceSnapshot.open(resolve(root, values.snapshot), { offline: true })
    : new SourceSnapshot();
  try {
    evidence = await captureGtaUpdates(client, data.updated, reviews);
  } finally {
    if (values.refresh) await client.save(resolve(root, values.snapshot));
  }
  const reportPath = resolve(root, values.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, stableJSON(evidence));
} else evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
const proposed = syncGtaUpdates(data, evidence, reviews);
console.log(
  `GTA: ${evidence.updates.length} title updates; ${evidence.excluded.length} other source rows accounted for. Every version and score is 5.`,
);
if (values.apply) {
  await writeFile(evidencePath, stableJSON(evidence));
  await writeFile(dataPath, stableJSON(proposed));
  console.log('Applied GTA update history. Run node scripts/generate.mjs.');
} else if (!isDeepStrictEqual(data, proposed)) {
  console.log('GTA history changes available. Review the evidence, then use --apply.');
  process.exitCode = 1;
} else console.log('PASS: GTA matches the saved update history. Still 5.');
