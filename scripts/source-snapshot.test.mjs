import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceSnapshot, paginatedJSON, sha256, stableJSON } from './source-snapshot.mjs';
import { inventorySource, pageInventory, auditInventory } from './source-inventory.mjs';
import { observedVersions, compareProviderVersions, pageText } from './provider-audit.mjs';
import { numericVersion } from './version.mjs';
import { checkpointHistory, archivedHuggingFaceModel } from './checkpoint-history.mjs';

const fixture = (responses) =>
  new SourceSnapshot(
    {
      schemaVersion: 1,
      capturedAt: '2026-10-06T00:00:00Z',
      requests: Object.fromEntries(
        Object.entries(responses).map(([url, value]) => {
          const body =
            typeof value.body === 'string' ? value.body : JSON.stringify(value.body ?? value);
          return [
            url,
            {
              status: value.status || 200,
              finalUrl: url,
              headers: value.headers || {},
              body,
              sha256: sha256(body),
            },
          ];
        }),
      ),
    },
    {
      offline: true,
      fetcher: () => {
        throw new Error('Unexpected network');
      },
    },
  );

test('patch segments are decimals, while published labels remain distinct', () => {
  assert.equal(numericVersion('2.9.3'), 2.93);
  assert.equal(numericVersion('3.10'), 3.1);
  assert.ok(numericVersion('3.9') > numericVersion('3.10'));
  assert.equal(numericVersion('2.10.12'), 2.1012);
  assert.throws(() => numericVersion('2.9x'), /Missing numeric/);
  const seen = observedVersions('Dolphin2.9.3 Dolphin3.10 Dolphin3.1', 'Dolphin(\\d+(?:\\.\\d+)*)');
  assert.equal(seen.length, 3);
  assert.equal(seen.find((r) => r.version === '2.9.3').score, 2.93);
  assert.equal(
    compareProviderVersions([{ version: '3.1', score: 3.1 }], seen).unrecordedVersions.length,
    2,
  );
});

test('earlier releases cannot pass simply because the latest version is present', () => {
  const result = compareProviderVersions(
    [{ version: '3', score: 3 }],
    [
      { version: '2', score: 2 },
      { version: '3', score: 3 },
    ],
  );
  assert.equal(result.comparison, 'review-missing-version');
  assert.equal(result.higherVersions.length, 0);
  assert.equal(result.unrecordedVersions[0].version, '2');
});

test('exhausts HF pagination and includes unnumbered relatives without matching publisher names', async () => {
  const first = 'https://huggingface.co/api/models?author=PrimeIntellect&limit=1000',
    next = 'https://huggingface.co/api/models?cursor=2';
  const client = fixture({
    [first]: {
      body: [{ id: 'PrimeIntellect/INTELLECT-3' }, { id: 'PrimeIntellect/Qwen3' }],
      headers: { link: `<${next}>; rel="next"` },
    },
    [next]: [{ id: 'PrimeIntellect/INTELLECT-1' }],
  });
  const result = await inventorySource(client, {
    type: 'huggingface',
    author: 'PrimeIntellect',
    scopePattern: 'INTELLECT',
    pattern: 'INTELLECT-(\\d+)',
  });
  assert.equal(result.pages.length, 2);
  assert.equal(result.fetchedCount, 3);
  assert.equal(result.records.length, 2);
  assert.deepEqual(
    result.versions.map((v) => v.score),
    [3, 1],
  );
  const g = fixture({
    'https://huggingface.co/api/models?author=google&limit=1000': [
      { id: 'google/T5Gemma-2b-2b-ul2' },
      { id: 'google/embeddinggemma-300m' },
    ],
  });
  const gemma = await inventorySource(g, {
    type: 'huggingface',
    author: 'google',
    scopePattern: 'gemma',
    excludePattern: 'embeddinggemma',
  });
  assert.equal(gemma.records.length, 2);
  assert.ok(gemma.records.find((r) => r.name.includes('embedding')).excluded);
});

test('pagination cycles, foreign origins, missing pages and invalid arrays fail explicitly', async () => {
  const url = 'https://huggingface.co/api/models';
  for (const next of [url, 'https://example.com/page2', 'https://huggingface.co/missing']) {
    const c = fixture({ [url]: { body: [], headers: { link: `<${next}>; rel="next"` } } });
    await assert.rejects(() => paginatedJSON(c, url), /pagination|Missing from offline/);
  }
  await assert.rejects(
    () => paginatedJSON(fixture({ [url]: { not: 'an array' } }), url),
    /Expected paginated array/,
  );
});

