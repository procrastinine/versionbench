// Inspect public Hub metadata only. Never download weights or execute model code.
export function huggingFaceTarget(url) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://huggingface.co' || parsed.search || parsed.hash)
    throw new Error(`Not a canonical Hugging Face URL: ${url}`);
  const parts = parsed.pathname.slice(1).split('/');
  const collection = parts[0] === 'collections';
  if (parts.length !== (collection ? 3 : 2) || parts.some((part) => !/^[\w.-]+$/.test(part)))
    throw new Error(`Expected a model or collection URL: ${url}`);
  return {
    type: collection ? 'collection' : 'model',
    id: parts.slice(collection ? 1 : 0).join('/'),
  };
}

export function checkpointFiles(siblings = []) {
  return siblings
    .map((file) => file.rfilename)
    .filter(
      (name) =>
        (/\.(?:safetensors|bin|pt|pth|npz|npy|h5|ckpt|msgpack|pdparams|nemo|gguf|tflite|litertlm|task)$/i.test(
          name,
        ) ||
          /(?:^|\/)tensor\d+_\d+$/.test(name)) &&
        !/(?:^|\/)(?:tokenizer|training_args|optimizer|scheduler|rng_state)[^/]*$/i.test(name),
    );
}

export function inspectCheckpoint(model) {
  const files = checkpointFiles(model.siblings);
  if (!files.length) throw new Error('No checkpoint files in repository metadata');
  return {
    id: model.id,
    revision: model.sha,
    gated: model.gated || false,
    checkpointFileCount: files.length,
  };
}

export async function auditWeights(data, fetcher = fetch) {
  const cache = new Map();
  let rateLimitError;
  const get = (path) => {
    if (!cache.has(path))
      cache.set(
        path,
        (async () => {
          if (rateLimitError) throw rateLimitError;
          const response = await fetcher(`https://huggingface.co/api/${path}`, {
            signal: AbortSignal.timeout(30000),
          });
          if (response.status === 429) {
            const seconds = response.headers?.get('ratelimit')?.match(/\bt=(\d+)/)?.[1];
            rateLimitError = Object.assign(
              new Error(
                `Hugging Face API rate limit; remaining requests stopped.${seconds ? ` Retry after ${seconds} seconds.` : ''}`,
              ),
              { code: 'RATE_LIMITED' },
            );
            throw rateLimitError;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
          return response.json();
        })(),
      );
    return cache.get(path);
  };
  const urls = [...new Set(data.releases.map((r) => r.huggingFaceUrl).filter(Boolean))].sort();
  const checks = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, urls.length) }, async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try {
          const target = huggingFaceTarget(url);
          if (target.type === 'model') {
            checks.push({
              url,
              status: 'verified',
              type: 'model',
              ...inspectCheckpoint(await get(`models/${target.id}`)),
            });
          } else {
            const collection = await get(`collections/${target.id}`);
            const models = (collection.items ?? []).filter((item) => item.type === 'model');
            const errors = [];
            let checkpoint;
            for (const model of models) {
              try {
                checkpoint = inspectCheckpoint(await get(`models/${model.id}`));
                break;
              } catch (error) {
                if (error.code === 'RATE_LIMITED') throw error;
                errors.push(`${model.id}: ${error.message}`);
              }
            }
            if (!checkpoint)
              throw new Error(`Collection contains no verified checkpoint: ${errors.join('; ')}`);
            checks.push({
              url,
              status: 'verified',
              type: 'collection',
              title: collection.title,
              modelCount: models.length,
              exampleCheckpoint: checkpoint,
            });
          }
        } catch (error) {
          checks.push({
            url,
            status: error.code === 'RATE_LIMITED' ? 'deferred' : 'review',
            error: error.message,
          });
        }
      }
    }),
  );
  return {
    checkedAt: new Date().toISOString(),
    snapshot: data.updated,
    releaseCount: data.releases.length,
    linkedReleaseCount: data.releases.filter((r) => r.huggingFaceUrl).length,
    uniqueLinkCount: urls.length,
    checks: checks.sort((a, b) => a.url.localeCompare(b.url)),
  };
}
