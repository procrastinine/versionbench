import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { auditProviders } from './provider-audit.mjs';
import {
  fetchPage,
  pageArray,
  normalizedName,
  releaseTrackers,
  gatewayTracker,
} from './source-data.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/releases.json', root), 'utf8'));
const providerSources = JSON.parse(
  await readFile(new URL('data/provider-sources.json', root), 'utf8'),
);
const providerReview = auditProviders(data, providerSources);
const trackers = [...releaseTrackers];
for (let year = 2022; year <= new Date().getUTCFullYear(); year++)
  trackers.push(gatewayTracker(year));
const results = await Promise.allSettled(
  trackers.map(async (tracker) => {
    const html = await fetchPage(tracker.url);
    const rows = tracker.load
      ? await tracker.load(html, tracker.url)
      : pageArray(html, tracker.array);
    if (!rows.length) throw new Error('Empty catalog; check source format');
    return rows.map((row) => {
      const item = tracker.row(row);
      if (typeof item.name !== 'string' || !item.name || typeof item.url !== 'string') {
        throw new Error('Invalid release row; check source format');
      }
      // Match normalized names or verified profile links. Never merge candidates automatically.
      const matches = data.releases.filter(
        (r) =>
          normalizedName(r.name) === normalizedName(item.name) ||
          item.modelURLs?.includes(r.artificialAnalysisUrl),
      );
      return {
        ...item,
        date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : null,
        comparison: !matches.length
          ? 'review-name'
          : matches.some((r) => r.date === item.date)
            ? 'name-or-profile-and-date-match'
            : 'review-date',
        releaseIds: matches.map((r) => r.id),
      };
    });
  }),
);
const sources = results.map((result, index) => ({
  id: trackers[index].id,
  url: trackers[index].url,
  ...(result.status === 'fulfilled' ? { rows: result.value } : { error: result.reason.message }),
}));
const families = await providerReview;
await mkdir(new URL('output/', root), { recursive: true });
await writeFile(
  new URL('output/release-audit.json', root),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      note: 'Discovery only, not a completeness certificate. Check official sources for every family as well as secondary catalogs. Confirm identities, dates, scope, and availability before editing releases.json. No release dates are inferred from model repository timestamps. Prices and benchmark scores are not collected.',
      families,
      sources,
    },
    null,
    2,
  ) + '\n',
);
for (const source of sources)
  console.log(
    source.id,
    source.error ||
      `${source.rows.length} rows; ${source.rows.filter((r) => r.comparison !== 'name-or-profile-and-date-match').length} to review`,
  );
for (const family of families)
  console.log(
    family.family,
    family.comparison,
    family.higherVersions?.map((r) => r.evidence).join(', ') ||
      family.sources
        ?.filter((s) => s.error)
        .map((s) => s.error)
        .join('; ') ||
      '',
  );
console.log('Saved output/release-audit.json. Curated data was not modified.');
if (
  sources.some((source) => source.error) ||
  families.some((family) => family.comparison !== 'no-higher-version-observed')
)
  process.exitCode = 1;