test('snapshot replay is identical, preserves HTTP failures, and rejects tampering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'versionbench-'));
  const path = join(dir, 'snapshot.json');
  try {
    let calls = 0;
    const c = new SourceSnapshot(undefined, {
      fetcher: async (url) => {
        calls++;
        return new Response(url.endsWith('missing') ? 'no' : '[{"id":"a"}]', {
          status: url.endsWith('missing') ? 404 : 200,
        });
      },
    });
    await c.text('https://example.com/models');
    await c.text('https://example.com/models');
    await assert.rejects(() => c.text('https://example.com/missing'), /HTTP 404/);
    await c.save(path);
    assert.equal(calls, 2);
    const off = await SourceSnapshot.open(path, {
      offline: true,
      fetcher: () => {
        throw Error('Network');
      },
    });
    assert.equal(
      await c.text('https://example.com/models'),
      await off.text('https://example.com/models'),
    );
    await assert.rejects(() => off.text('https://example.com/missing'), /HTTP 404/);
    await assert.rejects(() => off.text('https://example.com/new'), /Missing from offline/);
    const altered = JSON.parse(await readFile(path));
    altered.requests['https://example.com/models'].body = 'different';
    await writeFile(path, stableJSON(altered));
    await assert.rejects(() => SourceSnapshot.open(path), /checksum mismatch/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bounded request concurrency stops after a rate limit instead of dropping errors', async () => {
  let active = 0,
    max = 0,
    calls = 0;
  const c = new SourceSnapshot(undefined, {
    concurrency: 2,
    fetcher: async () => {
      calls++;
      active++;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      return new Response('limit', { status: 429 });
    },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) => c.text(`https://example.com/${i}`)),
  );
  assert.equal(max, 2);
  assert.equal(calls, 2);
  assert.ok(results.every((r) => r.status === 'rejected'));
});

test('HTML attributes, scripts and URL slugs cannot invent versions', () => {
  const html =
    '<a data-json="x > Gemma 99" href="/gemma-31">Gemma 3.1</a><script>Gemma 100</script><!-- Gemma 77 -->';
  assert.equal(pageText(html).trim(), 'Gemma 3.1');
  assert.deepEqual(pageInventory(html, 'https://example.com', 'gemma'), [
    { name: 'Gemma 3.1', url: 'https://example.com/gemma-31' },
  ]);
});

test('variants and source failures remain visible even when numbered versions match', async () => {
  const url = 'https://example.com/gemma';
  const client = fixture({
    [url]: {
      body: '<article>Official Gemma model archive with complete release information: <a href="/t5">T5Gemma</a></article>',
    },
  });
  const data = {
    sources: [],
    families: [{ id: 'gemma' }],
    releases: [{ id: 'one', family: 'gemma', version: '1', score: 1, date: '2024-02-21' }],
  };
  const defs = [{ family: 'gemma', sources: [{ type: 'page', url, scopePattern: 'gemma' }] }];
  let result = await auditInventory(client, data, defs);
  assert.equal(result.families[0].comparison, 'review-variants');
  result = await auditInventory(client, data, defs, [
    {
      family: 'gemma',
      url: 'https://example.com/t5',
      disposition: 'date-unresolved',
      reason: 'Needs date',
    },
  ]);
  assert.equal(result.families[0].sources[0].records[0].comparison, 'reviewed-date-unresolved');
  // A deferred date remains a review item, not proof of complete coverage.
  assert.equal(result.families[0].comparison, 'review-dates');
  const bad = await auditInventory(client, data, [
    { family: 'gemma', sources: [{ type: 'page', url: url + '/missing', scopePattern: 'gemma' }] },
  ]);
  assert.equal(bad.families[0].comparison, 'review-source');
});

