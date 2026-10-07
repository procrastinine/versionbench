import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256 } from './source-snapshot.mjs';

test('a fresh copy builds reproducibly with no network permission or audit cache', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'versionbench-offline-')));
  try {
    for (const name of ['data', 'src', 'scripts', 'docs'])
      await cp(join(root, name), join(dir, name), { recursive: true });
    // Prove permission denial, rather than hoping this machine lacks a connection.
    const flags = ['--permission', `--allow-fs-read=${dir}`, `--allow-fs-write=${dir}`];
    const permission = execFileSync(
      process.execPath,
      [...flags, '-e', 'process.stdout.write(String(process.permission.has("net")))'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.equal(permission, 'false');
    const outputs = [
      'README.md',
      'index.html',
      'data/README.md',
      'data/stats.json',
      'data/releases.csv',
      'data/families.csv',
      'data/sources.csv',
      'data/family-stats.csv',
      'data/versionbench.sqlite',
      'docs/source-watchlist.md',
      'docs/history-audit.md',
      'docs/pending-releases.md',
    ];
    const build = () =>
      execFileSync(process.execPath, [...flags, 'scripts/generate.mjs'], {
        cwd: dir,
        encoding: 'utf8',
      });
    assert.match(build(), /PASS:/);
    const first = await Promise.all(outputs.map(async (p) => sha256(await readFile(join(dir, p)))));
    assert.match(build(), /PASS:/);
    const second = await Promise.all(
      outputs.map(async (p) => sha256(await readFile(join(dir, p)))),
    );
    assert.deepEqual(first, second);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
