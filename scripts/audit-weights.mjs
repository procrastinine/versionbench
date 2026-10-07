import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWeights } from './weights-audit.mjs';
import { SourceSnapshot, stableJSON } from './source-snapshot.mjs';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'retry-errors': { type: 'boolean' },
    offline: { type: 'boolean' },
    resume: { type: 'boolean' },
    snapshot: { type: 'string', default: 'output/weights-snapshot.json' },
    report: { type: 'string', default: 'output/weights-audit.json' },
  },
});
if (values.offline && values.resume) throw new Error('Choose --offline or --resume');
const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(
  await readFile(resolve(root, positionals[0] || 'data/releases.json'), 'utf8'),
);
const client =
  values.offline || values.resume
    ? await SourceSnapshot.open(resolve(root, values.snapshot), {
        offline: !!values.offline,
        retryErrors: !!values['retry-errors'],
      })
    : new SourceSnapshot();
const report = await auditWeights(data, client);
if (!values.offline) await client.save(resolve(root, values.snapshot));
const reportPath = resolve(root, values.report);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, stableJSON(report));
const review = report.checks.filter((check) => check.status !== 'verified');
console.log(
  `Verified ${report.uniqueLinkCount - review.length}/${report.uniqueLinkCount} Hugging Face links across ${report.linkedReleaseCount} release events; ${review.length} need review. Report: ${values.report}`,
);
for (const check of review) console.error(`${check.url}: ${check.error}`);
if (review.length) process.exitCode = 1;
else await writeFile(resolve(root, 'output/weights-audit.last-success.json'), stableJSON(report));
