import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceSnapshot, sha256 } from './source-snapshot.mjs';
import {
  gtaHistoryAPI,
  parseGtaHistory,
  captureGtaUpdates,
  syncGtaUpdates,
  validateGtaUpdates,
} from './gta-updates.mjs';

const notes = (version, date) =>
  `${version}<br>[[Grand_Theft_Auto_V/Title_Update_Notes/Update-${date}|Notes]]`;
const row = (date, cells) => `|-\n|${date}\n${cells.map((c) => '|' + c).join('\n')}\n`;
const table = (...rows) =>
  `==Version History==\n{|\n|-\n! Release Date\n! PS3\n! PS4\n! PC\n! PS5\n${rows.join('')}|}`;
const clientFor = (wikitext) => {
  const body = JSON.stringify({ parse: { wikitext } });
  return new SourceSnapshot(
    {
      schemaVersion: 1,
      capturedAt: '2026-10-06T12:00:00Z',
      requests: {
        [gtaHistoryAPI]: { status: 200, body, sha256: sha256(body), headers: {} },
      },
    },
    {
      offline: true,
      fetcher: () => {
        throw new Error('Unexpected network request');
      },
    },
  );
};

test('GTA parsing combines platform columns, preserves dated patches, and excludes launches and weekly events', () => {
  const history = table(
    row('17 Sep 2013', ['Original Release 1.0', '', '', '']),
    row('01 Oct 2013', [notes('1.01', '2013-10-01'), '', '', '']),
    row('rowspan="2"|23 Jan 25', [
      '',
      notes('Title Update (Online 1.70)', '2024-12-10'),
      notes('Title Update (Online 1.70)', '2024-12-10'),
      notes('Title Update (Online 1.70)', '2024-12-10'),
    ]),
    // This row inherits the date, but is content unlocked within an existing patch.
    row('', ['colspan="3"|[[Year of the Snake Week]] (Official 1.70 update log)']),
    row('06 Feb 25', ['', notes('1.70', '2024-12-10'), notes('1.70', '2024-12-10'), '']),
    row('06 Feb 25', ['', notes('1.71', '2025-02-06'), '', '']),
  );
  const parsed = parseGtaHistory(history);
  assert.equal(parsed.rowCount, 6);
  assert.equal(parsed.updates.length, 4);
  assert.equal(parsed.excluded.length, 2);
  assert.deepEqual(parsed.updates[1].versions, ['1.70']);
  assert.equal(parsed.updates[1].platforms.length, 3);
  assert.equal(parsed.updates[1].notesUrls.length, 1);
  assert.equal(parsed.excluded[1].date, '2025-01-23');
  assert.equal(new Set(parsed.updates.map((r) => r.id)).size, 4);
  assert.throws(() => parseGtaHistory(history.replace('01 Oct 2013', 'Unknown')), /Missing date/);
  assert.throws(() => parseGtaHistory(history.replace('01 Oct 2013', '31 Feb 2013')));
});

test('GTA replay refuses uncertain or contradictory dates without a reviewed resolution', async () => {
  await assert.rejects(
    captureGtaUpdates(
      clientFor(
        table(
          row('{{H:title|Actual date unconfirmed|15 Dec 2019}}', [
            '',
            notes('1.50', '1.50'),
            '',
            '',
          ]),
        ),
      ),
      '2026-10-06',
      [],
    ),
    /Review uncertain/,
  );
  await assert.rejects(
    captureGtaUpdates(
      clientFor(table(row('07 Mar 25', ['', '', notes('1.71', '2025-06-17'), '']))),
      '2026-10-06',
      [],
    ),
    /precedes its linked update/,
  );
  const future = await captureGtaUpdates(
    clientFor(
      table(
        row('01 Oct 2013', [notes('1.01', '2013-10-01'), '', '', '']),
        row('07 Oct 2026', ['', notes('1.75', '2026-10-07'), '', '']),
      ),
    ),
    '2026-10-06',
    [],
  );
  assert.equal(future.updates.length, 1);
  assert.equal(future.excluded[0].reason, 'After dataset snapshot');
});

test('every saved GTA update imports offline at exactly 5, without duplicating platform launches', async () => {
  const data = JSON.parse(await readFile(new URL('../data/releases.json', import.meta.url)));
  const evidence = JSON.parse(
    await readFile(new URL('../data/evidence/gta-updates.json', import.meta.url)),
  );
  const reviews = JSON.parse(
    await readFile(new URL('../data/gta-update-reviews.json', import.meta.url)),
  );
  validateGtaUpdates(data, evidence, reviews);
  assert.deepEqual(syncGtaUpdates(data, evidence, reviews), data);
  const releases = data.releases.filter((r) => r.family === 'gta');
  assert.equal(releases.length, evidence.updates.length + 5);
  assert.ok(releases.every((r) => r.score === 5 && r.version === '5'));
  const uncertain = releases.find((r) => r.id.includes('2019-12-15'));
  assert.equal(uncertain.date, '2019-12-19');
  assert.equal(uncertain.dateBasis, 'documented-by');
  assert.equal(uncertain.status, 'Available by');
  const corrected = releases.find((r) => r.id.endsWith('2025-03-07-1-71'));
  assert.equal(corrected.date, '2025-07-08');
  assert.equal(evidence.rowCount, evidence.updates.length + evidence.excluded.length);
  assert.equal(
    new Set([...evidence.updates, ...evidence.excluded].map((r) => r.row)).size,
    evidence.rowCount,
  );
  const tampered = structuredClone(data);
  tampered.releases.find((r) => r.id === corrected.id).score = 1.71;
  assert.throws(
    () => validateGtaUpdates(tampered, evidence, reviews),
    /differ from saved evidence/,
  );
  const missing = { ...data, releases: data.releases.filter((r) => r.id !== corrected.id) };
  assert.throws(() => validateGtaUpdates(missing, evidence, reviews), /differ from saved evidence/);
});
