import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artifactExclusion } from './release-policy.mjs';
import { inventorySource } from './source-inventory.mjs';

test('precision and packaging variants cannot become independent releases', () => {
  for (const name of [
    'dphn/Dolphin-2.9.3-GGUF',
    'model-ggml',
    'model-AWQ',
    'model-GPTQ',
    'model-exl2-6bpw',
    'model-FP8',
    'model-NVFP4',
    'model-INT4',
    'model-4bit',
    'model-4-bit',
    'model-Q4_K_M',
    'model-iq4_xs',
    'model-MLX-BF16',
    'model-ONNX',
    'model-quantized',
    'model-keras',
    'model-pytorch',
    'model-jax',
    'model-flax',
    'model-litert-lm',
    'model-qat-w4a16-ct',
  ])
    assert.ok(artifactExclusion(name), name);
  for (const name of [
    'Bonsai-1bit-8B',
    'Ternary Bonsai 2',
    'SmolLM2-1.7B',
    'Dolphin-2.9.3-Mistral-Nemo-12B',
    'Jan-v3.5-4B',
    'Solar-Mini-4',
    'PyTorch 2.0',
  ])
    assert.equal(artifactExclusion(name), null, name);
});

test('excluded repositories remain visible but cannot supply discovered versions', async () => {
  const client = {
    request: async () => ({
      status: 200,
      body: JSON.stringify([
        { id: 'org/Example-1' },
        { id: 'org/Example-9-GGUF' },
        { id: 'org/Example-8-FP8' },
      ]),
      headers: {},
    }),
  };
  // Use the same JSON interface as a recorded source client.
  client.json = async () => JSON.parse((await client.request()).body);
  const result = await inventorySource(client, {
    type: 'huggingface',
    author: 'org',
    scopePattern: 'Example',
    pattern: 'Example-([0-9.]+)',
  });
  assert.equal(result.records.filter((r) => r.excluded).length, 2);
  assert.deepEqual(
    result.versions.map((v) => v.version),
    ['1'],
  );
});
