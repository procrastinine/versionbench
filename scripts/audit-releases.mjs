import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SourceSnapshot, stableJSON, sha256 } from './source-snapshot.mjs';
import { auditInventory } from './source-inventory.mjs';
import { pageArray, normalizedName, releaseTrackers, gatewayTracker } from './source-data.mjs';
import { artifactExclusion } from './release-policy.mjs';

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
const providerReview = auditInventory(client, data, definitions, decisions);
const trackers = values['providers-only'] ? [] : [...releaseTrackers];
if (!values['providers-only'])
  for (let year = 2022; year <= Number(data.updated.slice(0, 4)); year++)
    trackers.push(gatewayTracker(year));
const sources = await Promise.all(
  trackers.map(async (tracker) => {
    try {
      const html = await client.text(tracker.url);
      const rows = tracker.load
        ? await tracker.load(html, tracker.url, (url) => client.text(url))
        : pageArray(html, tracker.array);
      if (!rows.length) throw new Error('Empty catalog; check source format');
      const records = rows
        .map((row) => {
          const item = tracker.row(row);
          if (typeof item.name !== 'string' || !item.name || typeof item.url !== 'string')
            throw new Error('Invalid release row; check source format');
          const names = [item.name, item.name.replace(/^[^:]+:\s*/, '')].map(normalizedName);
          const matches = data.releases.filter(
            (r) =>
              names.includes(normalizedName(r.name)) ||
              item.modelURLs?.includes(r.artificialAnalysisUrl) ||
              (item.huggingFaceUrl && item.huggingFaceUrl === r.huggingFaceUrl),
          );
          return {
            ...item,
            date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : null,
            comparison: item.excluded
              ? 'excluded-alias'
              : artifactExclusion(item.name)
                ? 'excluded-artifact'
                : !matches.length
                  ? 'review-name'
                  : item.dateBasis === 'gateway-listing'
                    ? 'model-linked-listing-date-separate'
                    : matches.some((r) => r.date === item.date)
                      ? 'name-or-profile-and-date-match'
                      : 'review-date',
            ...(item.excluded || artifactExclusion(item.name)
              ? { reason: item.excluded || artifactExclusion(item.name) }
              : {}),
            releaseIds: matches.map((r) => r.id),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name) || a.url.localeCompare(b.url));
      return { id: tracker.id, url: tracker.url, records };
    } catch (error) {
      return { id: tracker.id, url: tracker.url, error: error.message };
    }
  }),
);
const { families, collectionErrors } = await providerReview;
if (!values.offline) await client.save(snapshotPath);
const report = {
  schemaVersion: 1,
  capturedAt: client.snapshot.capturedAt,
  datasetDate: data.updated,
  inputs: {
    releases: sha256(stableJSON(data)),
    sources: sha256(stableJSON(definitions)),
    decisions: sha256(stableJSON(decisions)),
    pending: sha256(stableJSON(pending)),
  },
  scope: { families: data.families.map((f) => f.id), secondaryCatalogs: !values['providers-only'] },
  note: 'Exhaustive traversal of configured inventories, not a claim that the web or catalog is complete. Review missing earlier versions, repository variants, dates, and milestone types. A source failure is not a clean audit. Repository timestamps are not release dates. Prices and capability scores are not imported.',
  families,
  collectionErrors,
  sources,
  pending,
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, stableJSON(report));
for (const family of families)
  console.log(
    `${family.family}: ${family.comparison}; ${family.unrecordedVersions.length} missing version observations, ${family.unreviewedRecordCount} repositories/pages to review, ${family.sources.filter((s) => s.error).length} source failures`,
  );
const needsReview = (r) => r.comparison.startsWith('review-');
for (const source of sources)
  console.log(
    `${source.id}: ${source.error || `${source.records.filter(needsReview).length} candidates to review`}`,
  );
console.log(`${pending.length} known candidates await primary evidence.`);
console.log(`Saved ${values.report}. Source responses: ${values.snapshot}. Catalog unchanged.`);
if (
  pending.length ||
  collectionErrors.length ||
  families.some((f) => f.comparison !== 'configured-inventory-matches') ||
  sources.some((s) => s.error || s.records.some(needsReview))
)
  process.exitCode = 1;
