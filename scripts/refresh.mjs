import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { SourceSnapshot, stableJSON } from './source-snapshot.mjs';
import { captureSoftwareCatalog } from './software-releases.mjs';
import { captureGtaUpdates } from './gta-updates.mjs';
import {
  captureCatalogRefresh,
  reviewCatalogRefresh,
  prepareCatalogProposal,
  assertReviewedRefresh,
} from './refresh-catalog.mjs';

const { values } = parseArgs({
  options: {
    offline: { type: 'boolean' },
    resume: { type: 'boolean' },
    apply: { type: 'boolean' },
    'retry-errors': { type: 'boolean' },
    'as-of': { type: 'string' },
    directory: { type: 'string', default: 'output/refresh' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log(`Usage: node scripts/refresh.mjs [--offline | --resume [--retry-errors] | --apply] [--as-of YYYY-MM-DD] [--directory DIR]
Default: capture every watch page, discovery catalog, weight link, Python/PyTorch release, and GTA history into one shared snapshot. Save a proposal and review.json; curated files stay unchanged.
--offline: rebuild the proposal and reports from saved responses, with no fetching.
--resume: finish a saved capture; this is not a fresh check. --retry-errors retries saved failures.
--apply: verify and apply the reviewed software/GTA evidence and verified check dates offline, then regenerate all artifacts. Model candidates are curated separately.
Exit 1 after capture means review is required; inspect review.json, including any failed sources.`);
  process.exit(0);
}
assert.ok(
  [values.offline, values.resume, values.apply].filter(Boolean).length <= 1,
  'Choose --offline, --resume, or --apply',
);
assert.ok(!values['retry-errors'] || values.resume, '--retry-errors requires --resume');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, values.directory);
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const optional = async (path) => {
  try {
    return await read(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};
const files = {
  data: 'data/releases.json',
  providers: 'data/provider-sources.json',
  decisions: 'data/discovery-decisions.json',
  pending: 'data/pending-releases.json',
  gtaReviews: 'data/gta-update-reviews.json',
  softwareEvidence: 'data/evidence/software-releases.json',
  gtaEvidence: 'data/evidence/gta-updates.json',
  candidateResolutions: 'data/candidate-resolutions.json',
  candidateEvidence: 'data/evidence/candidate-review.json',
};
const inputs = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [key, await read(resolve(root, path))]),
  ),
);
const savedReport = await optional(resolve(directory, 'review.json'));
const reuse = values.offline || values.resume || values.apply;
const client = reuse
  ? await SourceSnapshot.open(resolve(directory, 'snapshot.json'), {
      offline: !!(values.offline || values.apply),
      retryErrors: !!values['retry-errors'],
    })
  : new SourceSnapshot();
const asOf =
  values['as-of'] ??
  (reuse
    ? (savedReport?.asOf ?? client.snapshot.capturedAt.slice(0, 10))
    : client.snapshot.capturedAt.slice(0, 10));
assert.match(asOf, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(new Date(asOf + 'T00:00:00Z').toISOString().slice(0, 10), asOf);
assert.ok(asOf >= inputs.data.updated, 'Refresh cannot move the dataset snapshot backwards');
assert.ok(
  asOf <= client.snapshot.capturedAt.slice(0, 10),
  'Snapshot cannot establish a later check date',
);
const paths = {
  software: 'software-catalog.json',
  gta: 'gta-catalog.json',
  releases: 'release-audit.json',
  weights: 'weights-audit.json',
  proposal: 'proposal.json',
};
if (values.apply) {
  assert.ok(savedReport, 'Capture and review a refresh before applying');
  assert.equal(asOf, savedReport.asOf, 'Apply must use the reviewed cutoff date');
  const artifacts = Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, path]) => [key, await read(resolve(directory, path))]),
    ),
  );
  assertReviewedRefresh(inputs, client, savedReport, artifacts);
  const [software, gta] = await Promise.all([
    captureSoftwareCatalog(client, asOf),
    captureGtaUpdates(client, asOf, inputs.gtaReviews),
  ]);
  assert.deepEqual(software, artifacts.software, 'Software evidence does not replay');
  assert.deepEqual(gta, artifacts.gta, 'GTA evidence does not replay');
  const proposal = prepareCatalogProposal(
    inputs.data,
    asOf,
    software,
    gta,
    inputs.gtaReviews,
    client.snapshot.requests,
    artifacts.weights,
  );
  assert.deepEqual(proposal, artifacts.proposal, 'Proposal does not match captured evidence');
  await import('node:sqlite');
  await writeFile(resolve(root, 'data/evidence/software-releases.json'), stableJSON(software));
  await writeFile(resolve(root, 'data/evidence/gta-updates.json'), stableJSON(gta));
  await writeFile(resolve(root, files.data), stableJSON(proposal));
  await import('./generate.mjs');
  console.log(
    'Applied the reviewed refresh and regenerated the catalog. Review model candidates in release-audit.json separately.',
  );
} else {
  await mkdir(directory, { recursive: true });
  const previousPath = resolve(directory, 'previous-release-audit.json');
  const previousAudit = reuse
    ? await optional(previousPath)
    : await optional(resolve(directory, paths.releases));
  if (!reuse) await writeFile(previousPath, stableJSON(previousAudit));
  console.log(
    `Refreshing all sources through ${asOf}; evidence and proposals: ${values.directory}`,
  );
  const progress = setInterval(
    () =>
      console.log(
        `Captured ${Object.keys(client.snapshot.requests).length} responses; ${client.active} requests active.`,
      ),
    30000,
  );
  let result;
  try {
    result = await captureCatalogRefresh(client, inputs, asOf);
  } finally {
    clearInterval(progress);
    if (!values.offline) await client.save(resolve(directory, 'snapshot.json'));
  }
  // Normalize request ordering for identical live/replay manifest checksums.
  client.snapshot.requests = Object.fromEntries(
    Object.entries(client.snapshot.requests).sort(([a], [b]) => a.localeCompare(b)),
  );
  for (const [key, path] of Object.entries(paths))
    await writeFile(resolve(directory, path), stableJSON(result[key]));
  const review = reviewCatalogRefresh(inputs, asOf, client, result, previousAudit);
  await writeFile(resolve(directory, 'review.json'), stableJSON(review));
  console.log(
    `${review.changes.additions.length} proposed releases, ${review.changes.changes.length} changed events; ${review.sourceFailures.length} source failures, ${review.weightsNeedingReview.length} weight links need review.`,
  );
  console.log(
    `Review ${values.directory}/review.json and proposal.json. After review: node scripts/refresh.mjs --apply${values.directory === 'output/refresh' ? '' : ` --directory ${values.directory}`}`,
  );
  for (const error of review.errors) console.error(`${error.section}: ${error.error}`);
  // A proposal always awaits review, including a refresh of check dates only.
  process.exitCode = 1;
}
