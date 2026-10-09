import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSnapshot } from './source-snapshot.mjs';
import { pythonArchive, pytorchReleases } from './software-releases.mjs';
import { gtaHistoryAPI } from './gta-updates.mjs';
import {
  captureCatalogRefresh,
  reviewCatalogRefresh,
  assertReviewedRefresh,
} from './refresh-catalog.mjs';

const fixture = (failSoftware = false) => {
  const asOf = '2026-10-09';
  const modelURL = 'https://example.org/gpt';
  const checkpointURL = 'https://huggingface.co/example/GPT-1';
  const inputs = {
    data: {
      updated: '2026-10-07',
      families: [
        { id: 'gpt', name: 'GPT', provider: 'Example', kind: 'model' },
        ...['python', 'pytorch', 'gta'].map((id) => ({
          id,
          name: id,
          provider: id,
          kind: 'software',
        })),
      ],
      releases: [
        {
          id: 'gpt-1',
          family: 'gpt',
          name: 'GPT 1',
          version: '1',
          score: 1,
          date: '2020-01-01',
          huggingFaceUrl: checkpointURL,
          weightsCheckedAt: '2026-10-07',
        },
      ],
      sources: [{ id: 'gpt-docs', url: modelURL, checkedAt: '2026-10-07' }],
    },
    providers: [
      { family: 'gpt', sources: [{ type: 'page', url: modelURL, scopePattern: 'GPT' }] },
      { family: 'python', sources: [{ type: 'page', url: pythonArchive, scopePattern: 'Python' }] },
      { family: 'pytorch', sources: [{ type: 'page', url: pytorchReleases, scopePattern: 'v0' }] },
      {
        family: 'gta',
        sources: [{ type: 'page', url: gtaHistoryAPI, scopePattern: 'Title_Update' }],
      },
    ],
    decisions: [],
    pending: [],
    gtaReviews: [],
  };
  const bodies = new Map([
    [
      pythonArchive,
      '<li><a href="https://docs.python.org/release/3.0/">Python 3.0</a>, released on 3 December 2008</li><li><a href="https://docs.python.org/release/3.15.0/">Python 3.15.0</a>, released on 9 October 2026</li>',
    ],
    [
      pytorchReleases,
      JSON.stringify([
        {
          tag_name: 'v0.1.6',
          html_url: 'https://github.com/pytorch/pytorch/releases/tag/v0.1.6',
          published_at: '2017-02-02T12:00:00Z',
          draft: false,
          prerelease: false,
        },
      ]),
    ],
    [
      gtaHistoryAPI,
      JSON.stringify({
        parse: {
          wikitext:
            '==Version History==\n{|\n|-\n! Release Date\n! PS3\n! PS4\n! PC\n! PS5\n|-\n|01 Oct 2013\n|1.01<br>[[Grand_Theft_Auto_V/Title_Update_Notes/Update-2013-10-01|Notes]]\n|\n|\n|\n|}',
        },
      }),
    ],
    [modelURL, '<p>GPT 1 is the current model with a documented identity.</p>'],
    [
      'https://huggingface.co/api/models/example/GPT-1',
      JSON.stringify({ id: 'example/GPT-1', siblings: [{ rfilename: 'model.safetensors' }] }),
    ],
  ]);
  const calls = new Map();
  const client = new SourceSnapshot(undefined, {
    fetcher: async (url) => {
      calls.set(url, (calls.get(url) ?? 0) + 1);
      if ((failSoftware && url === pytorchReleases) || !bodies.has(url))
        return new Response('Unavailable', { status: 503 });
      return new Response(bodies.get(url));
    },
  });
  client.snapshot.capturedAt = asOf + 'T12:00:00.000Z';
  return { asOf, inputs, client, calls };
};

