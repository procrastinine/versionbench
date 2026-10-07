import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceSnapshot, sha256 } from './source-snapshot.mjs';
import {
  pythonArchive,
  pytorchReleases,
  parsePythonArchive,
  parsePytorchReleases,
  captureSoftwareCatalog,
  syncSoftwareReleases,
  validateSoftwareCoverage,
} from './software-releases.mjs';
import { buildStats } from './stats.mjs';

const pythonRow = (version, date) =>
  `<li><a href="https://docs.python.org/release/${version}/">Python ${version}</a>, released on ${date}</li>`;
const torchRow = (version, date, extra = {}) => ({
  tag_name: `v${version}`,
  html_url: `https://github.com/pytorch/pytorch/releases/tag/v${version}`,
  published_at: `${date}T12:00:00Z`,
  draft: false,
  prerelease: false,
  ...extra,
});
const source = (body, headers = {}) => ({ status: 200, body, sha256: sha256(body), headers });
const fixtureClient = () =>
  new SourceSnapshot(
    {
      schemaVersion: 1,
      capturedAt: '2026-10-06T12:00:00Z',
      requests: {
        [pythonArchive]: source(
          pythonRow('3.0', '3 December 2008') + pythonRow('3.9.10', '14 January 2022'),
        ),
        [pytorchReleases]: source(JSON.stringify([torchRow('2.9.1', '2025-11-12')]), {
          link: '<https://api.github.com/repos/pytorch/pytorch/releases?page=2>; rel="next"',
        }),
        'https://api.github.com/repos/pytorch/pytorch/releases?page=2': source(
          JSON.stringify([torchRow('0.1.6', '2017-02-02')]),
        ),
      },
    },
    {
      offline: true,
      fetcher: () => {
        throw new Error('Unexpected network request');
      },
    },
  );

test('Python parser retains every stable patch label, uses stated dates, and excludes previews and future releases', () => {
  const result = parsePythonArchive(
    [
      pythonRow('3.0', '3 December 2008'),
      pythonRow('3.9.9', '15 November 2021'),
      pythonRow('3.9.10', '14 January 2022'),
      pythonRow('3.10.0', '4 October 2021'),
      pythonRow('3.15.0rc3', '1 October 2026'),
      pythonRow('3.15.0', '7 October 2026'),
      pythonRow('2.7.18', '20 April 2020'),
    ].join('\n'),
    '2026-10-06',
  );
  assert.deepEqual(
    result.releases.map((r) => r.version),
    ['3.0', '3.10.0', '3.9.9', '3.9.10'],
  );
  assert.equal(result.releases.at(-1).date, '2022-01-14');
  assert.equal(result.excluded[0].version, '3.15.0');
  assert.throws(() => parsePythonArchive(pythonRow('3.9.10', '31 February 2022'), '2026-10-06'));
  assert.throws(
    () => parsePythonArchive(pythonRow('3.9.10', 'unknown'), '2026-10-06'),
    /Missing Python release date/,
  );
  assert.throws(
    () => parsePythonArchive('<html>unavailable</html>', '2026-10-06'),
    /no dated stable/,
  );
});

test('PyTorch parser includes early 0.x and patches, checks release flags, and never substitutes commit dates', () => {
  const result = parsePytorchReleases(
    [
      torchRow('0.1.5', '2016-11-18', { prerelease: true }),
      torchRow('0.1.6', '2017-02-02'),
      torchRow('2.9.1', '2025-11-12'),
      torchRow('2.15.0rc1', '2026-10-01'),
      torchRow('2.15.0', '2026-10-01', { draft: true }),
      torchRow('2.15.1', '2026-10-07'),
    ],
    '2026-10-06',
  );
  assert.deepEqual(
    result.releases.map((r) => r.version),
    ['0.1.6', '2.9.1'],
  );
  assert.equal(result.excluded.length, 4);
  assert.throws(
    () =>
      parsePytorchReleases(
        [
          torchRow('2.9.1', '2025-11-12', {
            published_at: null,
            created_at: '2025-01-01T00:00:00Z',
          }),
        ],
        '2026-10-06',
      ),
    /Missing publication date/,
  );
  assert.throws(
    () =>
      parsePytorchReleases(
        [torchRow('2.9.1', '2025-11-12', { prerelease: undefined })],
        '2026-10-06',
      ),
    /Missing prerelease status/,
  );
});

