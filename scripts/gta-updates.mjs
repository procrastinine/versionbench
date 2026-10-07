import assert from 'node:assert/strict';
import { sha256, stableJSON } from './source-snapshot.mjs';
import { pageText } from './provider-audit.mjs';

export const gtaHistory =
  'https://gta.fandom.com/wiki/Grand_Theft_Auto_V/Title_Update_Notes#Version_History';
export const gtaHistoryAPI =
  'https://gta.fandom.com/api.php?action=parse&page=Grand_Theft_Auto_V%2FTitle_Update_Notes&prop=wikitext&format=json&formatversion=2';
export const gtaScope =
  'GTA V platform releases, rereleases, and title updates in the saved GTA Wiki version history. Every release scores 5. Weekly content events are excluded.';
const prefix = 'gta-v-update-';
const platforms = [
  'PS3 / Xbox 360',
  'PS4 / Xbox One',
  'PC Legacy',
  'PS5 / Xbox Series X|S / PC Enhanced',
];
const normalize = (text) =>
  text
    .replaceAll('{{!}}', '|')
    .replace(
      /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
      (_, target, label) => label ?? target.replaceAll('_', ' '),
    )
    .replace(/https?:[^\s|}\]]+/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/'{2,}/g, '')
    .replace(/[\u200b=]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const isoDate = (date) => {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(date + 'T00:00:00Z').toISOString().slice(0, 10), date);
  return date;
};
const owns = (r) => r.id.startsWith(prefix);

// This is a parser for this one documented table, not a general wiki renderer.
// Reject structural changes instead of silently dropping unrecognized rows.
export function parseGtaHistory(wikitext) {
  const section = wikitext.split('==Version History==')[1];
  assert.ok(section?.includes('|}'), 'Missing GTA version-history table');
  const blocks = section.split('|}')[0].split(/^\|-\s*$/m);
  assert.match(blocks[1] ?? '', /Release Date[\s\S]*PS3[\s\S]*PS4[\s\S]*PC[\s\S]*PS5/);
  const updates = [],
    excluded = [];
  let carriedDate,
    remaining = 0;
  for (const [index, raw] of blocks.slice(2).entries()) {
    const cells = raw
      .trim()
      .split(/^\|/m)
      .slice(1)
      .map((cell) =>
        cell
          .trim()
          .replace(/^(?:(?:style|rowspan|colspan)\s*=)[^\n]*?\|/, '')
          .trim(),
      );
    const uncertain = cells[0]?.match(/^\{\{H:title\|([^|]+)\|([^}]+)\}\}$/);
    const printed = uncertain ? uncertain[2] : cells[0];
    const parts = printed?.match(/^(\d{1,2}) ([A-Za-z]+) (\d{2}|\d{4})$/);
    let date;
    if (parts) {
      const month =
        [
          'jan',
          'feb',
          'mar',
          'apr',
          'may',
          'jun',
          'jul',
          'aug',
          'sep',
          'oct',
          'nov',
          'dec',
        ].indexOf(parts[2].slice(0, 3).toLowerCase()) + 1;
      assert.ok(month, `Unknown GTA release month: ${parts[2]}`);
      date = isoDate(
        `${parts[3].length === 2 ? '20' + parts[3] : parts[3]}-${String(month).padStart(2, '0')}-${parts[1].padStart(2, '0')}`,
      );
      carriedDate = date;
      remaining = Number(raw.match(/^\|[^\n]*rowspan="(\d+)"/m)?.[1] ?? 1) - 1;
    } else {
      assert.ok(remaining > 0, `Missing date in GTA history row ${index + 1}`);
      date = carriedDate;
      remaining--;
    }
    const paths = [
      ...new Set(
        [
          ...raw.matchAll(
            /\[\[(Grand[ _]Theft[ _]Auto[ _]V\/Title[ _]Update[ _]Notes\/Update-[^|\]]+)\|/g,
          ),
        ].map((m) => m[1].replaceAll(' ', '_')),
      ),
    ];
    const text = normalize(cells.slice(1).join(' '));
    if (!paths.length) {
      assert.ok(!/Title Update|Build \d/i.test(text), `Unrecognized title-update row: ${date}`);
      excluded.push({
        row: index + 1,
        date,
        reason: /\bRelease\b/i.test(text)
          ? 'Platform launch already recorded'
          : 'In-game content event, not a title update',
      });
      continue;
    }
    assert.equal(cells.length, 5, `Changed platform columns: ${date}`);
    const versions = [...new Set(text.match(/\b\d+(?:\.\d+)+\b/g) ?? [])];
    assert.ok(versions.length, `Missing title-update label: ${date}`);
    const title = raw.match(/===\[\[([^\]]+)\]\]===/)?.[1]?.replace(/^GTA Online: /, '');
    updates.push({
      id: `${prefix}${date}-${versions.join('-').replaceAll('.', '-')}`,
      row: index + 1,
      rowDate: date,
      date,
      versions,
      ...(title ? { title } : {}),
      ...(uncertain ? { uncertainty: uncertain[1] } : {}),
      platforms: cells
        .slice(1)
        .flatMap((cell, i) =>
          /Title[ _]Update[ _]Notes\/Update-/.test(cell) ? [platforms[i]] : [],
        ),
      notesUrls: paths.map((path) => `https://gta.fandom.com/wiki/${path}`),
    });
  }
  assert.ok(updates.length, 'No GTA title updates found');
  assert.equal(new Set(updates.map((r) => r.id)).size, updates.length, 'Duplicate GTA update rows');
  return { rowCount: blocks.length - 2, updates, excluded };
}

