import { fetchPage } from './source-data.mjs';

// Only explicit model-name prefixes are scanned. The configured numeric capture
// excludes parameter counts; repository timestamps are not used as release dates.
export function observedVersions(text, pattern, versionMap = {}) {
  const found = new Map();
  for (const match of text.matchAll(new RegExp(pattern, 'gi'))) {
    const rawVersion = match[1]?.replace('_', '.');
    const version = versionMap[rawVersion?.toUpperCase()] ?? rawVersion;
    const score = Number(version);
    if (!version || !Number.isFinite(score)) throw new Error('Missing numeric version capture');
    if (!found.has(score)) found.set(score, { version, score, evidence: match[0] });
  }
  return [...found.values()].sort((a, b) => b.score - a.score);
}

export function compareProviderVersions(releases, observations) {
  const recorded = new Set(releases.map((r) => r.score));
  const highestRecorded = Math.max(...recorded);
  const higher = observations.filter((r) => r.score > highestRecorded);
  return {
    highestRecorded,
    higherVersions: higher,
    unrecordedVersions: observations.filter((r) => !recorded.has(r.score)),
    comparison: higher.length ? 'review-higher-version' : 'no-higher-version-observed',
  };
}

export function pageText(html) {
  // URL slugs such as /grok-47 and /motif-12 lose the decimal separator.
  // Read rendered text, never URL attributes or arbitrary serialized page data.
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ');
}

async function modelList(author) {
  let url = `https://huggingface.co/api/models?author=${encodeURIComponent(author)}&limit=1000`;
  const names = [];
  const visited = new Set();
  while (url) {
    if (visited.has(url)) throw new Error('Repeated model-list pagination URL');
    visited.add(url);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.some((r) => typeof r.id !== 'string'))
      throw new Error('Unsupported model-list response');
    names.push(...rows.map((r) => r.id));
    const next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    if (next && new URL(next).origin !== 'https://huggingface.co')
      throw new Error('Unexpected model-list pagination origin');
    url = next;
  }
  if (!names.length) throw new Error(`Empty official model list: ${author}`);
  return names.join('\n');
}

export async function auditProviders(data, definitions) {
  const cache = new Map();
  const load = (source) => {
    const key = source.type === 'huggingface' ? `hf:${source.author}` : source.url;
    if (!cache.has(key))
      cache.set(
        key,
        source.type === 'huggingface'
          ? modelList(source.author)
          : fetchPage(source.url).then(pageText),
      );
    return cache.get(key);
  };
  return Promise.all(
    data.families.map(async (family) => {
      const definition = definitions.find((row) => row.family === family.id);
      if (!definition)
        return {
          family: family.id,
          comparison: 'review-source',
          error: 'No official sources configured',
        };
      const sources = await Promise.all(
        definition.sources.map(async (source) => {
          const url =
            source.type === 'huggingface'
              ? `https://huggingface.co/${source.author}/models`
              : source.url;
          try {
            const raw = await load(source);
            const text = source.excludePattern
              ? raw
                  .split('\n')
                  .filter((line) => !new RegExp(source.excludePattern, 'i').test(line))
                  .join('\n')
              : raw;
            const versions = observedVersions(text, source.pattern, source.versionMap);
            return {
              url,
              versions,
              ...(versions.length
                ? {}
                : { error: 'No model versions extracted; review source and parser' }),
            };
          } catch (error) {
            return { url, versions: [], error: error.message };
          }
        }),
      );
      const observations = sources.flatMap((source) =>
        source.versions.map((v) => ({ ...v, url: source.url })),
      );
      const compared = compareProviderVersions(
        data.releases.filter((r) => r.family === family.id),
        observations,
      );
      return {
        family: family.id,
        ...compared,
        comparison: compared.higherVersions.length
          ? 'review-higher-version'
          : sources.some((s) => s.error)
            ? 'review-source'
            : compared.comparison,
        sources,
      };
    }),
  );
}
