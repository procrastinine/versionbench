import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCandidateReview } from './candidate-review.mjs';
import { checkpointHistory } from './checkpoint-history.mjs';
import { SourceSnapshot } from './source-snapshot.mjs';

const read = async (path) => JSON.parse(await readFile(new URL('../' + path, import.meta.url)));

test('reviewed candidates remain accounted for, with valid release and evidence references', async () => {
  const data = await read('data/releases.json');
  const pending = await read('data/pending-releases.json');
  const decisions = await read('data/candidate-resolutions.json');
  const evidence = await read('data/evidence/candidate-review.json');
  validateCandidateReview(data, pending, decisions, evidence);
  const added = decisions.find((r) => r.outcome === 'added');
  const removed = decisions.filter((r) => r.id !== added.id);
  assert.throws(() => validateCandidateReview(data, pending, removed, evidence), /Candidate lost/);
  assert.throws(() => validateCandidateReview(data, [...pending, added], decisions, evidence), /resolved twice/);
  const missing = decisions.map((r) => r.id === added.id ? { ...r, releaseIds: ['missing'] } : r);
  assert.throws(() => validateCandidateReview(data, pending, missing, evidence), /Invalid resolution release/);
  const wrongEvidence = decisions.map((r) => r.id === added.id ? { ...r, evidenceIds: ['missing'] } : r);
  assert.throws(() => validateCandidateReview(data, pending, wrongEvidence, evidence), /Missing saved evidence/);
});

test('saved repository-creation evidence reproduces every reviewed fallback without network', async () => {
  const data = await read('data/releases.json');
  const manifest = await read('data/checkpoint-imports.json');
  const mappings = manifest.filter((r) => r.allowRepositoryCreated);
  const client = await SourceSnapshot.open(new URL('../data/evidence/hf-date-fallbacks.json', import.meta.url), {
    offline: true,
    fetcher: () => { throw new Error('Unexpected network request'); },
  });
  assert.ok(mappings.length > 0, 'Missing reviewed fallback mappings');
  for (const entry of mappings) {
    const url = 'https://huggingface.co/' + entry.repository;
    const evidence = await checkpointHistory(client, url, entry);
    const matches = data.releases.filter((r) => r.eventType === 'checkpoint' && (r.dateRepositoryUrl ?? r.huggingFaceUrl) === url);
    assert.equal(matches.length, 1, 'Exactly one first-date record per original repository');
    assert.equal(matches[0].date, evidence.date.slice(0, 10));
    assert.equal(matches[0].dateBasis, evidence.evidenceType);
    assert.equal(matches[0].status, 'Repository created (fallback)');
    assert.equal(data.sources.find((s) => s.id === matches[0].sourceId).url, evidence.metadataUrl);
  }
});
