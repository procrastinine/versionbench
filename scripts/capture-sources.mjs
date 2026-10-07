import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { SourceSnapshot } from './source-snapshot.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    snapshot: { type: 'string', default: 'output/evidence-snapshot.json' },
    input: { type: 'string' },
    resume: { type: 'boolean', default: false },
    'retry-errors': { type: 'boolean' },
    offline: { type: 'boolean', default: false },
  },
});
if (values.offline && values.resume) throw new Error('Choose --offline or --resume');
// A JSON array of exact URLs is a repeatable capture recipe. HTTPS only;
// contents are stored as data and never executed.
const urls = [
  ...new Set([
    ...positionals,
    ...(values.input ? JSON.parse(await readFile(values.input, 'utf8')) : []),
  ]),
].sort();
if (!urls.length) throw new Error('Pass HTTPS URLs or --input urls.json');
const client =
  values.resume || values.offline
    ? await SourceSnapshot.open(values.snapshot, {
        offline: values.offline,
        retryErrors: !!values['retry-errors'],
      })
    : new SourceSnapshot();
await Promise.all(
  urls.map(async (url) => {
    try {
      const row = await client.request(url);
      console.log(`${row.status} ${row.sha256} ${url}`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }),
);
if (!values.offline) await client.save(values.snapshot);
