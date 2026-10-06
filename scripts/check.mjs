import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/releases.json', root), 'utf8'));
const unique = (rows, label) => {
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${label} IDs`);
  for (const id of ids)
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid ${label} ID: ${id}`);
};
const date = (s, context) => {
  assert.match(s, /^\d{4}-\d{2}-\d{2}$/, `Invalid date: ${context}`);
  assert.equal(
    new Date(s + 'T00:00:00Z').toISOString().slice(0, 10),
    s,
    `Invalid calendar date: ${context}`,
  );
};
date(data.updated, 'dataset snapshot');
unique(data.families, 'family');
unique(data.releases, 'release');
unique(data.sources, 'source');
assert.equal(
  new Set(data.sources.map((s) => s.url)).size,
  data.sources.length,
  'Duplicate source URLs: normalize sources once',
);
assert.equal(data.families.length, 18, 'Expected 18 model families');
const families = new Map(data.families.map((f) => [f.id, f]));
const sources = new Map(data.sources.map((s) => [s.id, s]));
for (const f of data.families) {
  assert.ok(f.name && f.provider, `Missing family metadata: ${f.id}`);
  assert.match(f.color, /^#[\da-f]{6}$/i);
  assert.ok(
    data.releases.some((r) => r.family === f.id),
    `No releases: ${f.id}`,
  );
}
for (const s of data.sources) {
  assert.ok(s.title && s.publisher, `Missing source metadata: ${s.id}`);
  const url = new URL(s.url);
  assert.equal(url.protocol, 'https:');
  assert.ok(!/[?&](utm_|trk=)/.test(s.url), `Remove tracking: ${s.url}`);
  date(s.checkedAt, `${s.id} checkedAt`);
  if (s.date) date(s.date, `${s.id} publication date`);
}
for (const r of data.releases) {
  assert.ok(families.has(r.family), `Unknown family: ${r.id}`);
  assert.ok(sources.has(r.sourceId), `Missing source: ${r.id}`);
  if (r.dateSourceId) assert.ok(sources.has(r.dateSourceId), `Missing date source: ${r.id}`);
  assert.ok(r.name && r.status, `Incomplete release: ${r.id}`);
  assert.ok(
    typeof r.version === 'string',
    `Version must preserve published display string: ${r.id}`,
  );
  assert.ok(Number.isFinite(r.score) && r.score >= 0, `Invalid score: ${r.id}`);
  assert.equal(Number(r.version), r.score, `Score/version mismatch: ${r.id}`);
  date(r.date, r.id);
  assert.ok(r.date <= data.updated, `Future release: ${r.id}`);
}
for (const [name, version] of [
  ['Gemini 3.1 Flash-Lite', 3.1],
  ['Gemini 3.5 Flash-Lite', 3.5],
])
  assert.ok(
    data.releases.some(
      (r) => r.family === 'gemini' && r.name.startsWith(name) && r.score === version,
    ),
    `Missing release: ${name}`,
  );
for (const name of ['o1-preview', 'o1-mini', 'o1', 'o3-mini', 'o3', 'o4-mini', 'o3-pro'])
  assert.ok(
    data.releases.some((r) => r.family === 'openai-o' && r.name === name),
    `Missing o-series release: ${name}`,
  );
for (const version of [1, 2, 3])
  assert.ok(
    data.releases.some((r) => r.family === 'glm' && r.score === version),
    `Missing early GLM generation: ${version}`,
  );
for (const version of [0.1, 0.2])
  assert.ok(
    data.releases.some((r) => r.family === 'mistral' && /7B/i.test(r.name) && r.score === version),
    `Missing Mistral 7B v${version}`,
  );
assert.ok(
  data.releases.some((r) => r.family === 'kimi' && /K2.7 Code/.test(r.name) && r.score === 2.7),
  'Missing Kimi K2.7 Code',
);
for (const [date, status] of [
  ['2023-10-09', 'Preview'],
  ['2023-11-16', 'Released'],
  ['2024-03-18', 'Preview'],
])
  assert.ok(
    data.releases.some(
      (r) =>
        r.family === 'kimi' && r.date === date && r.score === 1 && r.status === status && r.mapping,
    ),
    `Missing original Kimi milestone: ${date}`,
  );
// Keep announcements distinct from later API availability.
for (const [name, day, status] of [
  ['Claude 3 Haiku', '2024-03-04', 'Announced'],
  ['Claude 3 Haiku', '2024-03-13', 'Released'],
  ['Claude 3.5 Haiku', '2024-10-22', 'Announced'],
  ['Claude 3.5 Haiku', '2024-11-04', 'Released'],
]) {
  const release = data.releases.find(
    (r) => r.name.startsWith(name + ' (') && r.date === day && r.status === status,
  );
  assert.ok(release, 'Missing separately sourced Haiku event: ' + name + ' ' + day);
  const host = new URL(sources.get(release.sourceId).url).hostname;
  assert.ok(
    host === 'www.anthropic.com' || host === 'platform.claude.com',
    'Use Anthropic’s own source for Haiku',
  );
}
const expected = {
  gpt: 6.1,
  claude: 5.5,
  gemini: 4,
  grok: 4.7,
  llama: 4,
  mistral: 4,
  qwen: 3.8,
  deepseek: 4.1,
  kimi: 3,
  glm: 5.3,
};
const ranked = data.families
  .map((f) => ({
    id: f.id,
    score: Math.max(...data.releases.filter((r) => r.family === f.id).map((r) => r.score)),
  }))
  .sort((a, b) => b.score - a.score);
for (const [id, score] of Object.entries(expected))
  assert.equal(ranked.find((f) => f.id === id).score, score, `Latest target mismatch: ${id}`);
assert.deepEqual(
  ranked.slice(0, 3).map((f) => f.id),
  ['gpt', 'claude', 'glm'],
);
const js = await readFile(new URL('src/app.js', root), 'utf8');
new Script(js);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('src/styles.css', root), 'utf8');
assert.ok(
  html.includes(css) && html.includes(js),
  'Rebuild index.html after editing styles or scripts',
);
assert.ok(!html.includes('/* DATA */') && !html.includes('/* SCRIPT */'), 'Unfilled HTML template');
assert.ok(!/<script[^>]+src\s*=/i.test(html), 'External script dependency');
assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html), 'External stylesheet dependency');
const embedded = JSON.parse(
  html.match(/<script id="release-data" type="application\/json">([\s\S]*?)<\/script>/)[1],
);
assert.deepEqual(embedded, data, 'Rebuild index.html after editing data');
assert.ok(
  !/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\s*\(/.test(js),
  'Standalone HTML must not make background network requests',
);
assert.ok(
  !/@import|@font-face|url\s*\(/i.test(css),
  'Styles must use system fonts and contain no fetched assets',
);
assert.ok(
  !/<(?:iframe|object|embed)\b/i.test(html),
  'Standalone HTML must not embed remote content',
);
assert.ok(
  !/rel=["'](?:preconnect|dns-prefetch|prefetch|preload|modulepreload)["']/i.test(html),
  'No speculative network requests',
);
const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
assert.ok(policy, 'Missing offline Content Security Policy');
const directives = new Map(
  policy
    .split(';')
    .filter((d) => d.trim())
    .map((d) => {
      const [key, ...value] = d.trim().split(/\s+/);
      return [key, value.join(' ')];
    }),
);
for (const key of ['default-src', 'connect-src', 'font-src', 'base-uri', 'form-action'])
  assert.equal(directives.get(key), "'none'", key + ' must block network access');
assert.equal(directives.get('script-src'), "'unsafe-inline'");
assert.equal(directives.get('style-src'), "'unsafe-inline'");
assert.equal(directives.get('img-src'), 'data:');

console.log(
  `PASS: ${data.families.length} families, ${data.releases.length} releases, ${data.sources.length} sources; exact dates, foreign keys, version mapping, leaderboard rankings, JavaScript syntax, standalone bundle, offline resource policy.`,
);
