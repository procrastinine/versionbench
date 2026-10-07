import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStats, DAYS_PER_YEAR, versionHistory } from './stats.mjs';

const event = (family, version, date, name = `${family} ${version}`) => ({
  id: `${family}-${version}-${date}-${name}`,
  family,
  name,
  version,
  score: Number(version),
  date,
  status: 'Released',
  weightsStatus: 'not-applicable',
});
const catalog = (releases, updated = '2026-01-10') => ({
  updated,
  sources: [],
  releases,
  families: [...new Set(releases.map((r) => r.family))].map((id) => ({
    id,
    name: id,
    kind: id === 'python' ? 'software' : 'model',
  })),
});

test('historical ranks weight elapsed days, include entrants only after release, and share ties', () => {
  const stats = buildStats(
    catalog([
      event('a', '1', '2026-01-01'),
      event('b', '2', '2026-01-03'),
      event('a', '2', '2026-01-05'),
      event('c', '3', '2026-01-07'),
    ]),
  );
  const [a, b, c] = stats.families;
  // a ranks 1 for Jan 1–2, 2 for Jan 3–4, 1 for Jan 5–6, 2 for Jan 7–10.
  assert.deepEqual(
    [a.trackedDays, a.daysAtNumberOne, a.averageRank, a.currentRank],
    [10, 4, 1.6, 2],
  );
  assert.deepEqual(
    [b.trackedDays, b.daysAtNumberOne, b.averageRank, b.currentRank],
    [8, 4, 1.5, 2],
  );
  assert.deepEqual([c.trackedDays, c.daysAtNumberOne, c.averageRank, c.currentRank], [4, 4, 1, 1]);
  assert.equal(a.releaseRatePerYear, 2 / (10 / DAYS_PER_YEAR));
  assert.deepEqual(a.rankHistory, [
    { date: '2026-01-01', rank: 1 },
    { date: '2026-01-03', rank: 2 },
    { date: '2026-01-05', rank: 1 },
    { date: '2026-01-07', rank: 2 },
  ]);
  assert.deepEqual(c.rankHistory, [{ date: '2026-01-07', rank: 1 }]);
});

test('software is excluded from model statistics; decimal regressions preserve its highest score and earliest representative', () => {
  const stats = buildStats(
    catalog([
      event('python', '3.1', '2026-01-01'),
      event('python', '3.9', '2026-01-02', 'Z release'),
      event('python', '3.9', '2026-01-02', 'A release'),
      event('python', '3.10', '2026-01-03'),
      event('model', '3.5', '2026-01-01'),
      event('python', '3.9', '2026-01-04', 'Later variant'),
      event('python', '3.11', '2026-01-05'),
    ]),
  );
  const [model] = stats.families;
  const [python] = stats.softwareControls;
  assert.equal(python.highestScore, 3.9);
  assert.equal(python.firstReleaseAtHighestVersion.name, 'A release');
  assert.equal(python.latestRelease.version, '3.11');
  assert.equal(python.versionCount, 4); // Published 3.1 and 3.10 remain distinct labels.
  assert.equal(python.daysAtNumberOne, undefined);
  assert.equal(python.averageRank, undefined);
  assert.equal(python.rankHistory, undefined);
  assert.equal(model.currentRank, 1);
  assert.equal(model.daysAtNumberOne, 10);
  assert.equal(model.averageRank, 1);
  assert.equal(stats.familyCount, 1);
  assert.equal(stats.releaseCount, 1);
  assert.equal(stats.softwareControlCount, 1);
  assert.equal(stats.softwareReleaseCount, 6);
  assert.deepEqual(
    stats.families,
    buildStats(catalog([event('model', '3.5', '2026-01-01')])).families,
  );
});

test('same-day events take effect together; tied ranks skip positions and are order independent', () => {
  const rows = [
    event('a', '3', '2026-01-10'),
    event('b', '3', '2026-01-10'),
    event('c', '2', '2026-01-10'),
  ];
  const stats = buildStats(catalog(rows));
  const reversed = buildStats(catalog([...rows].reverse()));
  for (const family of stats.families) {
    assert.deepEqual(
      family,
      reversed.families.find((f) => f.id === family.id),
    );
    assert.equal(family.trackedDays, 1); // Snapshot day is included, so new entrants have defined rates.
    assert.equal(family.releaseRatePerYear, DAYS_PER_YEAR);
  }
  assert.deepEqual(
    stats.families.map((f) => f.currentRank),
    [1, 1, 3],
  );
  assert.deepEqual(
    stats.families.map((f) => f.daysAtNumberOne),
    [1, 1, 0],
  );
});

test('snapshot bounds and empty families cannot silently produce misleading statistics', () => {
  assert.throws(() => buildStats(catalog([event('a', '1', '2026-01-11')])), /outside snapshot/);
  const data = catalog([event('a', '1', '2026-01-01')]);
  data.families.push({ id: 'empty', name: 'Empty' });
  assert.throws(() => buildStats(data), /empty family/);
});

test('a model keeps its historical maximum when a newer published version is numerically lower', () => {
  const data = catalog([
    event('a', '3.9', '2026-01-01'),
    event('b', '3.5', '2026-01-02'),
    event('a', '3.10', '2026-01-03'),
  ]);
  const [a, b] = buildStats(data).families;
  assert.equal(a.latestRelease.version, '3.10');
  assert.equal(a.highestScore, 3.9);
  assert.equal(a.averageRank, 1);
  assert.equal(a.daysAtNumberOne, 10);
  assert.equal(b.averageRank, 2);
});

test('version overlays use the same daily maximum as ranks; software exposes regressions without ranks', () => {
  const rows = [
    event('a', '2', '2026-01-01'),
    event('a', '3.9', '2026-01-02'),
    event('a', '3.5', '2026-01-02'),
    event('a', '3.10', '2026-01-03'),
  ];
  assert.deepEqual(
    versionHistory(rows).map((r) => [r.date, r.score]),
    [
      ['2026-01-01', 2],
      ['2026-01-02', 3.9],
    ],
  );
  assert.deepEqual(versionHistory(rows), versionHistory([...rows].reverse()));
  const stats = buildStats(
    catalog([...rows, event('python', '3.9', '2026-01-02'), event('python', '3.10', '2026-01-03')]),
  );
  assert.deepEqual(
    stats.softwareControls[0].versionHistory.map((r) => r.score),
    [3.9, 3.1],
  );
  assert.equal(stats.softwareControls[0].rankHistory, undefined);
  assert.deepEqual(stats.families[0].versionHistory, versionHistory(rows));
});
