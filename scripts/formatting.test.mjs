import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFormatting } from '../src/format.js';
import { numericVersion } from './version.mjs';

const { score, numberLabel, calculatedLabel, spreadLabel } = createFormatting({});
test('version scores retain every patch digit in shared labels', async () => {
  for (const [version, expected] of [
    ['3.11.17', '3.1117'],
    ['3.10.22', '3.1022'],
    ['3.13.16', '3.1316'],
    ['3.9.10', '3.91'],
    ['2.9.3', '2.93'],
    ['3.10', '3.1'],
    ['3.11.17.123', '3.1117123'],
  ]) {
    const value = numericVersion(version);
    assert.equal(score({ score: value }), expected);
    assert.equal(numberLabel(value), expected);
  }
  const data = JSON.parse(await readFile(new URL('../data/releases.json', import.meta.url)));
  for (const release of data.releases)
    assert.equal(Number(score(release)), release.score, `Display changed ${release.name}'s score`);
});
test('derived chart ticks and spreads remove floating-point noise without truncating scores', () => {
  assert.equal(calculatedLabel(3.9 - 3.3), '0.6');
  assert.equal(calculatedLabel(0.1 + 0.2), '0.3');
  assert.equal(spreadLabel(3.1117, 3.1116), '0.0001');
  assert.equal(spreadLabel(3.9, 3.3), '0.6');
  assert.equal(spreadLabel(0.0000002, 0.0000001), '1e-7');
  assert.equal(numberLabel(NaN), '—');
});