export async function captureGtaUpdates(client, asOf, reviews) {
  isoDate(asOf);
  const urls = [
    ...new Set([
      gtaHistoryAPI,
      ...reviews.flatMap((r) => r.evidence.map((e) => e.fetchUrl ?? e.url)),
    ]),
  ];
  const responses = await Promise.allSettled(urls.map((url) => client.request(url)));
  const errors = responses.filter((r) => r.status === 'rejected').map((r) => r.reason);
  if (errors.length) throw new AggregateError(errors, errors.map((e) => e.message).join('; '));
  const saved = new Map(urls.map((url, i) => [url, responses[i].value]));
  const wikitext = JSON.parse(saved.get(gtaHistoryAPI).body).parse?.wikitext;
  assert.equal(typeof wikitext, 'string', 'Missing GTA history wikitext');
  const parsed = parseGtaHistory(wikitext);
  for (const review of reviews) {
    const matches = parsed.updates.filter(
      (r) => r.rowDate === review.rowDate && stableJSON(r.versions) === stableJSON(review.versions),
    );
    assert.equal(
      matches.length,
      1,
      'Date/version review no longer matches the table; review the changed source',
    );
    const row = matches[0];
    row.review = {
      reason: review.reason,
      evidence: review.evidence.map((e) => {
        const response = saved.get(e.fetchUrl ?? e.url);
        const body = e.fetchUrl?.includes('api.php')
          ? JSON.parse(response.body).parse.wikitext
          : pageText(response.body);
        const proof = body.match(new RegExp(e.pattern))?.[0];
        assert.ok(proof, `Missing reviewed date evidence: ${e.url}`);
        return {
          url: e.url,
          title: e.title,
          publisher: e.publisher,
          sha256: response.sha256,
          proof,
        };
      }),
    };
    if (review.date) row.date = isoDate(review.date);
    if (review.dateBasis) row.dateBasis = review.dateBasis;
    if (review.correctedVersions) row.versions = review.correctedVersions;
  }
  for (const row of parsed.updates) {
    assert.ok(
      !row.uncertainty || row.dateBasis === 'documented-by',
      `Review uncertain GTA update date: ${row.id}`,
    );
    for (const url of row.notesUrls) {
      const noteDate = url.match(/Update-(\d{4}-\d{2}-\d{2})/)?.[1];
      assert.ok(
        !noteDate || row.date >= noteDate,
        `GTA row precedes its linked update; review ${row.id}`,
      );
    }
  }
  return {
    schemaVersion: 1,
    asOf,
    capturedAt: client.snapshot.capturedAt,
    source: { url: gtaHistory, apiUrl: gtaHistoryAPI, sha256: saved.get(gtaHistoryAPI).sha256 },
    reviewsHash: sha256(stableJSON(reviews)),
    rowCount: parsed.rowCount,
    updates: parsed.updates.filter((r) => r.date <= asOf),
    excluded: [
      ...parsed.excluded,
      ...parsed.updates
        .filter((r) => r.date > asOf)
        .map((r) => ({ row: r.row, date: r.date, reason: 'After dataset snapshot' })),
    ],
  };
}

