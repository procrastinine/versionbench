import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openRouterModels } from './source-data.mjs';

test('OpenRouter contributes discovery metadata with listing dates, without prices or capability scores', () => {
  const [row] = openRouterModels(
    JSON.stringify({
      data: [
        {
          id: 'vendor/model-2',
          name: 'Vendor: Model 2',
          created: 1735689600,
          hugging_face_id: 'vendor/model-2',
          pricing: { prompt: '0.001' },
          intelligence: 99,
        },
      ],
    }),
  );
  assert.deepEqual(row, {
    name: 'Vendor: Model 2',
    provider: 'vendor',
    url: 'https://openrouter.ai/vendor/model-2',
    date: '2025-01-01',
    dateBasis: 'gateway-listing',
    huggingFaceUrl: 'https://huggingface.co/vendor/model-2',
  });
  assert.throws(() => openRouterModels('{"data":[]}'), /Unsupported/);
});

test('OpenRouter rolling aliases are retained as excluded inventory records', () => {
  const [row] = openRouterModels(
    JSON.stringify({
      data: [{ id: '~vendor/model-latest', name: 'Vendor: Latest', created: 1735689600 }],
    }),
  );
  assert.equal(row.provider, 'vendor');
  assert.match(row.excluded, /alias/);
  assert.equal(row.url, 'https://openrouter.ai/~vendor/model-latest');
});
