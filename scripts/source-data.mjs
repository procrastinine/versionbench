// Decode JSON already sent to a public page. Never execute downloaded JavaScript.
export function pageStream(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)/g)];
  if (!chunks.length) throw new Error('Page has no supported embedded data');
  return chunks.map((match) => JSON.parse(match[1])[1]).join('');
}

export function pageArray(html, key) {
  return pageValue(html, key, '[');
}

export function pageValue(html, key, opening = '{') {
  const stream = pageStream(html);
  const marker = `"${key}":${opening}`;
  const offset = stream.indexOf(marker);
  if (offset < 0) throw new Error(`Page is missing ${key}; source format may have changed`);
  const start = offset + marker.length - 1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < stream.length; i++) {
    const char = stream[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[' || char === '{') depth++;
    else if (char === ']' || char === '}') {
      depth--;
      if (depth === 0) return JSON.parse(stream.slice(start, i + 1));
    }
  }
  throw new Error(`Truncated ${key} data`);
}

export async function fetchPage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

export const normalizedName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// This catalog publishes JavaScript object literals. Extract only quoted metadata;
// do not evaluate the script, including any unrelated code it may contain.
export function timelineModels(script) {
  const quoted = '"(?:[^"\\\\]|\\\\.)*"';
  const pattern = new RegExp(
    `\\{\\s*name\\s*:\\s*(${quoted}),\\s*date\\s*:\\s*(${quoted}),\\s*org\\s*:\\s*(${quoted})`,
    'g',
  );
  const rows = [...script.matchAll(pattern)].map((match) => ({
    name: JSON.parse(match[1]),
    date: JSON.parse(match[2]),
    provider: JSON.parse(match[3]),
  }));
  if (!rows.length || rows.length !== [...script.matchAll(/\{\s*name\s*:/g)].length)
    throw new Error('Unsupported LLM Timeline catalog format');
  return rows;
}

export const releaseTrackers = [
  {
    id: 'artificial-analysis',
    url: 'https://artificialanalysis.ai/models',
    load: async (html) => {
      const models = pageArray(html, 'models');
      return pageArray(html, 'releases').map((release) => ({
        ...release,
        modelSlugs: models
          .filter((model) => model.releaseSlug === release.slug)
          .map((model) => model.slug),
      }));
    },
    row: (r) => ({
      name: r.name,
      date: r.releaseDate,
      provider: r.creator.name,
      url: r.modelSlugs.length
        ? `https://artificialanalysis.ai/models/${r.modelSlugs[0]}`
        : 'https://artificialanalysis.ai/models',
      modelURLs: r.modelSlugs.map((slug) => `https://artificialanalysis.ai/models/${slug}`),
    }),
  },
  {
    id: 'llm-timeline',
    url: 'https://llm-timeline.com/',
    load: async (html, url) => {
      const path = html.match(
        /<script\b[^>]*\bsrc=["']([^"']*\bmodels\.js(?:\?[^"']*)?)["']/i,
      )?.[1];
      if (!path) throw new Error('LLM Timeline catalog script not found');
      const asset = new URL(path, url);
      if (asset.origin !== new URL(url).origin) throw new Error('Unexpected catalog origin');
      return timelineModels(await fetchPage(asset.href));
    },
    row: (r) => ({ ...r, url: 'https://llm-timeline.com/' }),
  },
  {
    id: 'llm-releases',
    url: 'https://www.llm-releases.com/',
    array: 'models',
    row: (r) => ({
      name: r.name,
      date: r.releasedDate,
      status: r.status,
      url: `https://www.llm-releases.com/models/${r.slug}`,
      primaryURL: r.homepageUrl?.startsWith('https://') ? r.homepageUrl : null,
    }),
  },
  {
    id: 'llm-stats',
    url: 'https://llm-stats.com/llm-updates',
    array: 'allVersions',
    row: (r) => ({
      name: r.name,
      date: r.release_date,
      url: `https://llm-stats.com/models/${r.model_id}`,
    }),
  },
  {
    id: 'opper',
    url: 'https://opper.ai/model-releases',
    array: 'items',
    row: (r) => ({
      name: r.name,
      date: r.date,
      type: r.type,
      url: `https://opper.ai/models/${r.slug}`,
    }),
  },
];

export const gatewayTracker = (year) => ({
  id: `llm-gateway-${year}`,
  url: `https://llmgateway.io/timeline/${year}`,
  array: 'models',
  row: (r) => ({
    name: r.name,
    date: r.releasedAt?.slice(0, 10),
    addedDate: r.addedAt?.slice(0, 10),
    url: `https://llmgateway.io/models/${r.id}`,
  }),
});
