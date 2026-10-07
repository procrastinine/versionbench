import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SourceSnapshot, stableJSON } from './source-snapshot.mjs';
import { checkpointHistory } from './checkpoint-history.mjs';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    offline: { type: 'boolean' },
    resume: { type: 'boolean' },
    snapshot: { type: 'string', default: 'output/checkpoint-snapshot.json' },
    report: { type: 'string', default: 'output/checkpoint-history.json' },
  },
});
if (!positionals.length || (values.offline && values.resume))
  throw new Error('Supply model URLs; use either --offline or --resume, not both');
const client =
  values.offline || values.resume
    ? await SourceSnapshot.open(values.snapshot, { offline: !!values.offline })
    : new SourceSnapshot();
const records = await Promise.all(
  [...new Set(positionals)].sort().map(async (url) => {
    try {
      return await checkpointHistory(client, url);
    } catch (error) {
      return { url, error: error.message };
    }
  }),
);
if (!values.offline) await client.save(values.snapshot);
await mkdir(dirname(values.report), { recursive: true });
await writeFile(values.report, stableJSON({ capturedAt: client.snapshot.capturedAt, records }));
for (const r of records) console.log(r.url, r.date || r.error, r.revision || '');
if (records.some((r) => r.error)) process.exitCode = 1;
