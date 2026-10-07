import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const stableJSON = (value) => JSON.stringify(value, null, 2) + '\n';

// All discovery HTTP goes through this recorder. Offline replay makes zero
// requests, including pagination and secondary catalog assets.
export class SourceSnapshot {
  constructor(snapshot, { offline = false, fetcher = fetch, concurrency = 4 } = {}) {
    this.snapshot = snapshot ?? {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      requests: {},
    };
    this.offline = offline;
    this.fetcher = fetcher;
    this.concurrency = concurrency;
    this.active = 0;
    this.waiters = [];
    this.pending = new Map();
    this.blockedHosts = new Set();
  }

  static async open(path, options = {}) {
    const snapshot = JSON.parse(await readFile(path, 'utf8'));
    if (snapshot.schemaVersion !== 1 || !snapshot.requests) throw new Error('Unsupported snapshot');
    for (const [url, row] of Object.entries(snapshot.requests))
      if (row.body !== undefined && sha256(row.body) !== row.sha256)
        throw new Error(`Snapshot checksum mismatch: ${url}`);
    if (options.retryErrors) {
      if (options.offline) throw new Error('Cannot retry sources during offline replay');
      for (const [url, row] of Object.entries(snapshot.requests))
        if (row.error || row.status < 200 || row.status >= 300) delete snapshot.requests[url];
    }
    return new SourceSnapshot(snapshot, options);
  }

  async request(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error(`HTTPS required: ${url}`);
    if (this.pending.has(url)) return this.pending.get(url);
    const pending = this.load(url);
    this.pending.set(url, pending);
    return pending;
  }

  async load(url) {
    const cached = this.snapshot.requests[url];
    if (cached) return this.checked(url, cached);
    if (this.offline) throw new Error(`Missing from offline snapshot: ${url}`);
    if (this.active >= this.concurrency) await new Promise((resolve) => this.waiters.push(resolve));
    this.active++;
    const host = new URL(url).host;
    try {
      if (this.blockedHosts.has(host)) throw new Error(`Stopped after rate limit: ${host}`);
      const response = await this.fetcher(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'VersionBench-source-audit/1.0' },
      });
      const body = await response.text();
      const row = {
        status: response.status,
        finalUrl: response.url || url,
        headers: Object.fromEntries(
          ['content-type', 'link', 'etag', 'last-modified', 'retry-after'].flatMap((key) =>
            response.headers.get(key) ? [[key, response.headers.get(key)]] : [],
          ),
        ),
        sha256: sha256(body),
        body,
      };
      this.snapshot.requests[url] = row;
      if (
        response.status === 429 ||
        (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
      )
        this.blockedHosts.add(host);
      return this.checked(url, row);
    } catch (error) {
      if (!this.snapshot.requests[url]) this.snapshot.requests[url] = { error: error.message };
      throw error;
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }

  checked(url, row) {
    if (row.error) throw new Error(row.error);
    if (row.status < 200 || row.status >= 300) throw new Error(`HTTP ${row.status}: ${url}`);
    return row;
  }

  async text(url) {
    return (await this.request(url)).body;
  }
  async json(url) {
    return JSON.parse(await this.text(url));
  }

  async save(path) {
    const snapshot = {
      ...this.snapshot,
      requests: Object.fromEntries(
        Object.entries(this.snapshot.requests).sort(([a], [b]) => a.localeCompare(b)),
      ),
    };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path + '.tmp', stableJSON(snapshot));
    await rename(path + '.tmp', path);
  }
}

export async function paginatedJSON(client, firstUrl, { origin = new URL(firstUrl).origin } = {}) {
  const rows = [];
  const visited = new Set();
  let url = firstUrl;
  while (url) {
    if (new URL(url).origin !== origin) throw new Error(`Unexpected pagination origin: ${url}`);
    if (visited.has(url)) throw new Error(`Repeated pagination URL: ${url}`);
    visited.add(url);
    const response = await client.request(url);
    const page = JSON.parse(response.body);
    if (!Array.isArray(page)) throw new Error(`Expected paginated array: ${url}`);
    rows.push(...page);
    url = response.headers.link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
  }
  return { rows, pages: [...visited] };
}
