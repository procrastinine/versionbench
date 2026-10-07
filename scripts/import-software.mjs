import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { SourceSnapshot, stableJSON } from './source-snapshot.mjs';
import { captureSoftwareCatalog, syncSoftwareReleases } from './software-releases.mjs';

const { values } = parseArgs({
  options: {
    refresh: { type: 'boolean' },
    offline: { type: 'boolean' },
    apply: { type: 'boolean' },
    snapshot: { type: 'string', default: 'output/software-releases/snapshot.json' },
    report: { type: 'string', default: 'output/software-releases/catalog.json' },
  },
});
if (values.refresh && values.offline) throw new Error('Choose --refresh or --offline');
const root = fileURLToPath(new URL('../', import.meta.url));
const dataPath = resolve(root, 'data/releases.json');
const evidencePath = resolve(root, 'data/evidence/software-releases.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
let evidence;
if (values.refresh || values.offline) {
  const client = values.offline
    ? await SourceSnapshot.open(resolve(root, values.snapshot), { offline: true })
    : new SourceSnapshot();
  try {
    evidence = await captureSoftwareCatalog(client, data.updated);
  } finally {
    if (values.refresh) await client.save(resolve(root, values.snapshot));
  }
  const reportPath = resolve(root, values.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, stableJSON(evidence));
} else {
  // The default command reads only the evidence that is checked into Git.
  evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
}
const proposed = syncSoftwareReleases(data, evidence);
for (const catalog of evidence.catalogs) {
  const before = data.releases.filter((r) => r.family === catalog.family).length;
  console.log(
    `${catalog.family}: ${catalog.releases.length} releases (${catalog.releases.length - before} additions), ${catalog.excluded.length} excluded source entries`,
  );
}
if (values.apply) {
  await writeFile(evidencePath, stableJSON(evidence));
  await writeFile(dataPath, stableJSON(proposed));
  console.log('Applied saved software release evidence. Run node scripts/generate.mjs.');
} else if (!isDeepStrictEqual(data, proposed)) {
  console.log(
    'Software catalog changes available. Review the saved evidence, then apply with --apply.',
  );
  process.exitCode = 1;
} else {
  console.log('PASS: Python and PyTorch match every release in the saved catalogs.');
}