export function syncGtaUpdates(input, evidence, reviews) {
  assert.equal(evidence.schemaVersion, 1);
  isoDate(evidence.asOf);
  assert.ok(evidence.asOf <= input.updated, 'GTA evidence is newer than the dataset');
  assert.equal(evidence.source.url, gtaHistory);
  assert.match(evidence.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    evidence.reviewsHash,
    sha256(stableJSON(reviews)),
    'GTA date reviews changed; recapture or replay the source',
  );
  assert.equal(
    evidence.updates.length + evidence.excluded.length,
    evidence.rowCount,
    'Every GTA history row must be accounted for',
  );
  assert.ok(evidence.updates.length, 'Empty GTA update evidence');
  const ids = new Set(evidence.updates.map((r) => r.id));
  assert.equal(ids.size, evidence.updates.length);
  for (const row of input.releases.filter(owns))
    assert.ok(ids.has(row.id), `Saved GTA history omits ${row.id}; review before applying`);
  const data = structuredClone(input);
  const family = data.families.find((f) => f.id === 'gta');
  assert.equal(family?.kind, 'software');
  family.scope = gtaScope;
  const source = (url, title, publisher = 'GTA Wiki contributors') => {
    assert.equal(new URL(url).protocol, 'https:');
    let record = data.sources.find((s) => s.url === url);
    if (!record) {
      record = {
        id: `gta-source-${sha256(url).slice(0, 12)}`,
        title,
        url,
        publisher,
        checkedAt: evidence.asOf,
      };
      data.sources.push(record);
    }
    record.checkedAt = evidence.asOf;
    return record.id;
  };
  const historyId = source(gtaHistory, 'GTA Wiki: GTA V title-update version history');
  const releases = evidence.updates.map((row) => {
    assert.ok(row.id.startsWith(prefix));
    isoDate(row.date);
    assert.ok(row.date <= evidence.asOf);
    assert.ok(
      !row.uncertainty || row.dateBasis === 'documented-by',
      'Unconfirmed dates need an available-by bound',
    );
    const sourceIds = row.notesUrls.map((url) =>
      source(url, `GTA Wiki: GTA V notes for ${url.split('/').at(-1)}`),
    );
    const dateIds = row.review?.evidence.map((e) => source(e.url, e.title, e.publisher));
    const name = row.title
      ? `GTA V: ${row.title}`
      : `GTA V title update ${row.versions.join(' / ')}`;
    return {
      id: row.id,
      family: 'gta',
      name,
      version: '5',
      score: 5,
      date: row.date,
      status: row.dateBasis === 'documented-by' ? 'Available by' : 'Released',
      eventType: 'release',
      ...(row.dateBasis ? { dateBasis: row.dateBasis } : {}),
      sourceId: sourceIds[0],
      dateSourceId: dateIds?.at(-1) ?? historyId,
      weightsStatus: 'not-applicable',
      weightsCheckedAt: evidence.asOf,
      weightsSourceUrl: row.notesUrls[0],
      weightsNote: 'Software control; model weights do not apply.',
      note: `Title-update labels: ${row.versions.join(' / ')}. Table platform columns: ${row.platforms.join('; ')}; individual notes can narrow platform availability. One event per title-update row, combining platform columns. Date and identity from GTA Wiki's version history.${row.review ? ' ' + row.review.reason : ''} Still 5.`,
      mapping:
        'Roman numeral V = 5. Patch, build, GTA Online, and platform numbers are update labels, not the VersionBench version.',
    };
  });
  data.releases = [...data.releases.filter((r) => !owns(r)), ...releases].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.family.localeCompare(b.family) ||
      a.name.localeCompare(b.name),
  );
  data.sources.sort((a, b) => a.id.localeCompare(b.id));
  return data;
}

export function validateGtaUpdates(data, evidence, reviews) {
  const expected = syncGtaUpdates(data, evidence, reviews);
  const ids = new Set(expected.releases.filter(owns).flatMap((r) => [r.sourceId, r.dateSourceId]));
  const byId = (rows) => rows.sort((a, b) => a.id.localeCompare(b.id));
  const owned = (catalog) => ({
    family: catalog.families.find((f) => f.id === 'gta'),
    releases: byId(catalog.releases.filter(owns)),
    sources: byId(catalog.sources.filter((s) => ids.has(s.id))),
  });
  assert.deepEqual(
    owned(data),
    owned(expected),
    'GTA title updates differ from saved evidence; run node scripts/import-gta.mjs --apply',
  );
  for (const row of data.releases.filter((r) => r.family === 'gta')) {
    assert.equal(row.version, '5', 'GTA remains version 5');
    assert.equal(row.score, 5, 'GTA remains score 5');
  }
}
