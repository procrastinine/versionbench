import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceSnapshot, stableJSON, sha256 } from './source-snapshot.mjs';
import { checkpointHistory } from './checkpoint-history.mjs';
import { numericVersion } from './version.mjs';
import { artifactExclusion } from './release-policy.mjs';
const { values } = parseArgs({
  options: {
    family: { type: 'string' },
    offline: { type: 'boolean' },
    resume: { type: 'boolean' },
    apply: { type: 'boolean' },
    'retry-errors': { type: 'boolean' },
    snapshot: { type: 'string', default: 'output/checkpoint-import-snapshot.json' },
    report: { type: 'string', default: 'output/checkpoint-import.json' },
  },
});
if (values.offline && values.resume) throw new Error('Choose --offline or --resume');
const root = fileURLToPath(new URL('../', import.meta.url));
const dataPath = resolve(root, 'data/releases.json');
const data = JSON.parse(await readFile(dataPath));
const manifest = JSON.parse(await readFile(resolve(root, 'data/checkpoint-imports.json')));
const entries = manifest.filter(
  (r) => !values.family || values.family.split(',').includes(r.family),
);
if (!entries.length) throw new Error('No matching reviewed repository mappings');
const client =
  values.offline || values.resume
    ? await SourceSnapshot.open(resolve(root, values.snapshot), {
        offline: !!values.offline,
        retryErrors: !!values['retry-errors'],
      })
    : new SourceSnapshot();
const records = await Promise.all(
  entries.map(async (entry) => {
    try {
      if (!data.families.some((f) => f.id === entry.family)) throw new Error('Unknown family');
      numericVersion(entry.version);
      if (artifactExclusion(entry.repository) || artifactExclusion(entry.name))
        throw new Error('Quantizations and format conversions are not release imports');
      const evidence = await checkpointHistory(
        client,
        `https://huggingface.co/${entry.repository}`,
      );
      if (evidence.date.slice(0, 10) > data.updated)
        throw new Error('Checkpoint newer than dataset snapshot');
      return { ...entry, evidence };
    } catch (error) {
      return { ...entry, error: error.message };
    }
  }),
);
if (!values.offline) await client.save(resolve(root, values.snapshot));
const report = {
  capturedAt: client.snapshot.capturedAt,
  manifestHash: sha256(stableJSON(entries)),
  records,
};
await mkdir(dirname(resolve(root, values.report)), { recursive: true });
await writeFile(resolve(root, values.report), stableJSON(report));
for (const r of records)
  console.log(
    `${r.repository}: ${r.error || `${r.version} -> ${numericVersion(r.version)}, checkpoint commit ${r.evidence.date}`}`,
  );
if (records.some((r) => r.error)) {
  process.exitCode = 1;
  if (values.apply) throw new Error('Resolve failed repositories before applying this import');
} else if (values.apply) {
  for (const r of records) {
    const { evidence } = r;
    const date = evidence.date.slice(0, 10);
    const slug = r.repository.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const sourceId = `checkpoint-${slug}`;
    const existingSource = data.sources.find((s) => s.url === evidence.commitUrl);
    const priorSource = data.sources.find((s) => s.id === sourceId);
    if (priorSource && priorSource.url !== evidence.commitUrl)
      throw new Error(
        `Checkpoint history changed for ${r.repository}; review the existing source before applying`,
      );
    if (!existingSource && !data.sources.some((s) => s.id === sourceId))
      data.sources.push({
        id: sourceId,
        title: `${r.name}: first commit containing model weights`,
        url: evidence.commitUrl,
        publisher: data.families.find((f) => f.id === r.family).provider,
        date,
        checkedAt: data.updated,
      });
    const id = `${r.family}-${slug}-checkpoint-${date}`;
    const existingRelease = data.releases.find(
      (release) =>
        release.eventType === 'checkpoint' &&
        release.huggingFaceUrl?.toLowerCase() === evidence.url.toLowerCase(),
    );
    if (
      existingRelease &&
      (existingRelease.date !== date ||
        data.sources.find((s) => s.id === existingRelease.sourceId)?.url !== evidence.commitUrl)
    )
      throw new Error(
        `First weights evidence changed for ${r.repository}; review the existing record instead of adding a later commit`,
      );
    if (!existingRelease && !data.releases.some((release) => release.id === id))
      data.releases.push({
        id,
        family: r.family,
        name: r.name,
        version: r.version,
        score: numericVersion(r.version),
        date,
        eventType: 'checkpoint',
        status: 'First weights commit',
        dateBasis: 'checkpoint-commit',
        sourceId: existingSource?.id ?? sourceId,
        note: evidence.caveat + ' Date uses UTC.',
        mapping: r.mapping,
        weightsStatus: 'open',
        weightsCheckedAt: data.updated,
        weightsSourceUrl: evidence.url,
        huggingFaceUrl: evidence.url,
      });
  }
  data.sources.sort((a, b) => a.id.localeCompare(b.id));
  data.releases.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.family.localeCompare(b.family) ||
      a.name.localeCompare(b.name),
  );
  await writeFile(dataPath, stableJSON(data));
  console.log(
    `Applied ${records.length} reviewed checkpoint histories. Run node scripts/generate.mjs.`,
  );
}
