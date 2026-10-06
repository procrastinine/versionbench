import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  observedVersions,
  compareProviderVersions,
  auditProviders,
  pageText,
} from './provider-audit.mjs';

const definitions = JSON.parse(
  await readFile(new URL('../data/provider-sources.json', import.meta.url)),
);
const pattern = (family, author) =>
  definitions.find((d) => d.family === family).sources.find((s) => !author || s.author === author)
    .pattern;

test('official repositories expose versions missing from secondary catalogs', () => {
  for (const [family, name, previous, current, author] of [
    ['jamba', 'ai21labs/AI21-Jamba2-Mini', 1.7, 2],
    ['reka', 'RekaAI/reka-flash-3.1', 3, 3.1],
    ['intellect', 'PrimeIntellect/INTELLECT-3.1', 3, 3.1],
    ['internlm', 'OpenGVLab/InternVL3_5-241B-A28B', 3, 3.5, 'OpenGVLab'],
  ]) {
    const versions = observedVersions(name, pattern(family, author));
    assert.equal(versions[0].score, current);
    const result = compareProviderVersions([{ score: previous }], versions);
    assert.equal(result.comparison, 'review-higher-version');
    assert.equal(result.higherVersions[0].score, current);
  }
});

test('parameter counts, checkpoint dates, and backbone versions are not family versions', () => {
  for (const [family, name, expected] of [
    ['yi', '01-ai/Yi-34B', []],
    ['qwen', 'Qwen/Qwen-72B', []],
    ['apriel', 'ServiceNow-AI/Apriel-5B-Base', []],
    ['falcon', 'tiiuae/falcon-180B', []],
    ['mistral', 'mistralai/Mistral-Small-2506', []],
    ['hermes', 'NousResearch/Hermes-4-Llama-3.1-70B', [4]],
    ['cogito', 'deepcogito/cogito-671b-v2.1', [2.1]],
  ])
    assert.deepEqual(
      observedVersions(name, pattern(family)).map((r) => r.score),
      expected,
    );
});

test('an unconfigured family is an explicit review failure', async () => {
  const result = await auditProviders({ families: [{ id: 'new-family' }], releases: [] }, []);
  assert.equal(result[0].comparison, 'review-source');
});

test('a lower current numbering does not erase the historical maximum', () => {
  const result = compareProviderVersions([{ score: 4 }], [{ score: 3.5, version: '3.5' }]);
  assert.equal(result.highestRecorded, 4);
  assert.equal(result.comparison, 'no-higher-version-observed');
});

test('URL slugs and script payloads cannot invent model versions', () => {
  const html = '<a href="/grok-47">Grok 4.7</a><script>"grok-47"</script>';
  assert.deepEqual(
    observedVersions(pageText(html), pattern('grok')).map((r) => r.score),
    [4.7],
  );
});

test('GTA control converts only an explicitly configured Roman numeral', () => {
  const source = definitions.find((d) => d.family === 'gta').sources[0];
  const releases = observedVersions(
    'Grand Theft Auto V for PlayStation 5; GTA V Enhanced; GTA VI',
    source.pattern,
    source.versionMap,
  );
  assert.deepEqual(
    releases.map((r) => r.score),
    [5],
  );
  assert.throws(
    () => observedVersions('Grand Theft Auto V', source.pattern),
    /Missing numeric version/,
  );
});