test('one shared refresh captures controls, watchlists and weights without duplicate requests or catalog mutation', async () => {
  const { asOf, inputs, client, calls } = fixture();
  const before = structuredClone(inputs);
  const result = await captureCatalogRefresh(client, inputs, asOf);
  assert.deepEqual(inputs, before);
  assert.deepEqual(result.errors, []);
  assert.equal(
    calls.get(pythonArchive),
    1,
    'software importer and watchlist share the archive response',
  );
  assert.equal(calls.get(pytorchReleases), 1);
  assert.equal(calls.get(gtaHistoryAPI), 1);
  assert.equal(result.proposal.updated, asOf);
  const python = result.proposal.releases.find((release) => release.version === '3.15.0');
  assert.equal(python.date, '2026-10-09');
  assert.equal(python.score, 3.15);
  assert.equal(result.proposal.releases.find((release) => release.family === 'gta').score, 5);
  assert.equal(
    result.proposal.releases.find((release) => release.id === 'gpt-1').weightsCheckedAt,
    asOf,
  );
  const report = reviewCatalogRefresh(inputs, asOf, client, result);
  assert.equal(report.changes.additions.length, 4);
  assert.ok(report.sourceFailures.length > 0, 'unavailable discovery catalogs remain visible');
  const offline = new SourceSnapshot(structuredClone(client.snapshot), {
    offline: true,
    fetcher: () => {
      throw new Error('Network access during replay');
    },
  });
  const replay = await captureCatalogRefresh(offline, inputs, asOf);
  assert.deepEqual(replay, result);
  assert.deepEqual(reviewCatalogRefresh(inputs, asOf, offline, replay), report);
});

test('failed control capture preserves other reports and refuses application', async () => {
  const { asOf, inputs, client } = fixture(true);
  const before = structuredClone(inputs);
  const result = await captureCatalogRefresh(client, inputs, asOf);
  assert.deepEqual(inputs, before);
  assert.equal(result.proposal, null);
  assert.ok(result.gta && result.releases && result.weights);
  assert.match(result.errors.find((error) => error.section === 'software').error, /HTTP 503/);
  const report = reviewCatalogRefresh(inputs, asOf, client, result);
  assert.equal(report.canApplyControls, false);
  assert.throws(() => assertReviewedRefresh(inputs, client, report, {}), /failed captures/);
});

test('later pulls identify new named candidates without repeating the preceding inventory', async () => {
  const { asOf, inputs, client } = fixture();
  const result = await captureCatalogRefresh(client, inputs, asOf);
  const old = structuredClone(result.releases);
  const source = result.releases.families.find((family) => family.family === 'gpt').sources[0];
  const candidate = {
    name: 'GPT 2 Preview',
    url: 'https://example.org/gpt-2',
    comparison: 'review-variant-or-page',
  };
  source.records.push(candidate);
  const report = reviewCatalogRefresh(inputs, asOf, client, result, old);
  assert.deepEqual(report.newProviderCandidates, [
    { family: 'gpt', name: candidate.name, url: candidate.url, source: source.url },
  ]);
  const repeated = reviewCatalogRefresh(inputs, asOf, client, result, result.releases);
  assert.deepEqual(repeated.newProviderCandidates, []);
});

test('apply rejects stale curated inputs, altered proposals and changed captures', async () => {
  const { asOf, inputs, client } = fixture();
  const result = await captureCatalogRefresh(client, inputs, asOf);
  const report = reviewCatalogRefresh(inputs, asOf, client, result);
  const { errors, ...artifacts } = result;
  assert.doesNotThrow(() => assertReviewedRefresh(inputs, client, report, artifacts));
  const edited = structuredClone(inputs);
  edited.data.releases[0].name = 'A user edit made during review';
  assert.throws(
    () => assertReviewedRefresh(edited, client, report, artifacts),
    /Curated inputs changed/,
  );
  const altered = structuredClone(artifacts);
  altered.proposal.releases[0].date = '2026-01-01';
  assert.throws(
    () => assertReviewedRefresh(inputs, client, report, altered),
    /Reviewed proposal changed/,
  );
  client.snapshot.requests[pythonArchive].body += 'changed';
  assert.throws(
    () => assertReviewedRefresh(inputs, client, report, artifacts),
    /Captured responses changed/,
  );
});
