import assert from 'node:assert/strict';

// Decisions are curated data. Building and checking them never visits a source.
export function validateCandidateReview(data, pending, resolutions, evidence) {
  const families = new Set(data.families.map((f) => f.id));
  const releases = new Map(data.releases.map((r) => [r.id, r]));
  const observations = new Map(evidence.observations.map((r) => [r.id, r]));
  assert.equal(observations.size, evidence.observations.length, 'Duplicate evidence ID');
  const ids = new Set(pending.map((r) => r.id));
  for (const row of resolutions) {
    assert.ok(!ids.has(row.id), `Candidate is pending or resolved twice: ${row.id}`);
    ids.add(row.id);
    assert.ok(families.has(row.family) && row.name && row.reason, 'Incomplete resolution');
    assert.ok(['added', 'updated', 'covered', 'excluded'].includes(row.outcome), 'Unknown outcome');
    assert.match(row.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.checkedAt <= data.updated, 'Future candidate review');
    assert.ok(Array.isArray(row.releaseIds), 'Missing resolution release references');
    assert.equal(row.releaseIds.length === 0, row.outcome === 'excluded', 'Included decisions need releases; excluded decisions cannot add them');
    for (const id of row.releaseIds)
      assert.equal(releases.get(id)?.family, row.family, `Invalid resolution release: ${id}`);
    assert.ok(row.evidenceIds?.length, 'Resolution needs saved evidence');
    for (const id of row.evidenceIds) assert.ok(observations.has(id), `Missing saved evidence: ${id}`);
  }
  assert.equal(new Set(evidence.candidateIds).size, evidence.candidateIds.length, 'Duplicate candidate in evidence batch');
  for (const id of evidence.candidateIds)
    assert.ok(ids.has(id), `Candidate lost from pending and resolved lists: ${id}`);
  for (const observation of observations.values()) {
    assert.ok(observation.type && observation.checkedAt, 'Incomplete saved observation');
    if (observation.url) {
      assert.equal(new URL(observation.url).protocol, 'https:');
      assert.match(observation.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(observation.facts && Object.keys(observation.facts).length, 'Missing observed facts');
    } else {
      assert.ok(observation.releaseIds?.length && observation.sourceUrls?.length, 'Missing existing evidence');
      for (const id of observation.releaseIds) assert.ok(releases.has(id), `Stale evidence release: ${id}`);
      for (const url of observation.sourceUrls) assert.equal(new URL(url).protocol, 'https:');
    }
  }
}
