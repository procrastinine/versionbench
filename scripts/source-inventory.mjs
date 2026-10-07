import { observedVersions, compareProviderVersions, pageText } from './provider-audit.mjs';
import { paginatedJSON, sha256 } from './source-snapshot.mjs';
import { artifactExclusion } from './release-policy.mjs';

export const sourceURL = (source) =>
  source.type === 'huggingface' ? `https://huggingface.co/${source.author}/models` : source.url;

const decode = (text) =>
  pageText(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
export function pageInventory(html, url, scopePattern) {
  const scope = new RegExp(scopePattern, 'i');
  const rows = new Map();
  for (const match of html.matchAll(/<a\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/(?:^|\s)href\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href) continue;
    const name = decode(match[2]);
    if (!name || name.length > 240 || !scope.test(name)) continue;
    let target;
    try {
      target = new URL(decode(href), url);
    } catch {
      continue;
    }
    if (target.protocol !== 'https:') continue;
    target.hash = '';
    for (const key of [...target.searchParams.keys()])
      if (key.startsWith('utm_')) target.searchParams.delete(key);
    rows.set(`${target.href}\n${name}`, { name, url: target.href });
  }
  return [...rows.values()].sort(
    (a, b) => a.url.localeCompare(b.url) || a.name.localeCompare(b.name),
  );
}

export async function inventorySource(client, source) {
  const url = sourceURL(source);
  if (source.type === 'huggingface') {
    const endpoint = `https://huggingface.co/api/models?author=${encodeURIComponent(source.author)}&limit=1000`;
    const { rows, pages } = await paginatedJSON(client, endpoint);
    if (!rows.length || rows.some((r) => typeof r.id !== 'string'))
      throw new Error(`Empty or invalid model inventory: ${url}`);
    const scope = new RegExp(source.scopePattern, 'i');
    // Match the repository name, not the publisher (PrimeIntellect also hosts
    // Qwen mirrors; ibm-granite also publishes time-series research).
    const records = rows
      .filter((r) => scope.test(r.id.split('/').slice(1).join('/')))
      .map((r) => ({
        name: r.id,
        url: `https://huggingface.co/${r.id}`,
        task: r.pipeline_tag ?? null,
        ...(artifactExclusion(r.id)
          ? { excluded: artifactExclusion(r.id) }
          : source.excludePattern && new RegExp(source.excludePattern, 'i').test(r.id)
            ? { excluded: 'Non-model repository matched the configured exclusion pattern' }
            : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!records.length && !source.allowEmpty)
      throw new Error(`No repositories match the configured family scope: ${url}`);
    const text = records
      .filter((r) => !r.excluded)
      .map((r) => r.name)
      .join('\n');
    return {
      url,
      type: source.type,
      fetchedCount: rows.length,
      pages,
      records,
      versions: source.pattern ? observedVersions(text, source.pattern, source.versionMap) : [],
      contentHash: sha256(text),
    };
  }
  const html = await client.text(url);
  const text = pageText(html);
  if (text.trim().length < 40) throw new Error(`Empty page or application shell: ${url}`);
  const versions = source.pattern ? observedVersions(text, source.pattern, source.versionMap) : [];
  const records = pageInventory(html, url, source.scopePattern).map((r) => ({
    ...r,
    ...(artifactExclusion(r.name) ? { excluded: artifactExclusion(r.name) } : {}),
  }));
  if (!new RegExp(source.scopePattern, 'i').test(text))
    throw new Error(`No family text found; check dynamic page or parser: ${url}`);
  return {
    url,
    type: source.type,
    versions,
    records,
    contentHash: sha256(text),
    pages: [url],
    fetchedCount: records.length,
  };
}

export async function linkedCheckpoints(client, data) {
  const known = new Set();
  const collections = [
    ...new Set(
      data.releases.flatMap((r) =>
        r.huggingFaceUrl?.includes('/collections/') ? [r.huggingFaceUrl] : [],
      ),
    ),
  ].sort();
  for (const r of data.releases)
    if (r.huggingFaceUrl && !r.huggingFaceUrl.includes('/collections/'))
      known.add(r.huggingFaceUrl.replace(/\/$/, ''));
  const errors = [];
  await Promise.all(
    collections.map(async (url) => {
      try {
        const row = await client.json(
          url.replace('huggingface.co/collections/', 'huggingface.co/api/collections/'),
        );
        if (!Array.isArray(row.items)) throw new Error('Unsupported collection response');
        for (const item of row.items)
          if (item.type === 'model' && item.id) known.add(`https://huggingface.co/${item.id}`);
      } catch (error) {
        errors.push({ url, error: error.message });
      }
    }),
  );
  return { known, errors: errors.sort((a, b) => a.url.localeCompare(b.url)) };
}

export async function auditInventory(client, data, definitions, decisions = []) {
  const checkpoints = await linkedCheckpoints(client, data);
  const knownPages = new Set(data.sources.map((s) => s.url));
  const families = await Promise.all(
    definitions.map(async (definition) => {
      const releases = data.releases.filter((r) => r.family === definition.family);
      const sources = await Promise.all(
        definition.sources.map(async (source) => {
          try {
            const result = await inventorySource(client, source);
            result.records = result.records.map((record) => {
              const decision = decisions.find(
                (d) => d.family === definition.family && d.url === record.url,
              );
              return {
                ...record,
                comparison: record.excluded
                  ? 'excluded-with-reason'
                  : checkpoints.known.has(record.url) || knownPages.has(record.url)
                    ? 'linked-in-catalog'
                    : decision
                      ? `reviewed-${decision.disposition}`
                      : 'review-variant-or-page',
                ...(decision ? { decision } : {}),
              };
            });
            return result;
          } catch (error) {
            return {
              url: sourceURL(source),
              type: source.type,
              error: error.message,
              records: [],
              versions: [],
            };
          }
        }),
      );
      const observations = sources.flatMap((s) => s.versions.map((v) => ({ ...v, url: s.url })));
      const compared = compareProviderVersions(releases, observations);
      const unresolved = sources.flatMap((s) =>
        s.records.filter((r) => r.comparison === 'reviewed-date-unresolved'),
      );
      const missing = sources.flatMap((s) =>
        s.records.filter((r) => r.comparison === 'review-variant-or-page'),
      );
      const first = [...releases].sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      )[0];
      return {
        family: definition.family,
        firstRecordedVersion: first?.version ?? null,
        startsAtOne: first?.score === 1,
        ...compared,
        comparison: sources.some((s) => s.error)
          ? 'review-source'
          : compared.unrecordedVersions.length
            ? compared.comparison
            : unresolved.length
              ? 'review-dates'
              : missing.length
                ? 'review-variants'
                : 'configured-inventory-matches',
        unreviewedRecordCount: missing.length,
        unresolvedDateCount: unresolved.length,
        sources,
      };
    }),
  );
  return { families, collectionErrors: checkpoints.errors };
}
