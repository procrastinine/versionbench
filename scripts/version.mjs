// Decimal arithmetic, by explicit project convention: 2.9.3 -> 2.93.
// Preserve the original version label in the catalog and flatten only the score.
export function numericVersion(version) {
  if (typeof version !== 'string' || !/^\d+(?:\.\d+)*$/.test(version))
    throw new Error(`Missing numeric version: ${version}`);
  const [major, ...rest] = version.split('.');
  return Number(major + (rest.length ? '.' + rest.join('') : ''));
}