test('accessible HF history uses the first weight-bearing commit, not creation or later uploads', async () => {
  const base = 'https://huggingface.co/api/models/o/m';
  const c = fixture({
    [base + '/commits/main']: [
      { id: 'full', date: '2024-02-02T00:00:00Z' },
      { id: 'partial', date: '2024-02-01T00:00:00Z' },
      { id: 'empty', date: '2024-01-01T00:00:00Z' },
    ],
    [base + '/revision/empty']: {
      siblings: [{ rfilename: 'config.json' }, { rfilename: 'README.md' }],
    },
    [base + '/revision/partial']: { siblings: [{ rfilename: 'model-00001-of-00002.safetensors' }] },
    [base + '/revision/full']: {
      siblings: [
        { rfilename: 'model-00001-of-00002.safetensors' },
        { rfilename: 'model-00002-of-00002.safetensors' },
        { rfilename: 'model.safetensors.index.json' },
      ],
    },
    'https://huggingface.co/o/m/resolve/full/model.safetensors.index.json': {
      weight_map: { a: 'model-00001-of-00002.safetensors', b: 'model-00002-of-00002.safetensors' },
    },
  });
  const result = await checkpointHistory(c, 'https://huggingface.co/o/m', { allowRepositoryCreated: true });
  assert.equal(result.revision, 'partial');
  assert.equal(result.checkpointFileCount, 1);
  assert.equal(result.evidenceType, 'checkpoint-commit');
  assert.match(result.caveat, /Later commits are not model releases/);
});

test('gated history uses creation only with explicit review and actual weights', async () => {
  const base = 'https://huggingface.co/api/models/o/m';
  const responses = {
    [base + '/commits/main']: { status: 401, body: 'Gated' },
    [base]: { id: 'o/m', createdAt: '2024-01-02T03:04:05Z', siblings: [{ rfilename: 'model.safetensors' }] },
  };
  await assert.rejects(checkpointHistory(fixture(responses), 'https://huggingface.co/o/m'), /HTTP 401/);
  const result = await checkpointHistory(fixture(responses), 'https://huggingface.co/o/m', { allowRepositoryCreated: true });
  assert.equal(result.evidenceType, 'repository-created');
  assert.equal(result.date, '2024-01-02T03:04:05Z');
  assert.equal(result.metadataUrl, base);
  assert.match(result.caveat, /does not establish when weights/);
  for (const [metadata, expected] of [
    [{ ...responses[base], siblings: [{ rfilename: 'README.md' }] }, /actual model weights/],
    [{ ...responses[base], createdAt: 'unknown' }, /valid createdAt/],
    [{ ...responses[base], id: 'o/different' }, /identity mismatch/],
  ])
    await assert.rejects(checkpointHistory(fixture({ ...responses, [base]: metadata }), 'https://huggingface.co/o/m', { allowRepositoryCreated: true }), expected);
});

test('creation fallback does not mask missing snapshots, empty history, or rate limits', async () => {
  const url = 'https://huggingface.co/o/m';
  const api = 'https://huggingface.co/api/models/o/m/commits/main';
  for (const [responses, expected] of [
    [{}, /Missing from offline snapshot/],
    [{ [api]: [] }, /Empty or invalid/],
    [{ [api]: { status: 429, body: 'Too many requests' } }, /HTTP 429/],
  ])
    await assert.rejects(checkpointHistory(fixture(responses), url, { allowRepositoryCreated: true }), expected);
  const limited = fixture({ [api]: { status: 403, body: 'Rate limited' } });
  limited.blockedHosts.add('huggingface.co');
  await assert.rejects(checkpointHistory(limited, url, { allowRepositoryCreated: true }), /HTTP 403/);
});

test('an archived publisher page can preserve creation evidence for a removed repository', async () => {
  const url = 'https://huggingface.co/o/m';
  const archive = 'https://web.archive.org/web/20240512234656id_/' + url;
  const model = { id: 'o/m', createdAt: '2024-03-24T14:09:12Z', safetensors: { total: 1000 } };
  const html = '<div data-props="' + JSON.stringify({ model }).replaceAll('"', '&quot;') + '"></div>';
  assert.deepEqual(archivedHuggingFaceModel(html, 'o/m'), model);
  assert.throws(() => archivedHuggingFaceModel(html, 'o/other'), /no metadata/);
  const c = fixture({
    ['https://huggingface.co/api/models/o/m/commits/main']: { status: 401, body: 'Unavailable' },
    [archive]: { body: html },
  });
  const result = await checkpointHistory(c, url, { allowRepositoryCreated: true, archivedMetadataUrl: archive });
  assert.equal(result.date, model.createdAt);
  assert.equal(result.archivedSafetensorsParameters, 1000);
  assert.match(result.caveat, /Archived publisher metadata/);
  await assert.rejects(checkpointHistory(c, url, { allowRepositoryCreated: true, archivedMetadataUrl: archive.replace('/o/m', '/o/other') }), /exact publisher model URL/);
});
