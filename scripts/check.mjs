import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';
import { numericVersion } from './version.mjs';
import { artifactExclusion } from './release-policy.mjs';
import { buildStats, readmeTemplates, renderReadme } from './stats.mjs';
import { huggingFaceTarget } from './weights-audit.mjs';
import { renderWatchlist, renderHistoryReview, renderPending } from './watch-docs.mjs';
import { validateCandidateReview } from './candidate-review.mjs';
import { buildBrowserScript } from './browser-bundle.mjs';
const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/releases.json', root), 'utf8'));
const imports = JSON.parse(await readFile(new URL('data/checkpoint-imports.json', root), 'utf8'));
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
const families = new Map(data.families.map((f) => [f.id, f]));
const sources = new Map(data.sources.map((s) => [s.id, s]));
const firstWeightRepos = new Set();
for (const f of data.families) {
  assert.ok(f.name && f.provider, `Missing family metadata: ${f.id}`);
  assert.ok(['model', 'software'].includes(f.kind), `Missing family kind: ${f.id}`);
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
  if (r.artificialAnalysisUrl)
    assert.match(
      r.artificialAnalysisUrl,
      /^https:\/\/artificialanalysis\.ai\/models\/[a-z0-9.-]+$/,
      `Invalid Artificial Analysis model URL: ${r.id}`,
    );
  assert.ok(r.name && r.status, `Incomplete release: ${r.id}`);
  assert.ok(!artifactExclusion(r.name), `Packaging variant is not a release: ${r.id}`);
  assert.ok(
    ['announcement', 'api', 'weights', 'preview', 'research', 'release', 'checkpoint'].includes(
      r.eventType,
    ),
    `Missing event type: ${r.id}`,
  );
  assert.ok(
    ['open', 'not-published', 'unverified', 'not-applicable'].includes(r.weightsStatus),
    `Missing weights review: ${r.id}`,
  );
  assert.equal(
    r.weightsStatus === 'not-applicable',
    families.get(r.family).kind === 'software',
    `Software weights classification: ${r.id}`,
  );
  date(r.weightsCheckedAt, `${r.id} weights check`);
  assert.ok(
    r.weightsCheckedAt <= data.updated && r.weightsCheckedAt >= r.date,
    `Invalid weights check date: ${r.id}`,
  );
  assert.equal(new URL(r.weightsSourceUrl).protocol, 'https:', `Missing weights evidence: ${r.id}`);
  if (r.huggingFaceUrl) {
    huggingFaceTarget(r.huggingFaceUrl);
    assert.equal(r.weightsStatus, 'open', `Weights link on non-open release: ${r.id}`);
  }
  assert.ok(
    r.weightsStatus !== 'open' || r.huggingFaceUrl || r.weightsNote,
    `Explain missing HF weights: ${r.id}`,
  );
  if (r.weightsStatus !== 'open') assert.ok(r.weightsNote, `Explain weights assessment: ${r.id}`);
  assert.ok(
    typeof r.version === 'string',
    `Version must preserve published display string: ${r.id}`,
  );
  if (r.eventType === 'checkpoint') {
    assert.ok(['checkpoint-commit', 'repository-created'].includes(r.dateBasis), 'Label checkpoint date evidence');
    assert.ok(r.huggingFaceUrl, 'First-weight evidence needs a checkpoint repository');
    const repository = (r.dateRepositoryUrl ?? r.huggingFaceUrl).toLowerCase().replace(/\/$/, '');
    huggingFaceTarget(repository);
    assert.ok(
      !firstWeightRepos.has(repository),
      `Later checkpoint commit is not another release: ${repository}`,
    );
    firstWeightRepos.add(repository);
    assert.equal(
      r.status,
      r.dateBasis === 'repository-created' ? 'Repository created (fallback)' : 'First weights commit',
      'Identify the checkpoint date evidence',
    );
    if (r.dateBasis === 'repository-created') {
      assert.match(r.note, /fallback/i, 'Explain repository-date fallbacks');
      const mapping = imports.find((i) => 'https://huggingface.co/' + i.repository.toLowerCase() === repository);
      assert.ok(mapping?.allowRepositoryCreated, 'Creation fallbacks require a reviewed mapping');
      const expected = mapping.archivedMetadataUrl ?? 'https://huggingface.co/api/models/' + mapping.repository;
      assert.equal(sources.get(r.sourceId).url, expected, 'Link the exact creation-date metadata');
    }
  }
  if (r.dateBasis === 'documented-by') {
    assert.equal(r.status, 'Available by', 'Do not present an availability bound as a launch day');
    assert.match(r.note, /not.*(?:launch|release)/i, 'Explain the date bound');
  }
  assert.ok(Number.isFinite(r.score) && r.score >= 0, `Invalid score: ${r.id}`);
  assert.equal(numericVersion(r.version), r.score, `Score/version mismatch: ${r.id}`);
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
for (const id of ['pangu', 'mimo', 'granite', 'hermes'])
  assert.ok(families.has(id), `Missing model family: ${id}`);
const providerSources = JSON.parse(
  await readFile(new URL('data/provider-sources.json', root), 'utf8'),
);
assert.equal(
  new Set(providerSources.map((row) => row.family)).size,
  providerSources.length,
  'Duplicate provider discovery configuration',
);
for (const family of families.values())
  assert.ok(
    providerSources.some((row) => row.family === family.id && row.sources.length),
    `Configure official discovery sources for ${family.id}`,
  );
for (const row of providerSources) {
  assert.ok(families.has(row.family), `Unknown provider discovery family: ${row.family}`);
  for (const source of row.sources) {
    assert.ok(['page', 'huggingface'].includes(source.type), 'Unsupported provider source');
    if (source.type === 'huggingface') assert.match(source.author, /^[a-z0-9-]+$/i);
    else assert.equal(new URL(source.url).protocol, 'https:');
    assert.ok(
      source.scopePattern && source.purpose && source.signals?.length,
      `Incomplete source watch: ${row.family}`,
    );
    new RegExp(source.scopePattern, 'i');
    if (source.pattern) new RegExp(source.pattern, 'gi');
    if (source.excludePattern) new RegExp(source.excludePattern, 'i');
  }
}
const historyReview = JSON.parse(await readFile(new URL('data/history-review.json', root), 'utf8'));
assert.equal(
  new Set(historyReview.map((r) => r.family)).size,
  historyReview.length,
  'Duplicate history review',
);
for (const review of historyReview) {
  assert.ok(
    families.has(review.family) && review.summary && review.sourceIds.length,
    'Incomplete historical audit',
  );
  date(review.checkedAt, review.family + ' history review');
  for (const id of review.sourceIds)
    assert.ok(sources.has(id), 'Missing historical evidence: ' + id);
}
for (const family of data.families.filter((f) => f.kind === 'model')) {
  const first = data.releases
    .filter((r) => r.family === family.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  if (first.score !== 1)
    assert.ok(
      historyReview.some((r) => r.family === family.id),
      `Audit earlier versions for ${family.id}`,
    );
}
assert.equal(
  await readFile(new URL('docs/source-watchlist.md', root), 'utf8'),
  renderWatchlist(data, providerSources),
  'Regenerate source watchlist',
);
assert.equal(
  await readFile(new URL('docs/history-audit.md', root), 'utf8'),
  renderHistoryReview(data, historyReview),
  'Regenerate history audit',
);
const discoveryDecisions = JSON.parse(
  await readFile(new URL('data/discovery-decisions.json', root), 'utf8'),
);
assert.equal(
  new Set(discoveryDecisions.map((d) => d.family + '\n' + d.url)).size,
  discoveryDecisions.length,
  'Duplicate discovery decision',
);
for (const decision of discoveryDecisions) {
  assert.ok(families.has(decision.family) && decision.reason, 'Incomplete discovery decision');
  assert.equal(new URL(decision.url).protocol, 'https:');
  assert.ok(
    ['covered', 'out-of-scope', 'date-unresolved'].includes(decision.disposition),
    'Unknown discovery decision',
  );
  date(decision.checkedAt, decision.url);
  for (const id of decision.releaseIds ?? [])
    assert.ok(
      data.releases.some((r) => r.id === id && r.family === decision.family),
      'Missing decision release',
    );
}
const pending = JSON.parse(await readFile(new URL('data/pending-releases.json', root), 'utf8'));
unique(pending, 'pending release');
for (const row of pending) {
  assert.ok(
    families.has(row.family) && row.name && row.reason && row.sourceUrls.length,
    'Incomplete pending candidate',
  );
  numericVersion(row.version);
  date(row.checkedAt, row.id);
  assert.ok(!row.date, 'Pending candidates must not have invented dates');
  for (const url of row.sourceUrls) assert.equal(new URL(url).protocol, 'https:');
}
const resolutions = JSON.parse(await readFile(new URL('data/candidate-resolutions.json', root), 'utf8'));
const evidence = JSON.parse(await readFile(new URL('data/evidence/candidate-review.json', root), 'utf8'));
unique(resolutions, 'resolved candidate');
validateCandidateReview(data, pending, resolutions, evidence);
assert.equal(
  await readFile(new URL('docs/pending-releases.md', root), 'utf8'),
  renderPending(data, pending, resolutions, evidence),
);
assert.equal(
  new Set(imports.map((r) => r.repository)).size,
  imports.length,
  'Duplicate import mapping',
);
for (const row of imports) {
  assert.ok(families.has(row.family) && row.name && row.mapping, 'Incomplete import mapping');
  assert.ok(
    !artifactExclusion(row.repository) && !artifactExclusion(row.name),
    'Exclude conversion imports',
  );
  huggingFaceTarget('https://huggingface.co/' + row.repository);
  numericVersion(row.version);
  if (row.allowRepositoryCreated !== undefined)
    assert.equal(typeof row.allowRepositoryCreated, 'boolean', 'Explicit creation fallback approval');
  if (row.huggingFaceUrl) {
    huggingFaceTarget(row.huggingFaceUrl);
    assert.ok(row.weightsNote, 'Explain alternative weights links');
  }
}
const stats = buildStats(data);
assert.deepEqual(
  JSON.parse(await readFile(new URL('data/stats.json', root), 'utf8')),
  stats,
  'Regenerate statistics after editing release data',
);
for (const [template, target] of readmeTemplates)
  assert.equal(
    await readFile(new URL(target, root), 'utf8'),
    renderReadme(await readFile(new URL(template, root), 'utf8'), stats, template),
    `Regenerate ${target} after editing data or its template`,
  );
const js = buildBrowserScript();
new Script(js);
const html = await readFile(new URL('index.html', root), 'utf8');
const license = await readFile(new URL('LICENSE', root), 'utf8');
assert.ok(html.includes(license), 'Standalone page must include its MIT license');
const css = await readFile(new URL('src/styles.css', root), 'utf8');
assert.ok(
  html.includes(css) && html.includes(js),
  'Rebuild index.html after editing styles or scripts',
);
assert.ok(
  !['/* DATA */', '/* STATS */', '/* WATCHLIST */', '/* PENDING */', '/* SCRIPT */'].some((slot) =>
    html.includes(slot),
  ),
  'Unfilled HTML template',
);
assert.ok(!/<script[^>]+src\s*=/i.test(html), 'External script dependency');
assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html), 'External stylesheet dependency');
const embedded = JSON.parse(
  html.match(/<script id="release-data" type="application\/json">([\s\S]*?)<\/script>/)[1],
);
assert.deepEqual(embedded, data, 'Rebuild index.html after editing data');
const embeddedWatch = JSON.parse(
  html.match(/<script id="watch-data" type="application\/json">([\s\S]*?)<\/script>/)[1],
);
assert.deepEqual(embeddedWatch, providerSources, 'Rebuild embedded watchlists');
const embeddedPending = JSON.parse(
  html.match(/<script id="pending-data" type="application\/json">([\s\S]*?)<\/script>/)[1],
);
assert.deepEqual(embeddedPending, pending, 'Rebuild pending candidates');
const embeddedStats = JSON.parse(
  html.match(/<script id="stats-data" type="application\/json">([\s\S]*?)<\/script>/)[1],
);
assert.deepEqual(embeddedStats, stats, 'Rebuild index.html after changing statistics');
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
  `PASS: ${data.families.length} families, ${data.releases.length} releases, ${data.sources.length} sources; calendar dates, foreign keys, version mapping, generated statistics and READMEs, JavaScript syntax, standalone bundle, offline resource policy.`,
);