test('software capture replays every pagination link offline and fails on missing pages', async () => {
  const client = fixtureClient();
  const catalog = await captureSoftwareCatalog(client, '2026-10-06');
  assert.equal(catalog.catalogs[1].pages.length, 2);
  assert.deepEqual(
    catalog.catalogs[1].releases.map((r) => r.version),
    ['0.1.6', '2.9.1'],
  );
  const incomplete = fixtureClient();
  delete incomplete.snapshot.requests[
    'https://api.github.com/repos/pytorch/pytorch/releases?page=2'
  ];
  await assert.rejects(
    captureSoftwareCatalog(incomplete, '2026-10-06'),
    /Missing from offline snapshot/,
  );
});

test('software import preserves legacy links and tied labels, is idempotent, and refuses omissions', async () => {
  const evidence = await captureSoftwareCatalog(fixtureClient(), '2026-10-06');
  evidence.catalogs[0].releases.push({
    version: '3.9.1',
    date: '2020-12-07',
    url: 'https://docs.python.org/release/3.9.1/',
  });
  const data = {
    updated: '2026-10-06',
    sources: [],
    families: ['python', 'pytorch'].map((id) => ({ id, name: id, provider: id, kind: 'software' })),
    releases: [{ id: 'python-original-link', family: 'python', version: '3.0' }],
  };
  const imported = syncSoftwareReleases(data, evidence);
  assert.equal(imported.releases[0].id, 'python-original-link');
  assert.equal(imported.releases.filter((r) => r.score === 3.91).length, 2);
  assert.deepEqual(syncSoftwareReleases(imported, evidence), imported);
  assert.equal(data.releases.length, 1, 'Importer must not mutate its input');
  const omitted = structuredClone(evidence);
  omitted.catalogs[0].releases = omitted.catalogs[0].releases.filter((r) => r.version !== '3.9.10');
  assert.throws(() => syncSoftwareReleases(imported, omitted), /omits existing python 3.9.10/);
  const duplicate = structuredClone(evidence);
  duplicate.catalogs[0].releases.push({
    version: '3.0.0',
    date: '2008-12-03',
    url: 'https://docs.python.org/release/3.0.0/',
  });
  assert.throws(() => syncSoftwareReleases(imported, duplicate), /Duplicate python version/);
});

test('committed catalogs match every software release; patches cannot change model ranks or statistics', async () => {
  const data = JSON.parse(await readFile(new URL('../data/releases.json', import.meta.url)));
  const evidence = JSON.parse(
    await readFile(new URL('../data/evidence/software-releases.json', import.meta.url)),
  );
  validateSoftwareCoverage(data, evidence);
  validateSoftwareCoverage({ ...data, releases: [...data.releases].reverse() }, evidence);
  const incomplete = structuredClone(data);
  incomplete.releases = incomplete.releases.filter((r) => r.id !== 'python-3-9-10');
  assert.throws(() => validateSoftwareCoverage(incomplete, evidence), /Software releases differ/);
  const withoutSoftware = {
    ...data,
    families: data.families.filter((f) => f.kind !== 'software'),
    releases: data.releases.filter(
      (r) => data.families.find((f) => f.id === r.family).kind !== 'software',
    ),
  };
  const allStats = buildStats(data);
  const modelStats = buildStats(withoutSoftware);
  for (const key of Object.keys(modelStats).filter(
    (key) => !['softwareControls', 'softwareControlCount', 'softwareReleaseCount'].includes(key),
  ))
    assert.deepEqual(allStats[key], modelStats[key], `Controls changed model statistic: ${key}`);
});
