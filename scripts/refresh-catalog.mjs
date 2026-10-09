import assert from 'node:assert/strict';
import { captureSoftwareCatalog, syncSoftwareReleases } from './software-releases.mjs';
import { captureGtaUpdates, syncGtaUpdates } from './gta-updates.mjs';
import { buildReleaseAudit, needsReleaseReview } from './release-audit.mjs';
import { auditWeights } from './weights-audit.mjs';
import { sha256, stableJSON } from './source-snapshot.mjs';

export const refreshInputHashes = (inputs) =>
  Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [key, sha256(stableJSON(value))]),
  );

export function prepareCatalogProposal(
  data,
  asOf,
  software,
  gta,
  gtaReviews,
  requests = {},
  weights,
) {
  assert.match(asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(asOf + 'T00:00:00Z').toISOString().slice(0, 10), asOf);
  assert.ok(asOf >= data.updated, 'Refresh cannot move the dataset snapshot backwards');
  let proposal = { ...structuredClone(data), updated: asOf };
  if (software) proposal = syncSoftwareReleases(proposal, software);
  if (gta) proposal = syncGtaUpdates(proposal, gta, gtaReviews);
  for (const source of proposal.sources)
    if (requests[source.url]?.status === 200) source.checkedAt = asOf;
  const verified = new Set(
    weights?.checks.filter((check) => check.status === 'verified').map((check) => check.url),
  );
  for (const release of proposal.releases)
    if (verified.has(release.huggingFaceUrl)) release.weightsCheckedAt = asOf;
  return proposal;
}

// All refresh work shares one bounded recorder, including duplicate URLs and
// pagination. Capture failures remain reports; no curated files are written.
export async function captureCatalogRefresh(client, inputs, asOf) {
  const { data, providers, decisions, pending, gtaReviews } = inputs;
  const errors = [];
  const capture = async (section, run) => {
    try {
      return await run();
    } catch (error) {
      errors.push({ section, error: error.message });
      return null;
    }
  };
  const [software, gta] = await Promise.all([
    capture('software', () => captureSoftwareCatalog(client, asOf)),
    capture('gta', () => captureGtaUpdates(client, asOf, gtaReviews)),
  ]);
  let proposal;
  try {
    proposal = prepareCatalogProposal(data, asOf, software, gta, gtaReviews);
  } catch (error) {
    errors.push({ section: 'proposal', error: error.message });
  }
  const auditData = proposal ?? { ...data, updated: asOf };
  const [releases, weights] = await Promise.all([
    capture('releases', () => buildReleaseAudit(client, auditData, providers, decisions, pending)),
    capture('weights', () => auditWeights(auditData, client)),
  ]);
  if (proposal)
    proposal = prepareCatalogProposal(
      data,
      asOf,
      software,
      gta,
      gtaReviews,
      client.snapshot.requests,
      weights,
    );
  if (releases && proposal) releases.inputs.releases = sha256(stableJSON(proposal));
  return {
    software,
    gta,
    releases,
    weights,
    proposal: errors.length ? null : proposal,
    errors: errors.sort((a, b) => a.section.localeCompare(b.section)),
  };
}

const providerCandidates = (report) =>
  report?.families.flatMap((family) =>
    family.sources.flatMap((source) =>
      source.records
        .filter((record) => record.comparison === 'review-variant-or-page')
        .map((record) => ({
          family: family.family,
          name: record.name,
          url: record.url,
          source: source.url,
        })),
    ),
  ) ?? [];
const candidateKey = (candidate) => `${candidate.family}\n${candidate.url}\n${candidate.name}`;
const withoutChecks = ({ weightsCheckedAt, ...release }) => release;

export function reviewCatalogRefresh(inputs, asOf, client, result, previousAudit = null) {
  const { data } = inputs;
  const before = new Map(data.releases.map((release) => [release.id, release]));
  const additions = [],
    changes = [];
  let refreshedReleaseCount = 0;
  for (const release of result.proposal?.releases ?? []) {
    const prior = before.get(release.id);
    if (!prior) additions.push(release);
    else if (stableJSON(withoutChecks(prior)) !== stableJSON(withoutChecks(release)))
      changes.push({ before: prior, after: release });
    else if (prior.weightsCheckedAt !== release.weightsCheckedAt) refreshedReleaseCount++;
  }
  const candidates = providerCandidates(result.releases);
  const priorKeys = new Set(providerCandidates(previousAudit).map(candidateKey));
  const recentTrackerCandidates =
    result.releases?.sources.flatMap((source) =>
      (source.records ?? [])
        .filter(
          (record) =>
            needsReleaseReview(record) && record.date >= data.updated && record.date <= asOf,
        )
        .map((record) => ({ tracker: source.id, ...record })),
    ) ?? [];
  const sourceFailures = [
    ...(result.releases?.families.flatMap((family) =>
      family.sources
        .filter((source) => source.error)
        .map((source) => ({ family: family.family, url: source.url, error: source.error })),
    ) ?? []),
    ...(result.releases?.sources
      .filter((source) => source.error)
      .map(({ id, url, error }) => ({ tracker: id, url, error })) ?? []),
    ...(result.releases?.collectionErrors ?? []),
  ];
  const artifacts = Object.fromEntries(
    Object.entries(result)
      .filter(([key]) => key !== 'errors')
      .map(([key, value]) => [key, sha256(stableJSON(value))]),
  );
  return {
    schemaVersion: 1,
    capturedAt: client.snapshot.capturedAt,
    asOf,
    previousDatasetDate: data.updated,
    inputs: refreshInputHashes(inputs),
    snapshotSha256: sha256(stableJSON(client.snapshot)),
    artifacts,
    errors: result.errors,
    canApplyControls: !result.errors.length,
    changes: { additions, changes, refreshedReleaseCount },
    sourceFailures,
    weightsNeedingReview:
      result.weights?.checks.filter((check) => check.status !== 'verified') ?? [],
    providerCandidateCount: candidates.length,
    newProviderCandidates: previousAudit
      ? candidates.filter((candidate) => !priorKeys.has(candidateKey(candidate)))
      : null,
    recentTrackerCandidates,
    note: 'Review the proposal and evidence before applying. Model candidates require curated identity, date, milestone, and version evidence. Gateway listing dates and repository timestamps are not model release dates. An unavailable source is not a clean audit.',
  };
}

export function assertReviewedRefresh(inputs, client, report, artifacts) {
  assert.equal(report.schemaVersion, 1, 'Unsupported refresh report');
  assert.ok(
    report.canApplyControls && !report.errors.length,
    'Refresh has failed captures; resolve them before applying',
  );
  assert.deepEqual(
    refreshInputHashes(inputs),
    report.inputs,
    'Curated inputs changed since review; replay the refresh before applying',
  );
  assert.equal(
    sha256(stableJSON(client.snapshot)),
    report.snapshotSha256,
    'Captured responses changed since review',
  );
  for (const [section, value] of Object.entries(artifacts))
    assert.equal(
      sha256(stableJSON(value)),
      report.artifacts[section],
      `Reviewed ${section} changed`,
    );
}
