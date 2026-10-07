import assert from 'node:assert/strict';
import { paginatedJSON } from './source-snapshot.mjs';
import { numericVersion } from './version.mjs';

export const pythonArchive = 'https://www.python.org/doc/versions/';
export const pytorchReleases = 'https://api.github.com/repos/pytorch/pytorch/releases?per_page=100';
export const softwareScopes = {
  python:
    'All stable Python 3 minor and patch releases from 3.0 in the official release archive. Previews are excluded.',
  pytorch:
    'All numbered PyTorch minor and patch releases in the official GitHub release catalog, including 0.x. Drafts and entries marked prerelease are excluded.',
};
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const order = (a, b) => a.date.localeCompare(b.date) || a.version.localeCompare(b.version);
const canonicalVersion = (version) => (version.split('.').length === 2 ? version + '.0' : version);
const releaseId = (family, version) =>
  `${family}-${canonicalVersion(version).replace(/\.0$/, '').replaceAll('.', '-')}`;

function validDate(date) {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(date + 'T00:00:00Z').toISOString().slice(0, 10), date);
  return date;
}

export function parsePythonArchive(html, asOf) {
  validDate(asOf);
  const releases = [];
  const excluded = [];
  const links =
    /<a\s+href=["'](https:\/\/docs\.python\.org\/release\/([^/"']+)\/)["'][^>]*>\s*Python\s+([^<]+)<\/a>([^<]*)/g;
  for (const match of html.matchAll(links)) {
    const [, url, path, label, suffix] = match;
    const version = label.trim();
    if (!/^3\.\d+(?:\.\d+)?$/.test(version)) continue;
    assert.equal(path, version, `Python archive link disagrees with label: ${version}`);
    const dateParts = suffix.trim().match(/^,\s*released on (\d{1,2}) ([A-Za-z]+) (\d{4})$/);
    assert.ok(dateParts, `Missing Python release date: ${version}`);
    const [, day, month, year] = dateParts;
    assert.ok(months.includes(month), `Unknown release month: ${month}`);
    const date = validDate(
      `${year}-${String(months.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`,
    );
    const row = { version, date, url };
    if (date > asOf) excluded.push({ ...row, reason: 'After dataset snapshot' });
    else releases.push(row);
  }
  assert.ok(releases.length, 'Python archive contains no dated stable Python 3 releases');
  return { releases: releases.sort(order), excluded: excluded.sort(order) };
}

