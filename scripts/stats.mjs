const DAY = 86400000;
export const DAYS_PER_YEAR = 365.2425;
const utcDay = (date) => Date.parse(`${date}T00:00:00Z`) / DAY;

// Every event on a UTC day takes effect together. Families enter at their first
// recorded event; their best numeric score persists, including across regressions.
// Software controls are reference data and never enter the competition.
export function historicalRanks(data) {
  const end = utcDay(data.updated) + 1;
  const events = new Map();
  const totals = new Map(
    data.families
      .filter((family) => family.kind !== 'software')
      .map(({ id }) => [id, { trackedDays: 0, rankDays: 0, daysAtNumberOne: 0, rankHistory: [] }]),
  );
  const controls = new Set(
    data.families.filter((family) => family.kind === 'software').map((family) => family.id),
  );
  for (const release of data.releases) {
    const day = utcDay(release.date);
    if (!Number.isFinite(day) || day >= end)
      throw new Error(`Release outside snapshot: ${release.id}`);
    if (controls.has(release.family)) continue;
    if (!totals.has(release.family)) throw new Error(`Unknown family: ${release.family}`);
    if (!events.has(day)) events.set(day, []);
    events.get(day).push(release);
  }
  const days = [...events.keys()].sort((a, b) => a - b);
  const highest = new Map();
  for (const [index, day] of days.entries()) {
    for (const release of events.get(day))
      highest.set(
        release.family,
        Math.max(highest.get(release.family) ?? -Infinity, release.score),
      );
    const duration = (days[index + 1] ?? end) - day;
    for (const [family, score] of highest) {
      const rank = 1 + [...highest.values()].filter((other) => other > score).length;
      const total = totals.get(family);
      if (total.rankHistory.at(-1)?.rank !== rank)
        total.rankHistory.push({ date: new Date(day * DAY).toISOString().slice(0, 10), rank });
      total.trackedDays += duration;
      total.rankDays += rank * duration;
      if (rank === 1) total.daysAtNumberOne += duration;
      total.currentRank = rank;
    }
  }
  return new Map(
    [...totals].map(([id, { rankDays, ...total }]) => [
      id,
      {
        ...total,
        averageRank: total.trackedDays ? rankDays / total.trackedDays : null,
      },
    ]),
  );
}

export function buildStats(data) {
  const ranks = historicalRanks(data);
  const models = data.families.filter((family) => family.kind !== 'software');
  const controls = data.families.filter((family) => family.kind === 'software');
  const modelIds = new Set(models.map((family) => family.id));
  const modelReleases = data.releases.filter((release) => modelIds.has(release.family));
  const sourceIds = new Set(
    modelReleases.flatMap((release) => [release.sourceId, release.dateSourceId]).filter(Boolean),
  );
  const byYear = {};
  const byStatus = {};
  const byWeightsStatus = {};
  for (const release of modelReleases) {
    const year = release.date.slice(0, 4);
    byYear[year] = (byYear[year] || 0) + 1;
    byStatus[release.status] = (byStatus[release.status] || 0) + 1;
    byWeightsStatus[release.weightsStatus] = (byWeightsStatus[release.weightsStatus] || 0) + 1;
  }
  const dates = modelReleases.map((release) => release.date).sort();
  const linked = modelReleases.filter((release) => release.artificialAnalysisUrl);
  const weights = modelReleases.filter((release) => release.huggingFaceUrl);
  const summaries = data.families.map((family) => {
    const releases = data.releases.filter((release) => release.family === family.id);
    if (!releases.length) throw new Error(`Cannot summarize empty family: ${family.id}`);
    const highestScore = Math.max(...releases.map((release) => release.score));
    const first = releases
      .filter((release) => release.score === highestScore)
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))[0];
    const chronological = [...releases].sort(
      (a, b) => a.date.localeCompare(b.date) || b.score - a.score || a.name.localeCompare(b.name),
    );
    const lastDate = chronological.at(-1).date;
    const latest = chronological.find((release) => release.date === lastDate);
    const history = ranks.get(family.id);
    return {
      id: family.id,
      name: family.name,
      kind: family.kind || 'model',
      releaseCount: releases.length,
      versionCount: new Set(releases.map((release) => release.version)).size,
      highestVersion: first.version,
      highestScore,
      firstReleaseAtHighestVersion: { id: first.id, name: first.name, date: first.date },
      latestRelease: {
        id: latest.id,
        name: latest.name,
        version: latest.version,
        score: latest.score,
        date: latest.date,
      },
      firstEventDate: chronological[0].date,
      lastEventDate: lastDate,
      ...(history
        ? {
            ...history,
            releaseRatePerYear: releases.length / (history.trackedDays / DAYS_PER_YEAR),
          }
        : {}),
      artificialAnalysisReleaseCount: releases.filter((r) => r.artificialAnalysisUrl).length,
      huggingFaceReleaseCount: releases.filter((r) => r.huggingFaceUrl).length,
    };
  });
  return {
    snapshot: data.updated,
    scope:
      'Model families only. Software controls are reported separately and excluded from all model statistics and ranks.',
    familyCount: models.length,
    softwareControlCount: controls.length,
    releaseCount: modelReleases.length,
    softwareReleaseCount: data.releases.length - modelReleases.length,
    sourceCount: sourceIds.size,
    artificialAnalysisReleaseCount: linked.length,
    artificialAnalysisProfileCount: new Set(linked.map((r) => r.artificialAnalysisUrl)).size,
    huggingFaceReleaseCount: weights.length,
    huggingFaceLinkCount: new Set(weights.map((r) => r.huggingFaceUrl)).size,
    releasesByWeightsStatus: Object.fromEntries(Object.entries(byWeightsStatus).sort()),
    firstEventDate: dates[0] ?? null,
    lastEventDate: dates.at(-1) ?? null,
    releasesByYear: Object.fromEntries(Object.entries(byYear).sort()),
    releasesByStatus: Object.fromEntries(Object.entries(byStatus).sort()),
    families: summaries.filter((family) => family.kind !== 'software'),
    softwareControls: summaries.filter((family) => family.kind === 'software'),
  };
}

export function statsSummary(stats) {
  return `Snapshot **${stats.snapshot}** · **${stats.familyCount} model families** · **${stats.releaseCount} model release events** · **${stats.sourceCount} model sources** · **${stats.artificialAnalysisReleaseCount} releases linked to Artificial Analysis** · **${stats.huggingFaceReleaseCount} releases linked to Hugging Face weights**\n\nSeparately: **${stats.softwareControlCount} software controls**, **${stats.softwareReleaseCount} release events**. Controls are excluded from model statistics and rankings.`;
}

export const readmeTemplates = [
  ['docs/templates/README.md', 'README.md'],
  ['docs/templates/data-README.md', 'data/README.md'],
];

export function renderReadme(template, stats, sourcePath) {
  if (template.split('{{STATS_SUMMARY}}').length !== 2)
    throw new Error(`Expected exactly one stats placeholder in ${sourcePath}`);
  return (
    `<!-- Generated by scripts/generate.mjs. Edit ${sourcePath} instead. -->\n\n` +
    template.replace('{{STATS_SUMMARY}}', () => statsSummary(stats))
  );
}
