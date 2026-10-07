import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStats, readmeTemplates, renderReadme } from './stats.mjs';
import { renderWatchlist, renderHistoryReview, renderPending } from './watch-docs.mjs';
import { buildBrowserScript } from './browser-bundle.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const [template, css, raw, license] = await Promise.all(
  ['src/index.html', 'src/styles.css', 'data/releases.json', 'LICENSE'].map(read),
);
const js = buildBrowserScript();
const data = JSON.parse(raw);
const watchlist = JSON.parse(await read('data/provider-sources.json'));
const historyReview = JSON.parse(await read('data/history-review.json'));
const pending = JSON.parse(await read('data/pending-releases.json'));
const resolutions = JSON.parse(await read('data/candidate-resolutions.json'));
const evidence = JSON.parse(await read('data/evidence/candidate-review.json'));
const stats = buildStats(data);
const documentation = [];
for (const [source, target] of readmeTemplates)
  documentation.push([target, renderReadme(await read(source), stats, source)]);
documentation.push([
  'docs/pending-releases.md',
  renderPending(data, pending, resolutions, evidence),
]);
documentation.push(['docs/source-watchlist.md', renderWatchlist(data, watchlist)]);
documentation.push(['docs/history-audit.md', renderHistoryReview(data, historyReview)]);
const html = template
  .replace('/* STYLES */', () => css)
  .replace('/* DATA */', () => JSON.stringify(data).replaceAll('<', '\\u003c'))
  .replace('/* STATS */', () => JSON.stringify(stats).replaceAll('<', '\\u003c'))
  .replace('/* WATCHLIST */', () => JSON.stringify(watchlist).replaceAll('<', '\\u003c'))
  .replace('/* PENDING */', () => JSON.stringify(pending).replaceAll('<', '\\u003c'))
  .replace('/* SCRIPT */', () => `/*\n${license}*/\n${js}`);
await writeFile(new URL('index.html', root), html);
const tables = [
  ['families', ['id', 'name', 'provider', 'color', 'core', 'kind', 'scope']],
  [
    'family-stats',
    [
      'id',
      'name',
      'kind',
      'releaseCount',
      'versionCount',
      'highestVersion',
      'highestScore',
      'currentRank',
      'daysAtNumberOne',
      'averageRank',
      'trackedDays',
      'releaseRatePerYear',
      'firstEventDate',
      'lastEventDate',
      'artificialAnalysisReleaseCount',
      'huggingFaceReleaseCount',
    ],
  ],
  ['sources', ['id', 'title', 'url', 'publisher', 'date', 'checkedAt']],
  [
    'releases',
    [
      'id',
      'family',
      'name',
      'version',
      'score',
      'date',
      'status',
      'eventType',
      'dateBasis',
      'dateRepositoryUrl',
      'sourceId',
      'dateSourceId',
      'artificialAnalysisUrl',
      'weightsStatus',
      'weightsCheckedAt',
      'huggingFaceUrl',
      'weightsSourceUrl',
      'weightsNote',
      'note',
      'mapping',
    ],
  ],
];
const csvCell = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
for (const [name, fields] of tables) {
  const records = name === 'family-stats' ? stats.families : data[name];
  const rows = [fields, ...records.map((row) => fields.map((key) => row[key]))];
  await writeFile(
    new URL(`data/${name}.csv`, root),
    rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n',
  );
}
await writeFile(new URL('data/stats.json', root), JSON.stringify(stats, null, 2) + '\n');
for (const [path, markdown] of documentation) await writeFile(new URL(path, root), markdown);
console.log(
  `Built ${fileURLToPath(new URL('index.html', root))} (${Buffer.byteLength(html).toLocaleString()} bytes, ${data.releases.length} releases); synchronized CSV tables, stats.json, and READMEs.`,
);
