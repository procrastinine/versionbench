import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { auditWeights } from './weights-audit.mjs';
const root = new URL('../', import.meta.url);
const data = JSON.parse(
  await readFile(new URL(process.argv[2] || 'data/releases.json', root), 'utf8'),
);
const report = await auditWeights(data);
await mkdir(new URL('output/', root), { recursive: true });
await writeFile(new URL('output/weights-audit.json', root), JSON.stringify(report, null, 2) + '\n');
const review = report.checks.filter((check) => check.status !== 'verified');
console.log(
  `Verified ${report.uniqueLinkCount - review.length}/${report.uniqueLinkCount} Hugging Face links across ${report.linkedReleaseCount} release events; ${review.length} need review. Report: output/weights-audit.json`,
);
for (const check of review.slice(0, 10)) console.error(`${check.url}: ${check.error}`);
if (review.length > 10)
  console.error(`See the report for ${review.length - 10} additional failures.`);
if (review.length) process.exitCode = 1;
else
  await writeFile(
    new URL('output/weights-audit.last-success.json', root),
    JSON.stringify(report, null, 2) + '\n',
  );