export function parsePytorchReleases(rows, asOf) {
  validDate(asOf);
  const releases = [];
  const excluded = [];
  for (const row of rows) {
    const tag = row.tag_name;
    assert.equal(typeof tag, 'string', 'Missing PyTorch release tag');
    assert.equal(typeof row.draft, 'boolean', `Missing draft status: ${tag}`);
    assert.equal(typeof row.prerelease, 'boolean', `Missing prerelease status: ${tag}`);
    const reason = row.draft
      ? 'Draft'
      : row.prerelease
        ? 'Publisher marks prerelease'
        : !/^v\d+\.\d+\.\d+$/.test(tag)
          ? 'Not a stable major.minor.patch tag'
          : null;
    if (reason) {
      excluded.push({ tag, url: row.html_url, reason });
      continue;
    }
    assert.match(
      row.published_at ?? '',
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
      `Missing publication date: ${tag}`,
    );
    const date = validDate(row.published_at.slice(0, 10));
    assert.equal(row.html_url, `https://github.com/pytorch/pytorch/releases/tag/${tag}`);
    const release = { version: tag.slice(1), date, url: row.html_url };
    if (date > asOf) excluded.push({ tag, ...release, reason: 'After dataset snapshot' });
    else releases.push(release);
  }
  assert.ok(releases.length, 'PyTorch catalog contains no dated non-prerelease versions');
  return {
    releases: releases.sort(order),
    excluded: excluded.sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}

// The raw capture stays in output/. Commit the complete extracted release lists,
// exclusions, pagination URLs, and response hashes so ordinary builds stay offline.
export async function captureSoftwareCatalog(client, asOf) {
  const responses = await Promise.allSettled([
    client.text(pythonArchive),
    paginatedJSON(client, pytorchReleases),
  ]);
  const errors = responses.filter((r) => r.status === 'rejected').map((r) => r.reason);
  if (errors.length) throw new AggregateError(errors, errors.map((e) => e.message).join('; '));
  const [python, pytorch] = responses.map((r) => r.value);
  const catalog = (family, url, pages, parsed) => ({
    family,
    url,
    pages: pages.map((page) => ({ url: page, sha256: client.snapshot.requests[page].sha256 })),
    ...parsed,
  });
  const evidence = {
    schemaVersion: 1,
    asOf: validDate(asOf),
    capturedAt: client.snapshot.capturedAt,
    catalogs: [
      catalog('python', pythonArchive, [pythonArchive], parsePythonArchive(python, asOf)),
      catalog('pytorch', pytorchReleases, pytorch.pages, parsePytorchReleases(pytorch.rows, asOf)),
    ],
  };
  validateSoftwareEvidence(evidence);
  return evidence;
}

export function validateSoftwareEvidence(evidence) {
  assert.equal(evidence.schemaVersion, 1, 'Unsupported software evidence schema');
  validDate(evidence.asOf);
  assert.deepEqual(evidence.catalogs.map((c) => c.family).sort(), ['python', 'pytorch']);
  for (const catalog of evidence.catalogs) {
    assert.equal(catalog.url, catalog.family === 'python' ? pythonArchive : pytorchReleases);
    assert.equal(catalog.pages[0]?.url, catalog.url, 'Missing first catalog page');
    assert.equal(new Set(catalog.pages.map((p) => p.url)).size, catalog.pages.length);
    for (const page of catalog.pages) {
      assert.equal(new URL(page.url).origin, new URL(catalog.url).origin);
      assert.match(page.sha256, /^[a-f0-9]{64}$/);
    }
    assert.ok(catalog.releases.length, `Empty software catalog: ${catalog.family}`);
    const versions = new Set();
    for (const release of catalog.releases) {
      assert.match(
        release.version,
        catalog.family === 'python' ? /^3\.\d+(?:\.\d+)?$/ : /^\d+\.\d+\.\d+$/,
      );
      validDate(release.date);
      assert.ok(release.date <= evidence.asOf, `Future software release: ${release.version}`);
      const key = canonicalVersion(release.version);
      assert.ok(!versions.has(key), `Duplicate ${catalog.family} version: ${release.version}`);
      versions.add(key);
      assert.equal(
        release.url,
        catalog.family === 'python'
          ? `https://docs.python.org/release/${release.version}/`
          : `https://github.com/pytorch/pytorch/releases/tag/v${release.version}`,
      );
    }
    if (catalog.family === 'python')
      assert.ok(versions.has('3.0.0'), 'Missing initial Python 3.0 release');
  }
}

export function syncSoftwareReleases(input, evidence) {
  validateSoftwareEvidence(evidence);
  assert.ok(evidence.asOf <= input.updated, 'Software evidence is newer than the dataset snapshot');
  const data = structuredClone(input);
  const upsertSource = (source) => {
    const prior = data.sources.find((s) => s.url === source.url);
    if (prior) {
      Object.assign(prior, { ...source, id: prior.id });
      return prior.id;
    }
    assert.ok(!data.sources.some((s) => s.id === source.id), `Source ID conflict: ${source.id}`);
    data.sources.push(source);
    return source.id;
  };
  for (const catalog of evidence.catalogs) {
    const family = data.families.find((f) => f.id === catalog.family);
    assert.equal(family?.kind, 'software', `Missing software control: ${catalog.family}`);
    family.scope = softwareScopes[family.id];
    const priorRows = data.releases.filter((r) => r.family === family.id);
    const priorByVersion = new Map(priorRows.map((r) => [canonicalVersion(r.version), r]));
    assert.equal(priorByVersion.size, priorRows.length, `Duplicate ${family.name} versions`);
    const expected = new Set(catalog.releases.map((r) => canonicalVersion(r.version)));
    for (const version of priorByVersion.keys())
      assert.ok(
        expected.has(version),
        `Saved catalog omits existing ${family.name} ${version}; review before applying`,
      );
    const dateSourceId =
      family.id === 'python'
        ? upsertSource({
            id: 'python-release-archive',
            title: 'Python documentation by release version',
            url: pythonArchive,
            publisher: family.provider,
            checkedAt: evidence.asOf,
          })
        : null;
    const releases = catalog.releases.map((release) => {
      const { version, date, url } = release;
      const prior = priorByVersion.get(canonicalVersion(version));
      const id = prior?.id ?? releaseId(family.id, version);
      const sourceId = upsertSource({
        id: `${id}-release`,
        title: `${family.name} ${version} ${family.id === 'python' ? 'documentation' : 'release notes'}`,
        url,
        publisher: family.provider,
        date,
        checkedAt: evidence.asOf,
      });
      return {
        id,
        family: family.id,
        name: `${family.name} ${version}`,
        version,
        score: numericVersion(version),
        date,
        status: 'Released',
        eventType: 'release',
        sourceId,
        ...(dateSourceId ? { dateSourceId } : {}),
        weightsStatus: 'not-applicable',
        weightsCheckedAt: evidence.asOf,
        weightsSourceUrl: url,
        weightsNote: 'Software release; model weights do not apply.',
        note:
          family.id === 'python'
            ? 'Stable release; date from the official Python release archive.'
            : 'Date is the publisher’s GitHub release publication date in UTC. The entry is not marked prerelease.',
        mapping: `Software control: keep the first decimal point and concatenate later version segments (${version} = ${numericVersion(version)}).`,
      };
    });
    data.releases = [...data.releases.filter((r) => r.family !== family.id), ...releases];
  }
  data.sources.sort((a, b) => a.id.localeCompare(b.id));
  data.releases.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.family.localeCompare(b.family) ||
      a.name.localeCompare(b.name),
  );
  return data;
}

export function validateSoftwareCoverage(data, evidence) {
  const expected = syncSoftwareReleases(data, evidence);
  const owns = (r) => Object.hasOwn(softwareScopes, r.family ?? r.id);
  const sourceIds = new Set(
    expected.releases
      .filter(owns)
      .flatMap((r) => [r.sourceId, r.dateSourceId])
      .filter(Boolean),
  );
  const byId = (rows) => rows.sort((a, b) => a.id.localeCompare(b.id));
  const controlled = (catalog) => ({
    families: byId(catalog.families.filter(owns)),
    releases: byId(catalog.releases.filter(owns)),
    sources: byId(catalog.sources.filter((s) => sourceIds.has(s.id))),
  });
  assert.deepEqual(
    controlled(data),
    controlled(expected),
    'Software releases differ from saved evidence; run node scripts/import-software.mjs --apply',
  );
}
