// Read the embedded dataset and prepare immutable lookup tables and rankings.
export function createCatalog(app) {
  const { safeURL, color, parseDate, isoDate } = app.format;

  const data = JSON.parse(document.getElementById('release-data').textContent);

  const stats = JSON.parse(document.getElementById('stats-data').textContent);

  const pending = JSON.parse(document.getElementById('pending-data').textContent);

  const watchlist = JSON.parse(document.getElementById('watch-data').textContent);

  const familyStats = new Map(
    [...stats.families, ...stats.softwareControls].map((family) => [family.id, family]),
  );

  const families = data.families.map((family) => ({ ...family, color: color(family.color) }));

  const familyMap = new Map(families.map((family) => [family.id, family]));

  const sourceMap = new Map(
    (data.sources || []).map((source) => [source.id, { ...source, url: safeURL(source.url) }]),
  );

  const releases = data.releases
    .filter((release) => familyMap.has(release.family))
    .map((release) => ({
      ...release,
      familyInfo: familyMap.get(release.family),
      source: sourceMap.get(release.sourceId),
      dateSource: sourceMap.get(release.dateSourceId),
      artificialAnalysisUrl: safeURL(release.artificialAnalysisUrl),
      huggingFaceUrl: safeURL(release.huggingFaceUrl),
      weightsSourceUrl: safeURL(release.weightsSourceUrl),
      time: parseDate(release.date),
      score:
        typeof release.score === 'number' && Number.isFinite(release.score) ? release.score : null,
    }));

  const releaseMap = new Map(releases.map((release) => [release.id, release]));

  const numericReleases = releases.filter((release) => release.score !== null);

  const datedReleases = numericReleases.filter((release) => Number.isFinite(release.time));

  const latestDate =
    data.updated || isoDate(Math.max(...datedReleases.map((release) => release.time)));

  const latestTime = Math.max(
    parseDate(latestDate),
    ...datedReleases.map((release) => release.time),
  );

  const modelStartTime = Math.min(
    ...datedReleases
      .filter((release) => release.familyInfo.kind !== 'software')
      .map((release) => release.time),
  );

  const familyPeaks = families
    .map(
      (family) =>
        numericReleases
          .filter((release) => release.family === family.id)
          .sort(
            (a, b) =>
              b.score - a.score ||
              (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31') ||
              a.name.localeCompare(b.name),
          )[0],
    )
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.familyInfo.name.localeCompare(b.familyInfo.name));

  const ranked = familyPeaks.filter((release) => release.familyInfo.kind !== 'software');

  const rankMap = new Map(
    ranked.map((release, index) => [
      release.family,
      ranked.findIndex((other) => other.score === release.score) + 1,
    ]),
  );

  const highestMap = new Map(familyPeaks.map((release) => [release.family, release]));

  const coreIds = families.filter((family) => family.core).map((family) => family.id);

  const weightsOptions = [
    ['all', 'All weight statuses'],
    ['open', 'Open weights'],
    ['not-published', 'No public weights found'],
    ['unverified', 'Weights unverified'],
    ['not-applicable', 'Not applicable (software)'],
  ];

  const statusOptions = [
    ['all', 'All release statuses'],
    ...[...new Set(releases.map((release) => release.status))]
      .sort()
      .map((status) => [status, status]),
  ];

  const kindOptions = [
    ['all', 'Models & software'],
    ['model', 'Models only'],
    ['software', 'Software controls only'],
  ];

  const modeOptions = [
    ['highest', 'Highest to date'],
    ['latest', 'Latest release'],
  ];

  return {
    data,
    stats,
    pending,
    watchlist,
    familyStats,
    families,
    familyMap,
    releases,
    releaseMap,
    datedReleases,
    latestDate,
    latestTime,
    modelStartTime,
    familyPeaks,
    ranked,
    rankMap,
    highestMap,
    coreIds,
    weightsOptions,
    statusOptions,
    kindOptions,
    modeOptions,
  };
}
