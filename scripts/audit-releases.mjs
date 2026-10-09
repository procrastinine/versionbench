import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SourceSnapshot, stableJSON } from './source-snapshot.mjs';
import {
  buildReleaseAudit,
  needsReleaseReview,
  releaseAuditNeedsReview,
} from './release-audit.mjs';

const { values } = parseArgs({
  options: {
    'retry-errors': { type: 'boolean' },
    offline: { type: 'boolean', default: false },
    resume: { type: 'boolean', default: false },
    snapshot: { type: 'string', default: 'output/source-snapshot.json' },
    report: { type: 'string', default: 'output/release-audit.json' },
    family: { type: 'string' },
    'providers-only': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(`Usage: node scripts/audit-releases.mjs [--offline | --resume] [--snapshot FILE] [--report FILE] [--family ID,ID] [--providers-only]
Default: capture every configured source and catalog, with pagination, and write a review report.
--offline: replay saved responses with no network access; identical inputs produce identical reports.
--resume: reuse a capture and fetch only missing URLs (not a fresh check).
Exit 1 means review items or unavailable sources.
No candidates are automatically imported. Dates are never inferred from repository timestamps.`);
  process.exit(0);
}
if (values.offline && values.resume) throw new Error('Choose --offline or --resume');
const root = fileURLToPath(new URL('../', import.meta.url));
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const allData = await read('data/releases.json');
const allDefinitions = await read('data/provider-sources.json');
const decisions = await read('data/discovery-decisions.json');
const allPending = await read('data/pending-releases.json');
const selected = values.family ? new Set(values.family.split(',')) : null;
if (selected)
  for (const id of selected)
    if (!allData.families.some((f) => f.id === id)) throw new Error(`Unknown family: ${id}`);
const data = selected
  ? {
      ...allData,
      families: allData.families.filter((f) => selected.has(f.id)),
      releases: allData.releases.filter((r) => selected.has(r.family)),
    }
  : allData;
const pending = allPending.filter((r) => !selected || selected.has(r.family));
const definitions = allDefinitions.filter((d) => !selected || selected.has(d.family));
for (const family of data.families)
  if (!definitions.some((d) => d.family === family.id && d.sources.length))
    throw new Error(`Missing watchlist: ${family.id}`);
const snapshotPath = resolve(root, values.snapshot);
const reportPath = resolve(root, values.report);
const client =
  values.offline || values.resume
    ? await SourceSnapshot.open(snapshotPath, {
        offline: values.offline,
        retryErrors: !!values['retry-errors'],
      })
    : new SourceSnapshot();
const report = await buildReleaseAudit(client, data, definitions, decisions, pending, {
  providersOnly: values['providers-only'],
});
const { families, sources } = report;
if (!values.offline) await client.save(snapshotPath);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, stableJSON(report));
for (const family of families)
  console.log(
    `${family.family}: ${family.comparison}; ${family.unrecordedVersions.length} missing version observations, ${family.unreviewedRecordCount} repositories/pages to review, ${family.sources.filter((s) => s.error).length} source failures`,
  );
for (const source of sources)
  console.log(
    `${source.id}: ${source.error || `${source.records.filter(needsReleaseReview).length} candidates to review`}`,
  );
console.log(`${pending.length} known candidates await primary evidence.`);
console.log(`Saved ${values.report}. Source responses: ${values.snapshot}. Catalog unchanged.`);
if (releaseAuditNeedsReview(report)) process.exitCode = 1;
