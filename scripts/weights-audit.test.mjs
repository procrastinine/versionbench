import test from 'node:test';
import assert from 'node:assert/strict';
import { auditWeights, huggingFaceTarget, inspectCheckpoint } from './weights-audit.mjs';

test('rejects non-model links and tokenizer-only repositories', () => {
  for (const url of [
    'https://example.com/model/name',
    'https://huggingface.co/owner',
    'https://huggingface.co/spaces/owner/demo',
  ])
    assert.throws(() => huggingFaceTarget(url));
  assert.throws(() =>
    inspectCheckpoint({ siblings: [{ rfilename: 'tokenizer.bin' }, { rfilename: 'README.md' }] }),
  );
});

test('accepts gated and alternate-format checkpoints without inferring licenses', () => {
  const model = {
    id: 'owner/model',
    gated: 'auto',
    siblings: [{ rfilename: 'model.safetensors' }],
  };
  assert.equal(inspectCheckpoint(model).gated, 'auto');
  for (const rfilename of ['gemma.tflite', 'gemma.litertlm', 'ckpt/tensor00000_000'])
    assert.equal(inspectCheckpoint({ siblings: [{ rfilename }] }).checkpointFileCount, 1);
});

test('collections must contain actual model weights; failed requests remain failures', async () => {
  const data = {
    releases: [
      { huggingFaceUrl: 'https://huggingface.co/collections/owner/models' },
      { huggingFaceUrl: 'https://huggingface.co/owner/missing' },
    ],
  };
  const fetcher = async (url) => ({
    ok: !url.endsWith('/missing'),
    status: 404,
    json: async () =>
      url.includes('/collections/')
        ? { title: 'models', items: [{ type: 'model', id: 'owner/tokenizer' }] }
        : { siblings: [{ rfilename: 'tokenizer.json' }] },
  });
  const report = await auditWeights(data, fetcher);
  assert.ok(report.checks.every((check) => check.status === 'review'));
});

test('stops issuing new requests after a rate limit and marks unchecked links as deferred', async () => {
  const data = {
    releases: Array.from({ length: 100 }, (_, i) => ({
      huggingFaceUrl: `https://huggingface.co/owner/model${i}`,
    })),
  };
  let requests = 0;
  const report = await auditWeights(data, async () => {
    requests++;
    return { ok: false, status: 429, headers: new Headers({ ratelimit: '"api";r=0;t=23' }) };
  });
  assert.ok(requests <= 6, 'Only the initial concurrent requests should be sent');
  assert.equal(report.checks.length, 100);
  assert.ok(
    report.checks.every(
      (check) => check.status === 'deferred' && check.error.includes('23 seconds'),
    ),
  );
});
