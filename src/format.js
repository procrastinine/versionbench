// Escaping, validated links and dates, shared labels, and chart tick formatting.
export function createFormatting(app) {
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );

  const safeURL = (value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  const color = (value) => (/^#[\da-f]{3,8}$/i.test(value || '') ? value : '#65748b');

  const parseDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
      ? time
      : NaN;
  };

  const day = 86400000;

  const isoDate = (time) => new Date(time).toISOString().slice(0, 10);

  const dateLabel = (value) =>
    Number.isFinite(parseDate(value))
      ? new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(parseDate(value))
      : 'Date not established';

  const numberLabel = (value) => (Number.isFinite(value) ? String(Number(value.toFixed(3))) : '—');

  // Limited leaderboards must include the complete boundary tie group.
  const takeWithTies = (rows, limit) => {
    if (!rows.length || limit < 1) return [];
    const cutoff = rows[Math.min(rows.length, limit) - 1].score;
    return rows.filter((release) => release.score >= cutoff);
  };

  const minimumTimelineSpan = 2 * day;

  const optionValue = (options, value, fallback = 'all') =>
    options.some(([key]) => key === value) ? value : fallback;

  const filterControl = (id, label, options, value) =>
    `<label class="filter-control" for="${id}"><span>${label}</span><select id="${id}">${options.map(([key, title]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;

  const matchesFilters = (release, prefs) =>
    (prefs.weights === 'all' || release.weightsStatus === prefs.weights) &&
    (prefs.status === 'all' || release.status === prefs.status) &&
    (!prefs.kind || prefs.kind === 'all' || release.familyInfo.kind === prefs.kind);

  const statusLabel = (value) =>
    ({
      verified: 'Verified',
      announced: 'Announced',
      released: 'Released',
      preview: 'Preview',
      'user-supplied': 'User supplied',
      'user-reported': 'User reported',
      'source-verified': 'Verified',
      'date-verified': 'Date verified',
      unverified: 'Unverified',
    })[value] ||
    String(value || 'Documented')
      .replace(/[-_]/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());

  const external = (url, label, attributes = '') =>
    url
      ? /* HTML */ `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" ${attributes}
          >${label}</a
        >`
      : /* HTML */ `<span class="muted">Source pending</span>`;

  const sourceLink = (release, label = 'Release ↗', attributes = '') =>
    external(release.source?.url, label, attributes);

  const analysisLink = (release, label = 'Artificial Analysis ↗') =>
    release.artificialAnalysisUrl
      ? external(
          release.artificialAnalysisUrl,
          label,
          `data-analysis-link title="Artificial Analysis" aria-label="Artificial Analysis for ${esc(release.name)}"`,
        )
      : '';

  const weightsLabel = (release) =>
    ({
      open: 'Open weights',
      'not-published': 'No public weights found',
      unverified: 'Weights unverified',
      'not-applicable': 'Software control · Weights not applicable',
    })[release.weightsStatus] || 'Weights unverified';

  const weightsLink = (release, label = 'Hugging Face weights ↗') =>
    release.huggingFaceUrl
      ? external(
          release.huggingFaceUrl,
          label,
          `data-weights-link title="${esc(release.weightsNote || 'Downloadable model weights on Hugging Face')}" aria-label="Hugging Face weights for ${esc(release.name)}"`,
        )
      : '';

  const familyStyle = (family) => `--family:${family.color}`;

  const mark = (family) =>
    /* HTML */ `<span class="family-mark" style="${familyStyle(family)}" aria-hidden="true"
      >${esc(family.name.slice(0, 1))}</span
    >`;

  const score = (release) => numberLabel(release.score);

  function dateTicks(start, end, width) {
    const span = end - start;
    const target = Math.max(3, Math.floor(width / 110));
    const dates = [];
    if (span > 160 * day) {
      const months = span / (30.44 * day);
      const step = [1, 2, 3, 6, 12, 24, 36, 60].find((value) => months / value <= target) || 120;
      const cursor = new Date(start);
      cursor.setUTCDate(1);
      cursor.setUTCHours(0, 0, 0, 0);
      let monthNumber = cursor.getUTCFullYear() * 12 + cursor.getUTCMonth();
      monthNumber = Math.ceil(monthNumber / step) * step;
      while (dates.length < 40) {
        const time = Date.UTC(Math.floor(monthNumber / 12), monthNumber % 12, 1);
        if (time > end) break;
        if (time >= start) dates.push(time);
        monthNumber += step;
      }
      return dates.map((time) => ({
        time,
        label: new Intl.DateTimeFormat('en-US', {
          ...(step >= 12 ? { year: 'numeric' } : { month: 'short', year: '2-digit' }),
          timeZone: 'UTC',
        }).format(time),
      }));
    }
    const stepDays = [1, 2, 3, 7, 14, 30, 60].find((value) => span / day / value <= target) || 90;
    for (
      let time = Math.ceil(start / day / stepDays) * stepDays * day;
      time <= end;
      time += stepDays * day
    )
      dates.push(time);
    return dates.map((time) => ({
      time,
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(time),
    }));
  }

  return {
    esc,
    safeURL,
    color,
    parseDate,
    day,
    isoDate,
    dateLabel,
    numberLabel,
    takeWithTies,
    minimumTimelineSpan,
    optionValue,
    filterControl,
    matchesFilters,
    statusLabel,
    external,
    sourceLink,
    analysisLink,
    weightsLabel,
    weightsLink,
    familyStyle,
    mark,
    score,
    dateTicks,
  };
}
