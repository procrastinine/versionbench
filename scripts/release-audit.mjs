import { stableJSON, sha256 } from './source-snapshot.mjs';
import { auditInventory } from './source-inventory.mjs';
import { pageArray, normalizedName, releaseTrackers, gatewayTracker } from './source-data.mjs';
import { artifactExclusion } from './release-policy.mjs';

export const needsReleaseReview = (record) => record.comparison.startsWith('review-');
export const releaseAuditNeedsReview = (report) =>
  !!(
    report.pending.length ||
    report.collectionErrors.length ||
    report.families.some((family) => family.comparison !== 'configured-inventory-matches') ||
    report.sources.some((source) => source.error || source.records.some(needsReleaseReview))
  );

export async function buildReleaseAudit(
  client,
  data,
  definitions,
  decisions,
  pending,
  { providersOnly = false } = {},
) {
  for (const family of data.families)
    if (
      !definitions.some(
        (definition) => definition.family === family.id && definition.sources.length,
      )
    )
      throw new Error(`Missing watchlist: ${family.id}`);
  const providerReview = auditInventory(client, data, definitions, decisions);
  const trackers = providersOnly ? [] : [...releaseTrackers];
  if (!providersOnly)
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
              (release) =>
                names.includes(normalizedName(release.name)) ||
                item.modelURLs?.includes(release.artificialAnalysisUrl) ||
                (item.huggingFaceUrl && item.huggingFaceUrl === release.huggingFaceUrl),
            );
            const reason = item.excluded || artifactExclusion(item.name);
            return {
              ...item,
              date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : null,
              comparison: item.excluded
                ? 'excluded-alias'
                : reason
                  ? 'excluded-artifact'
                  : !matches.length
                    ? 'review-name'
                    : item.dateBasis === 'gateway-listing'
                      ? 'model-linked-listing-date-separate'
                      : matches.some((release) => release.date === item.date)
                        ? 'name-or-profile-and-date-match'
                        : 'review-date',
              ...(reason ? { reason } : {}),
              releaseIds: matches.map((release) => release.id),
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
  return {
    schemaVersion: 1,
    capturedAt: client.snapshot.capturedAt,
    datasetDate: data.updated,
    inputs: {
      releases: sha256(stableJSON(data)),
      sources: sha256(stableJSON(definitions)),
      decisions: sha256(stableJSON(decisions)),
      pending: sha256(stableJSON(pending)),
    },
    scope: {
      families: data.families.map((family) => family.id),
      secondaryCatalogs: !providersOnly,
    },
    note: 'Exhaustive traversal of configured inventories, not a claim that the web or catalog is complete. Review missing earlier versions, repository variants, dates, and milestone types. A source failure is not a clean audit. Repository timestamps are not release dates. Prices and capability scores are not imported.',
    families,
    collectionErrors,
    sources,
    pending,
  };
}
