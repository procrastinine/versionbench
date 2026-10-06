import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStats, readmeTemplates, renderReadme } from './stats.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const [template, css, js, raw] = await Promise.all(
  ['src/index.html', 'src/styles.css', 'src/app.js', 'data/releases.json'].map(read),
);
const data = JSON.parse(raw);
const stats = buildStats(data);
const documentation = [];
for (const [source, target] of readmeTemplates)
  documentation.push([target, renderReadme(await read(source), stats, source)]);
const html = template
  .replace('/* STYLES */', () => css)
  .replace('/* DATA */', () => JSON.stringify(data).replaceAll('<', '\\u003c'))
  .replace('/* SCRIPT */', () => js);
await writeFile(new URL('index.html', root), html);
const tables = [
  ['families', ['id', 'name', 'provider', 'color', 'core']],
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
  const rows = [fields, ...data[name].map((row) => fields.map((key) => row[key]))];
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
