import { numericVersion } from './version.mjs';

// Only explicit model-name prefixes are scanned. The configured numeric capture
// excludes parameter counts; repository timestamps are not used as release dates.
export function observedVersions(text, pattern, versionMap = {}) {
  const found = new Map();
  for (const match of text.matchAll(new RegExp(pattern, 'gi'))) {
    const rawVersion = match[1]?.replaceAll('_', '.');
    const version = versionMap[rawVersion?.toUpperCase()] ?? rawVersion;
    const score = numericVersion(version);
    if (!version || !Number.isFinite(score)) throw new Error('Missing numeric version capture');
    // Numeric equality must not erase published labels (Python 3.1 and 3.10).
    if (!found.has(version)) found.set(version, { version, score, evidence: match[0] });
  }
  return [...found.values()].sort((a, b) => b.score - a.score);
}

export function compareProviderVersions(releases, observations) {
  const recorded = new Set(releases.map((r) => String(r.version ?? r.score).replace(/\.0$/, '')));
  const highestRecorded = Math.max(...releases.map((r) => r.score));
  const higher = observations.filter((r) => r.score > highestRecorded);
  const missing = observations.filter(
    (r) => !recorded.has(String(r.version ?? r.score).replace(/\.0$/, '')),
  );
  return {
    highestRecorded,
    higherVersions: higher,
    unrecordedVersions: missing,
    comparison: higher.length
      ? 'review-higher-version'
      : missing.length
        ? 'review-missing-version'
        : 'recorded-versions-match',
  };
}

export function pageText(html) {
  // URL slugs such as /grok-47 and /motif-12 lose the decimal separator.
  // Read rendered text, never URL attributes or arbitrary serialized page data.
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g, ' ')
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ');
}
