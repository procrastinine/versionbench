(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('release-data').textContent);
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
  const families = data.families.map((family) => ({ ...family, color: color(family.color) }));
  const familyMap = new Map(families.map((family) => [family.id, family]));
  const sourceMap = new Map(
    (data.sources || []).map((source) => [source.id, { ...source, url: safeURL(source.url) }]),
  );
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
  const releases = data.releases
    .filter((release) => familyMap.has(release.family))
    .map((release) => ({
      ...release,
      familyInfo: familyMap.get(release.family),
      source: sourceMap.get(release.sourceId),
      dateSource: sourceMap.get(release.dateSourceId),
      artificialAnalysisUrl: safeURL(release.artificialAnalysisUrl),
      huggingFaceUrl: safeURL(release.huggingFaceUrl),
      weightsSourceUrl: safeURL(release.weightsSourceUrl),
      time: parseDate(release.date),
      score:
        typeof release.score === 'number' && Number.isFinite(release.score) ? release.score : null,
    }));
  const releaseMap = new Map(releases.map((release) => [release.id, release]));
  const numericReleases = releases.filter((release) => release.score !== null);
  const datedReleases = numericReleases.filter((release) => Number.isFinite(release.time));
  const latestDate =
    data.updated || isoDate(Math.max(...datedReleases.map((release) => release.time)));
  const latestTime = Math.max(
    parseDate(latestDate),
    ...datedReleases.map((release) => release.time),
  );
  const earliestTime = Math.min(...datedReleases.map((release) => release.time));
  const ranked = families
    .map(
      (family) =>
        numericReleases
          .filter((release) => release.family === family.id)
          .sort(
            (a, b) =>
              b.score - a.score ||
              (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31') ||
              a.name.localeCompare(b.name),
          )[0],
    )
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.familyInfo.name.localeCompare(b.familyInfo.name));
  const rankMap = new Map(
    ranked.map((release, index) => [
      release.family,
      ranked.findIndex((other) => other.score === release.score) + 1,
    ]),
  );
  const highestMap = new Map(ranked.map((release) => [release.family, release]));
  const coreIds = families.filter((family) => family.core).map((family) => family.id);
  const main = document.getElementById('main');
  const tooltip = document.getElementById('tooltip');
  const dialog = document.getElementById('model-dialog');
  let compareIds = ranked.slice(0, 3).map((release) => release.id);
  let compareOrder = 'score';
  let draftIds = new Set();
  let previousPage = '';
  let currentRoute = null;
  let timelinePrefs = {
    familyIds: [...coreIds],
    from: isoDate(earliestTime),
    to: isoDate(latestTime),
    range: 'all',
  };
  let indexPrefs = { query: '', family: 'all', sort: 'date', direction: 'desc' };
  let leaderboardScope = 'all';
  let pinnedPoint = null;
  let suppressPointFocus = false;
  let toastTimer;
  let resizeTimer;
  let timelineGesture = null;
  let timelineDrag = null;
  let timelineGestureTimer;
  let timelineDrawFrame;
  const minimumTimelineSpan = Math.min(2 * day, latestTime - earliestTime);

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
  const selectedReleases = () => compareIds.map((id) => releaseMap.get(id)).filter(Boolean);
  const routeHref = (page, params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) search.set(key, value);
    });
    return `#${page}${search.size ? `?${search}` : ''}`;
  };
  const compareHref = (ids = compareIds, order = compareOrder) =>
    routeHref('compare', { models: ids.join(','), order });
  const timelineHref = (prefs) =>
    routeHref('timeline', {
      families: prefs.familyIds.join(','),
      from: prefs.from,
      to: prefs.to,
      range: prefs.range,
    });
  const uniqueValidIds = (ids) => [...new Set(ids)].filter((id) => releaseMap.has(id));
  const navigate = (hash) => {
    if (location.hash === hash) renderRoute();
    else location.hash = hash;
  };
  const head = (eyebrow, title, description, actions = '') =>
    /* HTML */ `<div class="page-head">
      <div>
        <span class="eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${
        actions ||
        /* HTML */ `<div class="snapshot">
          CURATED SNAPSHOT<strong>${esc(dateLabel(latestDate))}</strong>
        </div>`
      }
    </div>`;
  const note = () =>
    /* HTML */ `<p class="note">
      <strong>About this metric.</strong> Scores are the numeric versions assigned to model
      releases. They do not measure intelligence, quality, speed, or capability.
      <a href="#methodology">Read the methodology ↗</a>
    </p>`;
  const toast = (message) => {
    document.querySelector('.toast')?.remove();
    clearTimeout(toastTimer);
    const element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    element.textContent = message;
    document.body.append(element);
    toastTimer = setTimeout(() => element.remove(), 3200);
  };
  const updateSelectionUI = () => {
    document.getElementById('nav-count').textContent = compareIds.length;
    document.querySelector('[data-nav="compare"]').href = compareHref();
    document.querySelectorAll('[data-compare-link]').forEach((link) => {
      link.href = compareHref();
      link.textContent = `Compare selected (${compareIds.length}) →`;
    });
    document.querySelectorAll('[data-select-release]').forEach((input) => {
      input.checked = compareIds.includes(input.dataset.selectRelease);
    });
  };
  const selectionCheckbox = (release) =>
    /* HTML */ `<input
      type="checkbox"
      data-select-release="${esc(release.id)}"
      aria-label="Select ${esc(release.name)} for comparison"
      ${compareIds.includes(release.id) ? 'checked' : ''}
    />`;

  function renderLeaderboard() {
    const list = ranked.filter((release) => leaderboardScope === 'all' || release.familyInfo.core);
    const chartList = list.slice(0, 10);
    const ceiling = Math.max(1, Math.ceil(list[0]?.score || 1));
    main.innerHTML =
      head(
        'VERSIONBENCH / LEADERBOARD',
        'Version Benchmark Leaderboard',
        '100% accurate and unbiased cross-model LLM benchmark<span class="benchmark-definition">Benchmark score = numeric release version.</span>',
      ) +
      /* HTML */ `<div class="stats">
          ${ranked
            .slice(0, 3)
            .map(
              (release) =>
                /* HTML */ `<article class="stat" style="${familyStyle(release.familyInfo)}">
                  <div class="stat-top">
                    <span>Benchmark score</span
                    ><span class="rank-tag">#${rankMap.get(release.family)}</span>
                  </div>
                  <div class="stat-main">
                    <div>
                      <div class="stat-name">${esc(release.familyInfo.name)}</div>
                      <div class="stat-provider">${esc(release.familyInfo.provider)}</div>
                    </div>
                    <div class="stat-score">${score(release)}</div>
                  </div>
                  <div class="stat-bottom">
                    <span>${esc(release.name)}</span><span aria-hidden="true">·</span>${sourceLink(
                      release,
                    )}
                    ${analysisLink(release, 'AA ↗')} ${weightsLink(release, 'HF ↗')}
                  </div>
                </article>`,
            )
            .join('')}
        </div>
        <div class="dashboard-grid">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Overall rankings</h2>
                <p>Highest benchmark score per family</p>
              </div>
              <div class="segments" aria-label="Leaderboard scope">
                <button
                  data-leaderboard-scope="all"
                  class="${leaderboardScope === 'all' ? 'active' : ''}"
                  aria-pressed="${leaderboardScope === 'all'}"
                >
                  All families</button
                ><button
                  data-leaderboard-scope="core"
                  class="${leaderboardScope === 'core' ? 'active' : ''}"
                  aria-pressed="${leaderboardScope === 'core'}"
                >
                  Core 10
                </button>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <caption class="sr-only">
                  Language model families ranked by their highest numeric version
                </caption>
                <thead>
                  <tr>
                    <th><span class="sr-only">Compare</span></th>
                    <th>Rank</th>
                    <th>Model family</th>
                    <th>Score</th>
                    <th class="date-col">Date</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  ${list
                    .map((release) => {
                      const tied =
                        ranked.filter((other) => other.score === release.score).length > 1;
                      return /* HTML */ `<tr>
                        <td class="select-cell">${selectionCheckbox(release)}</td>
                        <td class="rank-cell" title="${tied ? 'Shared rank' : 'Rank'}">
                          ${tied ? '=' : ''}${rankMap.get(release.family)}
                        </td>
                        <td>
                          <div class="family-cell">
                            ${mark(release.familyInfo)}
                            <div>
                              <div class="family-name">${esc(release.familyInfo.name)}</div>
                              <div class="table-sub">
                                ${esc(release.name)}
                                <span class="availability-label"
                                  >${esc(statusLabel(release.status))}</span
                                >
                              </div>
                              <div
                                class="table-sub"
                                data-weights-status="${esc(release.weightsStatus)}"
                              >
                                ${weightsLabel(release)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td class="score-cell">${score(release)}</td>
                        <td class="date-cell date-col">${esc(release.date || 'Undated')}</td>
                        <td class="source-link">
                          ${sourceLink(
                            release,
                            '↗',
                            `aria-label="Open release source for ${esc(release.name)}"`,
                          )}
                          ${analysisLink(release, 'AA ↗')} ${weightsLink(release, 'HF ↗')}
                        </td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
            <div class="panel-foot">
              <span>${list.length} families · Equal versions share a rank</span
              ><a href="${compareHref()}" data-compare-link
                >Compare selected (${compareIds.length}) →</a
              >
            </div>
          </section>
          <div>
            <section class="panel chart-card">
              <div class="panel-head">
                <div>
                  <h2>Version Benchmark by family</h2>
                  <p>Top ${chartList.length} families · Higher score ranks first</p>
                </div>
                <span class="mini-label">SCORE</span>
              </div>
              <div class="bars">
                ${chartList
                  .map(
                    (release) =>
                      /* HTML */ `<div class="bar-row" style="${familyStyle(release.familyInfo)}">
                        <a
                          class="bar-name"
                          href="${compareHref([release.id])}"
                          title="Compare ${esc(release.name)}"
                          >${esc(release.familyInfo.name)}</a
                        >
                        <div class="bar-track">
                          <div
                            class="bar-fill"
                            style="width:${(release.score / ceiling) * 100}%"
                          ></div>
                        </div>
                        <span class="bar-score">${score(release)}</span>
                      </div>`,
                  )
                  .join('')}
                <div class="axis-line" style="grid-template-columns:repeat(${ceiling + 1},1fr)">
                  ${Array.from(
                    { length: ceiling + 1 },
                    (_, index) => /* HTML */ `<span>${index}</span>`,
                  ).join('')}
                </div>
              </div>
              <div class="panel-foot">
                <span>Zero baseline · Raw version numbers</span
                ><a href="${compareHref()}">Build comparison →</a>
              </div>
            </section>
            <section class="panel subsection">
              <a class="link-card" href="${timelineHref(timelinePrefs)}"
                ><svg viewBox="0 0 64 36" aria-hidden="true">
                  <path d="M2 32H62M2 2V32" fill="none" stroke="#dce3ef" />
                  <path
                    d="M3 29H13V24H27V16H42V10H60V4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle cx="42" cy="10" r="3" fill="currentColor" />
                </svg>
                <div>
                  <h3>Explore the release timeline</h3>
                  <p>Trace model versions across time, with direct release sources.</p>
                </div>
                <span aria-hidden="true" style="margin-left:auto">→</span></a
              >
            </section>
            ${note()}
            <div class="metric-counts">
              <span><strong>${families.length}</strong> model families</span
              ><span><strong>${releases.length}</strong> curated releases</span
              ><span><strong>${sourceMap.size}</strong> sources</span>
            </div>
          </div>
        </div>`;
  }

  function timelineState(params) {
    const familyIds = params.has('families')
      ? [...new Set(params.get('families').split(','))].filter((id) => familyMap.has(id))
      : timelinePrefs.familyIds;
    const from = Number.isFinite(parseDate(params.get('from')))
      ? params.get('from')
      : timelinePrefs.from;
    const to = Number.isFinite(parseDate(params.get('to'))) ? params.get('to') : timelinePrefs.to;
    const bounds = normalizeTimelineWindow(
      parseDate(from) <= parseDate(to) ? parseDate(from) : earliestTime,
      parseDate(from) <= parseDate(to) ? parseDate(to) : latestTime,
      true,
    );
    timelinePrefs = {
      familyIds,
      from: isoDate(bounds.start),
      to: isoDate(bounds.end),
      range: params.get('range') || timelinePrefs.range,
    };
  }

  function renderTimeline(params) {
    timelineState(params);
    // Canonical dates make Back restore the view even when entered through #timeline.
    history.replaceState(null, '', timelineHref(timelinePrefs));
    const familyControls = (core) =>
      families
        .filter((family) => Boolean(family.core) === core)
        .map(
          (family) =>
            /* HTML */ `<div class="family-control" data-highlight-family="${esc(family.id)}">
              <label for="family-${esc(family.id)}"
                ><input
                  class="family-check"
                  type="checkbox"
                  id="family-${esc(family.id)}"
                  data-family="${esc(family.id)}"
                  ${timelinePrefs.familyIds.includes(family.id) ? 'checked' : ''}
                /><span class="swatch" style="${familyStyle(family)}"></span>${esc(
                  family.name,
                )}</label
              ><span class="family-version"
                >${highestMap.has(family.id) ? score(highestMap.get(family.id)) : '—'}</span
              ><button
                class="only-button"
                data-only-family="${esc(family.id)}"
                aria-label="Show only ${esc(family.name)}"
              >
                only
              </button>
            </div>`,
        )
        .join('');
    main.innerHTML =
      head(
        'VERSIONBENCH / RELEASE HISTORY',
        'Version Benchmark Timeline',
        'Track benchmark scores by release date across model families.',
      ) +
      /* HTML */ `<div class="timeline-layout">
        <aside class="panel families-panel" aria-label="Model family filters">
          <div class="sidebar-title">
            Model families<span class="mini-label"
              >${timelinePrefs.familyIds.length}/${families.length}</span
            >
          </div>
          <div class="sidebar-controls">
            <button class="text-button" data-family-set="core">Core 10</button
            ><button class="text-button" data-family-set="all">All</button
            ><button class="text-button" data-family-set="none">None</button>
          </div>
          <div class="family-section-label">CORE FAMILIES</div>
          ${familyControls(true)}
          <div class="family-section-label">ADDITIONAL FAMILIES</div>
          ${familyControls(false)}
        </aside>
        <div>
          <section class="panel">
            <div class="chart-toolbar">
              <div class="segments" aria-label="Date range presets">
                ${[
                  ['all', 'All time'],
                  ['3y', '3 years'],
                  ['1y', '1 year'],
                  ['ytd', 'YTD'],
                ]
                  .map(
                    ([value, label]) =>
                      /* HTML */ `<button
                        data-range="${value}"
                        class="${timelinePrefs.range === value ? 'active' : ''}"
                        aria-pressed="${timelinePrefs.range === value}"
                      >
                        ${label}
                      </button>`,
                  )
                  .join('')}
              </div>
              <div class="date-range">
                <label for="date-from">From</label
                ><input
                  id="date-from"
                  type="date"
                  min="${isoDate(earliestTime)}"
                  max="${isoDate(latestTime)}"
                  value="${esc(timelinePrefs.from)}"
                /><label for="date-to">To</label
                ><input
                  id="date-to"
                  type="date"
                  min="${isoDate(earliestTime)}"
                  max="${isoDate(latestTime)}"
                  value="${esc(timelinePrefs.to)}"
                />
              </div>
            </div>
            <div class="timeline-navigation">
              <p id="timeline-gesture-hint">
                Scroll or pinch to zoom · Drag or swipe sideways to pan · Reset keeps selected
                families<span class="sr-only"
                  >. Shift plus scroll also pans. Keyboard: plus and minus zoom, left and right
                  arrows pan, Home resets.</span
                >
              </p>
              <div class="timeline-zoom-controls" aria-label="Timeline view controls">
                <button
                  class="button small zoom-button"
                  data-timeline-zoom="in"
                  aria-label="Zoom in"
                  title="Zoom in (+)"
                >
                  +</button
                ><button
                  class="button small zoom-button"
                  data-timeline-zoom="out"
                  aria-label="Zoom out"
                  title="Zoom out (−)"
                >
                  −</button
                ><button
                  class="button small"
                  data-timeline-reset
                  title="Restore the full date range; keep selected families"
                >
                  Reset view
                </button>
              </div>
            </div>
            <p id="date-error" class="error-text" role="alert" hidden></p>
            <div id="timeline-viewport-status" class="sr-only" aria-live="polite"></div>
            <div
              id="timeline-chart"
              class="timeline-wrap"
              tabindex="0"
              role="region"
              aria-label="Interactive release timeline"
              aria-describedby="timeline-gesture-hint"
            ></div>
            <div class="timeline-bottom">
              <span
                ><strong>Line:</strong> highest benchmark score to date.
                <strong>Points:</strong> individual releases.</span
              ><span
                >Click a point for its release source. Outlined points contain multiple
                releases.</span
              >
            </div>
          </section>
          <p class="note">
            Models with the same version remain at the same height. Every release retains its exact
            date and numeric position. <a href="#methodology">Methodology ↗</a>
          </p>
          <details class="panel timeline-details subsection">
            <summary id="timeline-table-summary">Explore plotted releases in a table</summary>
            <div id="timeline-table" class="table-wrap"></div>
          </details>
        </div>
      </div>`;
    drawTimeline();
    syncTimelineControls();
    bindTimelineGestures(document.getElementById('timeline-chart'));
  }

  // Keep continuous gesture deltas internally, while the displayed/shared view uses UTC days.
  function normalizeTimelineWindow(start, end, snap = false) {
    const fullSpan = latestTime - earliestTime;
    let span = Math.max(minimumTimelineSpan, Math.min(fullSpan, end - start));
    if (snap) {
      span = Math.max(minimumTimelineSpan, Math.min(fullSpan, Math.round(span / day) * day));
      start = Math.round(start / day) * day;
    }
    start = Math.max(earliestTime, Math.min(latestTime - span, start));
    return { start, end: start + span };
  }

  function syncTimelineControls(announce = false) {
    const start = parseDate(timelinePrefs.from);
    const end = parseDate(timelinePrefs.to);
    const span = end - start;
    const fromInput = document.getElementById('date-from');
    const toInput = document.getElementById('date-to');
    if (fromInput) fromInput.value = timelinePrefs.from;
    if (toInput) toInput.value = timelinePrefs.to;
    document.querySelectorAll('[data-range]').forEach((button) => {
      const active = button.dataset.range === timelinePrefs.range;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    const zoomIn = document.querySelector('[data-timeline-zoom="in"]');
    const zoomOut = document.querySelector('[data-timeline-zoom="out"]');
    if (zoomIn) zoomIn.disabled = span <= minimumTimelineSpan;
    if (zoomOut) zoomOut.disabled = span >= latestTime - earliestTime;
    const error = document.getElementById('date-error');
    if (error) error.hidden = true;
    if (announce) {
      const status = document.getElementById('timeline-viewport-status');
      if (status)
        status.textContent = `${dateLabel(timelinePrefs.from)} to ${dateLabel(timelinePrefs.to)}. ${Math.round(span / day)} days in view.`;
    }
  }

  function beginTimelineGesture(kind) {
    if (timelineGesture && timelineGesture.kind !== kind) commitTimelineGesture();
    if (!timelineGesture) {
      timelineGesture = {
        kind,
        start: parseDate(timelinePrefs.from),
        end: parseDate(timelinePrefs.to),
        dirty: false,
      };
      closeTooltip(false);
    }
    return timelineGesture;
  }

  function requestTimelineDraw() {
    if (!timelineDrawFrame)
      timelineDrawFrame = requestAnimationFrame(() => {
        timelineDrawFrame = null;
        if (currentRoute?.page === 'timeline') drawTimeline(false);
      });
  }

  function applyTimelineWindow(start, end) {
    const continuous = normalizeTimelineWindow(start, end);
    if (timelineGesture) Object.assign(timelineGesture, continuous);
    const view = normalizeTimelineWindow(continuous.start, continuous.end, true);
    const from = isoDate(view.start);
    const to = isoDate(view.end);
    if (from === timelinePrefs.from && to === timelinePrefs.to) return;
    if (timelineGesture) timelineGesture.dirty = true;
    timelinePrefs = { ...timelinePrefs, from, to, range: 'custom' };
    syncTimelineControls();
    requestTimelineDraw();
  }

  function commitTimelineGesture(redraw = true) {
    clearTimeout(timelineGestureTimer);
    const gesture = timelineGesture;
    timelineGesture = null;
    if (timelineDrawFrame) {
      cancelAnimationFrame(timelineDrawFrame);
      timelineDrawFrame = null;
    }
    if (!gesture || currentRoute?.page !== 'timeline') return;
    if (gesture.dirty) {
      const hash = timelineHref(timelinePrefs);
      if (location.hash !== hash) history.pushState(null, '', hash);
      currentRoute.params = new URLSearchParams(hash.split('?')[1] || '');
      if (redraw) drawTimeline();
      syncTimelineControls(true);
    }
  }

  function cancelTimelineGesture() {
    clearTimeout(timelineGestureTimer);
    if (timelineDrawFrame) cancelAnimationFrame(timelineDrawFrame);
    timelineDrawFrame = null;
    timelineGesture = null;
    timelineDrag = null;
    document.getElementById('timeline-chart')?.classList.remove('is-panning');
  }

  function deferTimelineCommit() {
    clearTimeout(timelineGestureTimer);
    timelineGestureTimer = setTimeout(commitTimelineGesture, 240);
  }

  function zoomTimeline(factor, anchor = 0.5, kind = 'control', defer = false) {
    const gesture = beginTimelineGesture(kind);
    const span = gesture.end - gesture.start;
    const nextSpan = Math.max(
      minimumTimelineSpan,
      Math.min(latestTime - earliestTime, span * factor),
    );
    const fixedTime = gesture.start + span * anchor;
    applyTimelineWindow(fixedTime - nextSpan * anchor, fixedTime + nextSpan * (1 - anchor));
    if (defer) deferTimelineCommit();
    else commitTimelineGesture();
  }

  function resetTimelineView() {
    commitTimelineGesture();
    beginTimelineGesture('control');
    applyTimelineWindow(earliestTime, latestTime);
    timelinePrefs.range = 'all';
    // Reset also makes a custom full-width view report the All time preset.
    if (timelineGesture) timelineGesture.dirty = location.hash !== timelineHref(timelinePrefs);
    commitTimelineGesture();
    syncTimelineControls(true);
    document.getElementById('timeline-chart')?.scrollTo({ left: 0 });
  }

  function timelinePlotMetrics(container, clientX) {
    const svg = container.querySelector('svg');
    if (!svg) return { anchor: 0.5, width: container.clientWidth };
    const rect = svg.getBoundingClientRect();
    const units = svg.viewBox.baseVal.width;
    const scale = rect.width / units;
    const left = rect.left + 56 * scale;
    const width = (units - 56 - 32) * scale;
    return { width, anchor: Math.max(0, Math.min(1, (clientX - left) / width)) };
  }

  function bindTimelineGestures(container) {
    let ignoreClickUntil = 0;
    let nativePinch = null;
    const finishDrag = (event) => {
      if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
      const pointerId = timelineDrag.pointerId;
      if (timelineDrag.moved) ignoreClickUntil = performance.now() + 350;
      timelineDrag = null;
      container.classList.remove('is-panning');
      if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
      commitTimelineGesture();
    };
    container.addEventListener('pointerdown', (event) => {
      // Direct interactions with sources retain their normal click/middle-click behavior.
      if (event.target.closest('[data-point-ids]')) {
        commitTimelineGesture(false);
        return;
      }
      if (event.button !== 0 || !event.isPrimary || !event.target.closest('svg')) return;
      commitTimelineGesture();
      const gesture = beginTimelineGesture('drag');
      timelineDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        start: gesture.start,
        end: gesture.end,
        width: timelinePlotMetrics(container, event.clientX).width,
        moved: false,
      };
      container.setPointerCapture(event.pointerId);
      container.focus({ preventScroll: true });
      container.classList.add('is-panning');
      event.preventDefault();
    });
    container.addEventListener('pointermove', (event) => {
      if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
      const delta = event.clientX - timelineDrag.x;
      if (!timelineDrag.moved && Math.abs(delta) < 4) return;
      timelineDrag.moved = true;
      const offset = (-delta / timelineDrag.width) * (timelineDrag.end - timelineDrag.start);
      applyTimelineWindow(timelineDrag.start + offset, timelineDrag.end + offset);
      event.preventDefault();
    });
    container.addEventListener('pointerup', finishDrag);
    container.addEventListener('pointercancel', finishDrag);
    container.addEventListener('lostpointercapture', finishDrag);
    container.addEventListener(
      'click',
      (event) => {
        if (performance.now() < ignoreClickUntil) {
          ignoreClickUntil = 0;
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true,
    );
    container.addEventListener('dragstart', (event) => {
      if (!event.target.closest('[data-point-ids]')) event.preventDefault();
    });
    container.addEventListener(
      'wheel',
      (event) => {
        // Only the chart consumes wheel/pinch; browser/page zoom elsewhere is untouched.
        if (!event.target.closest('svg')) return;
        event.preventDefault();
        if (timelineDrag || nativePinch) return;
        const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
        const dx = event.deltaX * multiplier;
        const dy = event.deltaY * multiplier;
        const metrics = timelinePlotMetrics(container, event.clientX);
        if (!event.ctrlKey && (event.shiftKey || Math.abs(dx) > Math.abs(dy))) {
          const delta = event.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? dx : dy) : dx;
          const gesture = beginTimelineGesture('wheel');
          const offset =
            (Math.max(-250, Math.min(250, delta)) / metrics.width) * (gesture.end - gesture.start);
          applyTimelineWindow(gesture.start + offset, gesture.end + offset);
          deferTimelineCommit();
        } else {
          const delta = Math.max(-160, Math.min(160, dy));
          const sensitivity = event.ctrlKey ? 0.008 : 0.002;
          zoomTimeline(Math.exp(delta * sensitivity), metrics.anchor, 'wheel', true);
        }
      },
      { passive: false },
    );
    container.addEventListener('keydown', (event) => {
      if (event.target !== container) return;
      if (['+', '=', '-', '_', 'ArrowLeft', 'ArrowRight', 'Home'].includes(event.key))
        event.preventDefault();
      if (['+', '='].includes(event.key)) zoomTimeline(0.7);
      if (['-', '_'].includes(event.key)) zoomTimeline(1 / 0.7);
      if (event.key === 'Home') resetTimelineView();
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const gesture = beginTimelineGesture('control');
        const offset = (gesture.end - gesture.start) * (event.key === 'ArrowLeft' ? -0.2 : 0.2);
        applyTimelineWindow(gesture.start + offset, gesture.end + offset);
        commitTimelineGesture();
      }
    });
    // Safari emits native GestureEvents for a trackpad pinch rather than ctrl+wheel.
    container.addEventListener(
      'gesturestart',
      (event) => {
        event.preventDefault();
        commitTimelineGesture();
        beginTimelineGesture('pinch');
        const rect = container.getBoundingClientRect();
        nativePinch = {
          scale: event.scale || 1,
          anchor: timelinePlotMetrics(container, event.clientX || rect.left + rect.width / 2)
            .anchor,
        };
      },
      { passive: false },
    );
    container.addEventListener(
      'gesturechange',
      (event) => {
        if (!nativePinch) return;
        event.preventDefault();
        const scale = Math.max(0.05, event.scale || 1);
        zoomTimeline(nativePinch.scale / scale, nativePinch.anchor, 'pinch', true);
        clearTimeout(timelineGestureTimer);
        nativePinch.scale = scale;
      },
      { passive: false },
    );
    container.addEventListener(
      'gestureend',
      (event) => {
        if (!nativePinch) return;
        event.preventDefault();
        nativePinch = null;
        commitTimelineGesture();
      },
      { passive: false },
    );
  }

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

  function drawTimeline(updateTable = true) {
    const container = document.getElementById('timeline-chart');
    if (!container) return;
    closeTooltip(false);
    const chartStyle = getComputedStyle(container);
    const width = Math.max(
      260,
      Math.floor(
        container.clientWidth -
          parseFloat(chartStyle.paddingLeft) -
          parseFloat(chartStyle.paddingRight),
      ),
    );
    const height = 490;
    const pad = { top: 40, right: 32, bottom: 63, left: 56 };
    const start = parseDate(timelinePrefs.from);
    const end = parseDate(timelinePrefs.to);
    const actualEnd = end === start ? end + day : end;
    const familySet = new Set(timelinePrefs.familyIds);
    const selected = datedReleases.filter((release) => familySet.has(release.family));
    const visible = selected.filter((release) => release.time >= start && release.time <= end);
    const max = Math.max(
      1,
      Math.ceil(
        Math.max(
          0,
          ...selected.filter((release) => release.time <= end).map((release) => release.score),
        ),
      ),
    );
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const x = (time) => pad.left + ((time - start) / (actualEnd - start)) * chartWidth;
    const y = (version) => pad.top + chartHeight - (version / max) * chartHeight;
    const ticks = dateTicks(start, actualEnd, chartWidth);
    const steps = timelinePrefs.familyIds
      .map((familyId) => {
        const list = selected
          .filter((release) => release.family === familyId && release.time <= end)
          .sort((a, b) => a.time - b.time || a.score - b.score);
        let high = null;
        let path = '';
        list.forEach((release) => {
          if (release.time < start) {
            high = Math.max(high ?? -Infinity, release.score);
            return;
          }
          if (!path && high !== null) path = `M${x(start).toFixed(2)},${y(high).toFixed(2)}`;
          if (high === null) {
            high = release.score;
            path = `M${x(release.time).toFixed(2)},${y(high).toFixed(2)}`;
          } else if (release.score > high) {
            path += `H${x(release.time).toFixed(2)}V${y(release.score).toFixed(2)}`;
            high = release.score;
          }
        });
        if (!path && high !== null) path = `M${x(start).toFixed(2)},${y(high).toFixed(2)}`;
        if (path) path += `H${x(actualEnd).toFixed(2)}`;
        return /* HTML */ `<g class="series-group" data-series="${esc(familyId)}"
          ><path class="step-line" d="${path}" stroke="${familyMap.get(familyId).color}"
        /></g>`;
      })
      .join('');
    const groups = new Map();
    visible.forEach((release) => {
      const key = `${release.date}:${release.score}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(release);
    });
    const points = [...groups.values()]
      .map((group) => {
        const release = group[0];
        const cx = x(release.time).toFixed(2);
        const cy = y(release.score).toFixed(2);
        const attrs = `data-point-ids="${esc(group.map((item) => item.id).join(','))}" data-point-families="${esc([...new Set(group.map((item) => item.family))].join(','))}"`;
        if (group.length === 1)
          return /* HTML */ `<a
            class="point-link"
            ${attrs}
            href="${esc(release.source?.url || '#releases')}"
            ${release.source?.url ? 'target="_blank" rel="noopener noreferrer"' : ''}
            aria-label="${esc(
              `${release.name}; version ${score(release)}; ${dateLabel(release.date)}. Open release source.`,
            )}"
            ><circle class="point-hit" cx="${cx}" cy="${cy}" r="9" fill="transparent" /><circle
              class="release-point"
              cx="${cx}"
              cy="${cy}"
              r="4"
              fill="${release.familyInfo.color}"
            /><title>${esc(`${release.name} · ${release.date} · ${score(release)}`)}</title></a
          >`;
        return /* HTML */ `<g
          class="point-link point-group"
          ${attrs}
          role="button"
          tabindex="0"
          aria-haspopup="dialog"
          aria-label="${esc(
            `${group.length} releases on ${dateLabel(release.date)} at benchmark score ${score(release)}. Open list of sources.`,
          )}"
          ><circle class="point-hit" cx="${cx}" cy="${cy}" r="10" fill="transparent" /><circle
            class="release-point overlap-point"
            cx="${cx}"
            cy="${cy}"
            r="5.5"
            fill="white"
            style="stroke:${release.familyInfo.color};stroke-width:2.5"
          /><circle
            cx="${cx}"
            cy="${cy}"
            r="1.6"
            fill="${
              group.length > 1 ? group[group.length - 1].familyInfo.color : release.familyInfo.color
            }"
            pointer-events="none"
          /><title>${esc(group.map((item) => item.name).join(' / '))}</title></g
        >`;
      })
      .join('');
    container.innerHTML = /* HTML */ `<svg
      class="timeline-svg"
      style="width:${width}px;min-width:100%;height:${height}px"
      viewBox="0 0 ${width} ${height}"
      role="group"
      aria-labelledby="timeline-title timeline-description"
    >
      <title id="timeline-title">Version Benchmark release timeline</title>
      <desc id="timeline-description">
        Release date on x axis, benchmark score (numeric version) on y axis. Lines show highest
        version to date. Each release point links to its source; coincident points open a list.
        ${visible.length} releases in the selected date range. Use Tab to explore points.
      </desc>
      <text class="axis-title" x="${pad.left}" y="18">Benchmark score</text>
      ${Array.from(
        { length: max + 1 },
        (_, index) =>
          /* HTML */ `<line
              class="grid-line"
              x1="${pad.left}"
              x2="${width - pad.right}"
              y1="${y(index)}"
              y2="${y(index)}"
            /><text x="${pad.left - 15}" y="${y(index) + 4}" text-anchor="end">${index}</text>`,
      ).join('')}${ticks
        .map(
          (tick) =>
            /* HTML */ `<line
                x1="${x(tick.time)}"
                x2="${x(tick.time)}"
                y1="${height - pad.bottom}"
                y2="${height - pad.bottom + 5}"
                stroke="#ccd4e0"
              /><text x="${x(tick.time)}" y="${height - pad.bottom + 25}" text-anchor="middle"
                >${esc(tick.label)}</text
              >`,
        )
        .join('')}
      <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(0)}" y2="${y(0)}" stroke="#c6cfdd" />
      ${steps}${points}
      <text
        class="axis-title"
        x="${pad.left + chartWidth / 2}"
        y="${height - 8}"
        text-anchor="middle"
      >
        Release date (UTC)
      </text>
      ${
        !visible.length
          ? /* HTML */ `<text
              x="${pad.left + chartWidth / 2}"
              y="${height / 2}"
              text-anchor="middle"
              style="font-family:inherit;font-size:14px"
              >${
                familySet.size
                  ? 'No releases in this date range'
                  : 'Select a model family to explore releases'
              }</text
            >`
          : ''
      }
    </svg>`;
    document.getElementById('timeline-table-summary').textContent =
      `Explore ${visible.length} plotted releases in a table`;
    if (updateTable)
      document.getElementById('timeline-table').innerHTML = releaseTable(
        visible.sort((a, b) => b.time - a.time || b.score - a.score),
        false,
      );
    container.querySelectorAll('[data-point-ids]').forEach((point) => {
      point.addEventListener('pointerenter', (event) => {
        if (!pinnedPoint) showPointTooltip(point, event, false);
      });
      point.addEventListener('pointermove', (event) => {
        if (!pinnedPoint) positionTooltip(event.clientX, event.clientY);
      });
      point.addEventListener('pointerleave', () => {
        if (!pinnedPoint) {
          closeTooltip(false);
          highlightFamilies([]);
        }
      });
      point.addEventListener('focus', () => {
        if (!pinnedPoint && !suppressPointFocus) showPointTooltip(point, null, false);
      });
      point.addEventListener('blur', () => {
        if (!pinnedPoint) {
          closeTooltip(false);
          highlightFamilies([]);
        }
      });
      if (point.classList.contains('point-group')) {
        point.addEventListener('click', (event) => {
          event.stopPropagation();
          showPointTooltip(point, event, true);
        });
        point.addEventListener('keydown', (event) => {
          if (['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            showPointTooltip(point, null, true);
          }
        });
      }
    });
  }

  function highlightFamilies(ids) {
    document.querySelectorAll('[data-series]').forEach((group) => {
      group.classList.toggle('dim', ids.length > 0 && !ids.includes(group.dataset.series));
      group.classList.toggle('highlight', ids.includes(group.dataset.series));
    });
  }

  function positionTooltip(x, y) {
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(x + 15, window.innerWidth - rect.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(y + 15, window.innerHeight - rect.height - 12))}px`;
  }

  function showPointTooltip(point, event, pinned) {
    if (timelineGesture) return;
    const group = point.dataset.pointIds.split(',').map((id) => releaseMap.get(id));
    const release = group[0];
    if (!release) return;
    tooltip.innerHTML = `${pinned ? '<button class="tip-close" aria-label="Close release list">×</button>' : ''}<strong>${group.length > 1 ? `${group.length} releases at version ${score(release)}` : esc(release.name)}</strong><div class="tip-meta"><span>${esc(release.date)}</span><span>Benchmark score ${score(release)}</span></div>${
      group.length > 1
        ? /* HTML */ `<div class="point-source-list">
              ${group
                .map(
                  (item) =>
                    /* HTML */ `<div>
                      <span class="swatch" style="${familyStyle(item.familyInfo)}"></span>${
                        pinned
                          ? sourceLink(item, `${esc(item.name)} ↗`)
                          : /* HTML */ `<span>${esc(item.name)}</span>`
                      }
                      ${pinned ? weightsLink(item, 'HF ↗') : ''}
                    </div>`,
                )
                .join('')}
            </div>
            <p>
              ${
                pinned
                  ? 'Release links open announcements; HF links open model weights.'
                  : 'Click or press Enter to choose a release source.'
              }
            </p>`
        : /* HTML */ `<p>
              ${esc(release.familyInfo.provider)} · ${esc(statusLabel(release.status))}
            </p>
            <p>${esc(release.source?.title || 'Release source pending')}</p>
            ${release.note ? /* HTML */ `<p>${esc(release.note)}</p>` : ''}
            <p>Click to open the release source ↗</p>`
    }`;
    tooltip.hidden = false;
    tooltip.classList.toggle('pinned', pinned);
    tooltip.setAttribute('role', pinned ? 'dialog' : 'tooltip');
    tooltip.setAttribute(
      'aria-label',
      `${group.length > 1 ? 'Release sources' : 'Release details'} for ${release.date}`,
    );
    if (pinned) pinnedPoint = point;
    highlightFamilies(point.dataset.pointFamilies.split(','));
    const rect = point.getBoundingClientRect();
    positionTooltip(event?.clientX || rect.left + rect.width / 2, event?.clientY || rect.bottom);
    if (pinned) {
      tooltip.querySelector('.tip-close').addEventListener('click', () => closeTooltip(true));
      tooltip.querySelector('a,button')?.focus();
    }
  }

  function closeTooltip(restoreFocus = false) {
    const trigger = pinnedPoint;
    pinnedPoint = null;
    tooltip.hidden = true;
    tooltip.classList.remove('pinned');
    highlightFamilies([]);
    if (restoreFocus && trigger?.isConnected) {
      suppressPointFocus = true;
      trigger.focus({ preventScroll: true });
      suppressPointFocus = false;
    }
  }

  function sourceDetails(release) {
    const items = [];
    if (release.source)
      items.push(
        /* HTML */ `<div class="source-title">
            ${sourceLink(release, `${esc(release.source.title)} ↗`)}
          </div>
          <div class="table-sub">
            ${esc(release.source.publisher || release.familyInfo.provider)}${
              release.source.date ? ` · ${esc(release.source.date)}` : ''
            }
          </div>`,
      );
    else items.push('<span class="table-sub">Source pending</span>');
    if (release.artificialAnalysisUrl)
      items.push(`<div class="analysis-link">${analysisLink(release)}</div>`);
    items.push(
      `<div class="weights-link" data-weights-status="${esc(release.weightsStatus)}" title="Weights checked ${esc(release.weightsCheckedAt)}">${weightsLink(release) || esc(weightsLabel(release))}</div>`,
    );
    if (release.note || release.mapping || release.dateSource || release.weightsNote)
      items.push(
        /* HTML */ `<details class="release-details">
          <summary>Source notes</summary>
          ${release.weightsNote ? /* HTML */ `<p><strong>Weights:</strong> ${esc(release.weightsNote)} ${release.weightsSourceUrl ? external(release.weightsSourceUrl, 'Evidence ↗') : ''}</p>` : ''}
          ${release.note ? /* HTML */ `<p>${esc(release.note)}</p>` : ''}${
            release.mapping
              ? /* HTML */ `<p><strong>Version mapping:</strong> ${esc(release.mapping)}</p>`
              : ''
          }${
            release.dateSource
              ? /* HTML */ `<p>
                  <strong>Date evidence:</strong> ${external(
                    release.dateSource.url,
                    `${esc(release.dateSource.title)} ↗`,
                  )}
                </p>`
              : ''
          }
        </details>`,
      );
    return items.join('');
  }

  function releaseTable(list, selectable = true, sortable = false) {
    const heading = (key, title) =>
      sortable
        ? /* HTML */ `<button
            class="sort-button"
            data-index-sort="${key}"
            aria-pressed="${indexPrefs.sort === key}"
          >
            ${title}${
              indexPrefs.sort === key ? (indexPrefs.direction === 'desc' ? ' ↓' : ' ↑') : ''
            }
          </button>`
        : title;
    return /* HTML */ `<table class="release-table">
      <caption class="sr-only">
        Model releases and their sources
      </caption>
      <thead>
        <tr>
          ${selectable ? '<th><span class="sr-only">Compare</span></th>' : ''}
          <th>${heading('name', 'Model release')}</th>
          <th>Family</th>
          <th>${heading('score', 'Benchmark score')}</th>
          <th>${heading('date', 'Release date')}</th>
          <th>Source &amp; evidence</th>
        </tr>
      </thead>
      <tbody>
        ${
          list.length
            ? list
                .map(
                  (release) =>
                    /* HTML */ `<tr>
                      ${
                        selectable
                          ? /* HTML */ `<td class="select-cell">${selectionCheckbox(release)}</td>`
                          : ''
                      }
                      <td class="release-name">
                        ${sourceLink(release, esc(release.name))}
                        <div class="table-sub">${esc(statusLabel(release.status))}</div>
                      </td>
                      <td>
                        <span class="family-inline"
                          ><span class="swatch" style="${familyStyle(release.familyInfo)}"></span
                          >${esc(release.familyInfo.name)}</span
                        >
                      </td>
                      <td class="score-cell">${score(release)}</td>
                      <td class="date-cell">${esc(release.date || 'Undated')}</td>
                      <td class="source-cell">${sourceDetails(release)}</td>
                    </tr>`,
                )
                .join('')
            : /* HTML */ `<tr>
                <td colspan="${selectable ? 6 : 5}" class="empty">
                  No releases match these filters.
                </td>
              </tr>`
        }
      </tbody>
    </table>`;
  }

  function renderCompare(params) {
    if (params.has('models')) compareIds = uniqueValidIds(params.get('models').split(','));
    compareOrder = params.get('order') === 'selection' ? 'selection' : 'score';
    const selected = selectedReleases();
    const list =
      compareOrder === 'score'
        ? [...selected].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
        : selected;
    const numeric = list.filter((release) => release.score !== null);
    const title =
      list.length === 2
        ? `${esc(list[0].name)} vs ${esc(list[1].name)}`
        : 'Version Benchmark Comparison';
    const max = Math.max(0, ...numeric.map((release) => release.score));
    const min = Math.min(...numeric.map((release) => release.score));
    main.innerHTML =
      head(
        'VERSIONBENCH / COMPARE',
        title,
        'Compare benchmark scores for any selection of model releases.',
        /* HTML */ `<div class="head-actions">
          <button class="button" data-copy-link>Copy link</button
          ><button class="button primary" data-open-picker>＋ Select models</button>
        </div>`,
      ) +
      /* HTML */ `<section class="panel">
          <div class="compare-controls">
            <div class="selected-chips">
              ${
                selected.length
                  ? selected
                      .map(
                        (release) =>
                          /* HTML */ `<span class="model-chip"
                            ><span class="swatch" style="${familyStyle(release.familyInfo)}"></span
                            >${esc(release.name)}<button
                              data-remove-release="${esc(release.id)}"
                              aria-label="Remove ${esc(release.name)}"
                            >
                              ×
                            </button></span
                          >`,
                      )
                      .join('')
                  : '<span class="chart-hint">No models selected</span>'
              }
            </div>
            <div class="head-actions">
              <button
                class="text-button"
                data-clear-comparison
                ${!selected.length ? 'disabled' : ''}
              >
                Clear all
              </button>
            </div>
          </div>
          ${
            list.length
              ? /* HTML */ `<div class="comparison-heading">
                    <div>
                      <h2>Benchmark score</h2>
                      <p>Raw version numbers · Zero baseline</p>
                    </div>
                    <label class="compare-sort"
                      ><span class="sr-only">Bar order</span
                      ><select id="compare-order">
                        <option value="score" ${compareOrder === 'score' ? 'selected' : ''}>
                          Highest score first
                        </option>
                        <option value="selection" ${compareOrder === 'selection' ? 'selected' : ''}>
                          Selection order
                        </option>
                      </select></label
                    >
                  </div>
                  <div id="comparison-chart" class="compare-chart-scroll"></div>
                  <div class="panel-foot">
                    <span
                      >${selected.length} releases from
                      ${new Set(selected.map((release) => release.family)).size} families</span
                    ><button class="text-button" data-export-comparison>Export CSV ↓</button>
                  </div>`
              : /* HTML */ `<div class="empty">
                  <h2>Choose models to compare</h2>
                  <p>Select any releases across families, including earlier versions.</p>
                  <button class="button primary" data-open-picker>Select models</button>
                </div>`
          }
        </section>
        <div class="presets" aria-label="Comparison presets">
          <span class="preset-label">Quick selections</span
          ><a class="preset" href="${compareHref(ranked.slice(0, 3).map((release) => release.id))}"
            >Top 3 families</a
          ><a
            class="preset"
            href="${compareHref(
              ranked.filter((release) => release.familyInfo.core).map((release) => release.id),
            )}"
            >Core 10 families</a
          ><a class="preset" href="${compareHref(ranked.map((release) => release.id))}"
            >All ${ranked.length} families</a
          >
        </div>` +
      (numeric.length
        ? /* HTML */ `<div class="compare-summary">
            <div class="summary-block">
              <span>Highest benchmark score</span><strong>${numberLabel(max)}</strong>
              <p>
                ${esc(
                  numeric
                    .filter((release) => release.score === max)
                    .map((release) => release.name)
                    .join(' · '),
                )}
              </p>
            </div>
            <div class="summary-block">
              <span>Score spread</span><strong>${numberLabel(max - min)}</strong>
              <p>Highest minus lowest numeric version</p>
            </div>
            <div class="summary-block">
              <span>Selected releases</span><strong>${selected.length}</strong>
              <p>
                ${new Set(selected.map((release) => release.family)).size} model families
                represented
              </p>
            </div>
          </div>`
        : '') +
      (list.length
        ? /* HTML */ `<section class="panel subsection">
            <div class="panel-head">
              <div>
                <h2>Comparison details</h2>
                <p>Release dates, versions, and original sources</p>
              </div>
            </div>
            <div class="table-wrap">${releaseTable(list, false)}</div>
          </section>`
        : '') +
      note();
    if (list.length) drawComparison(list);
  }

  function wrapLabel(name, limit = 21) {
    const lines = [];
    let line = '';
    name.split(/\s+/).forEach((word) => {
      if (line && `${line} ${word}`.length > limit) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawComparison(list) {
    const container = document.getElementById('comparison-chart');
    if (!container) return;
    const max = Math.max(1, Math.ceil(Math.max(0, ...list.map((release) => release.score ?? 0))));
    const maxLines = Math.max(...list.map((release) => wrapLabel(release.name).length));
    const width = Math.max(container.clientWidth - 40, list.length * 160 + 90, 420);
    const height = 380 + maxLines * 17;
    const pad = { top: 52, left: 55, right: 26, bottom: 63 + maxLines * 17 };
    const chartHeight = height - pad.top - pad.bottom;
    const baseline = height - pad.bottom;
    const slot = (width - pad.left - pad.right) / list.length;
    const barWidth = Math.min(95, slot * 0.55);
    const y = (version) => baseline - (version / max) * chartHeight;
    container.innerHTML = /* HTML */ `<svg
      class="compare-svg"
      style="width:${width}px;height:${height}px;max-width:none"
      viewBox="0 0 ${width} ${height}"
      role="group"
      aria-label="Bar chart comparing ${list.length} raw model version numbers, with a zero baseline"
    >
      <title>Version Benchmark comparison</title>
      ${Array.from(
        { length: max + 1 },
        (_, index) =>
          /* HTML */ `<line
              class="grid-line"
              x1="${pad.left}"
              x2="${width - pad.right}"
              y1="${y(index)}"
              y2="${y(index)}"
            /><text class="score-axis" x="${pad.left - 16}" y="${y(index) + 4}" text-anchor="end"
              >${index}</text
            >`,
      ).join('')}${list
        .map((release, index) => {
          const x = pad.left + slot * (index + 0.5);
          const top = y(release.score || 0);
          const labelLines = wrapLabel(release.name);
          return /* HTML */ `<g
            ><a
              href="${esc(release.source?.url || '#releases')}"
              ${release.source?.url ? 'target="_blank" rel="noopener noreferrer"' : ''}
              aria-label="${esc(
                `${release.name}; version ${score(release)}; ${dateLabel(release.date)}. Open release source.`,
              )}"
              ><title>${esc(`${release.name}: ${score(release)}`)}</title
              ><rect
                x="${x - barWidth / 2}"
                y="${top}"
                width="${barWidth}"
                height="${baseline - top}"
                fill="${release.familyInfo.color}"
                rx="3"
              /><text class="value" x="${x}" y="${top - 14}" text-anchor="middle"
                >${score(release)}</text
              ></a
            ><text class="model-label" x="${x}" y="${baseline + 27}" text-anchor="middle"
              >${labelLines
                .map(
                  (line, lineIndex) =>
                    /* HTML */ `<tspan x="${x}" dy="${lineIndex ? 17 : 0}">${esc(line)}</tspan>`,
                )
                .join('')}</text
            ><text
              class="bar-date"
              x="${x}"
              y="${baseline + 49 + (maxLines - 1) * 17}"
              text-anchor="middle"
              >${esc(release.date || 'Undated')}</text
            ></g
          >`;
        })
        .join('')}
      <line
        x1="${pad.left}"
        x2="${width - pad.right}"
        y1="${baseline}"
        y2="${baseline}"
        stroke="#b9c4d6"
      />
    </svg>`;
  }

  function filteredReleases() {
    const query = indexPrefs.query.trim().toLocaleLowerCase();
    const list = releases.filter(
      (release) =>
        (indexPrefs.family === 'all' || release.family === indexPrefs.family) &&
        (!query ||
          [
            release.name,
            release.familyInfo.name,
            release.familyInfo.provider,
            release.version,
            release.source?.title,
            release.note,
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase()
            .includes(query)),
    );
    const direction = indexPrefs.direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const comparison =
        indexPrefs.sort === 'score'
          ? (a.score ?? -Infinity) - (b.score ?? -Infinity)
          : String(a[indexPrefs.sort] || '').localeCompare(String(b[indexPrefs.sort] || ''));
      return comparison * direction || a.name.localeCompare(b.name);
    });
  }

  function indexHref() {
    return routeHref('releases', {
      q: indexPrefs.query || undefined,
      family: indexPrefs.family === 'all' ? undefined : indexPrefs.family,
      sort: indexPrefs.sort,
      direction: indexPrefs.direction,
    });
  }

  function renderReleases(params) {
    indexPrefs = {
      query: params.get('q') || '',
      family: familyMap.has(params.get('family')) ? params.get('family') : 'all',
      sort: ['date', 'score', 'name'].includes(params.get('sort')) ? params.get('sort') : 'date',
      direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
    };
    main.innerHTML =
      head(
        'VERSIONBENCH / DATA EXPLORER',
        'Release Index',
        'The source-linked release dataset behind every chart and ranking.',
        '<div class="head-actions"><button class="button" data-export-releases>Export CSV ↓</button></div>',
      ) +
      /* HTML */ `<section class="panel">
          <div class="table-toolbar">
            <div class="inline-controls">
              <label class="sr-only" for="release-search"
                >Search releases, providers, or source notes</label
              ><input
                class="search-input"
                id="release-search"
                type="search"
                placeholder="Search models, families, or sources…"
                value="${esc(indexPrefs.query)}"
              /><label class="sr-only" for="release-family">Filter by model family</label
              ><select id="release-family">
                <option value="all">All families</option>
                ${families
                  .map(
                    (family) =>
                      /* HTML */ `<option
                        value="${esc(family.id)}"
                        ${indexPrefs.family === family.id ? 'selected' : ''}
                      >
                        ${esc(family.name)}
                      </option>`,
                  )
                  .join('')}
              </select>
            </div>
            <span id="release-count" class="index-count" aria-live="polite"></span>
          </div>
          <div id="release-table" class="table-wrap"></div>
          <div class="panel-foot">
            <span>Dates represent documented public releases or announcements.</span
            ><a href="${compareHref()}" data-compare-link
              >Compare selected (${compareIds.length}) →</a
            >
          </div>
        </section>
        ${note()}`;
    updateReleaseTable();
  }

  function updateReleaseTable() {
    const list = filteredReleases();
    document.getElementById('release-table').innerHTML = releaseTable(list, true, true);
    document.getElementById('release-count').textContent =
      `${list.length} of ${releases.length} releases`;
  }

  function renderMethodology() {
    main.innerHTML =
      head(
        'VERSIONBENCH / METHODOLOGY',
        'Benchmark Methodology',
        'A transparent definition of the metric, date conventions, and dataset scope.',
      ) +
      /* HTML */ `<article class="methodology">
        <h2>The benchmark score is the version number</h2>
        <p>
          VersionBench records the numeric version of a language model release. GPT-6.1 receives
          <code>6.1</code>; Claude 5.5 receives <code>5.5</code>. These are decimal numbers, not
          semantic-version tuples. Model size, context length, inference cost, and benchmark
          performance do not enter the calculation.
        </p>
        <p>
          Version numbers are assigned independently by each provider. A higher position in this
          benchmark does not imply a more capable model.
        </p>
        <h2>One leaderboard entry per family</h2>
        <p>
          Each family is represented by its highest numeric version in this curated dataset. When
          releases within a family share that version, the first recorded release is shown; releases
          with the same version and date are resolved alphabetically. Families with equal scores
          share a competition rank. For example, two families tied at rank 5 are both ranked 5, and
          the next rank is 7.
        </p>
        <p>
          OpenAI’s o-series has an independent numeric sequence and is tracked separately from GPT.
          Both families retain OpenAI as their provider. For example, o3 scores <code>3</code> on
          the OpenAI o line.
        </p>
        <h2>Release timeline</h2>
        <p>
          The horizontal axis is the documented release or public announcement date, in UTC.
          Availability labels distinguish research announcements, previews, and released models; an
          announcement date does not imply general availability. The vertical axis is the exact
          numeric version. The step line follows the highest version released by that family up to
          each date. Individual points retain their own versions, so a later release with a lower
          number can appear below the line.
        </p>
        <p>
          Variants retain separate release records even when they have the same numeric version.
          Points sharing the exact date and version occupy the same coordinate. An outlined point
          opens a list of all release sources at that position. Date filters change the visible
          interval; a line can continue into that interval from a release that predates it.
        </p>
        <h2>Comparison pages</h2>
        <p>
          Select any set of releases to generate a comparison. Bar height is the raw numeric version
          on a zero-baseline axis. The version spread is the largest selected version minus the
          smallest; it is not a performance improvement. Selections and bar order are encoded in the
          URL fragment, so the same HTML file can reopen a comparison without a server.
        </p>
        <h2>Sources and date evidence</h2>
        <p>
          The release index links each record to its original provider announcement, documentation,
          repository, or model card. When a separate source establishes the date, it appears under
          that record’s source notes. Notes also record naming or numeric-version mappings where
          needed. Clicking a timeline point or comparison bar opens the corresponding release
          source.
        </p>
        <h2>Curated coverage</h2>
        <p>
          Hugging Face links lead to available model weights or release collections. Weight
          availability is checked separately from the original event date and can include later
          publications, gated access, or restricted licenses. Community conversions and checkpoint
          differences are identified in source notes. “No public weights found” records the result
          of the check; “Weights unverified” means an exact match remains unresolved.
        </p>
        <p>
          This snapshot contains <strong>${releases.length} release records</strong> across
          <strong>${families.length} families</strong>, with
          <strong>${sourceMap.size} source records</strong>, as of ${esc(dateLabel(latestDate))}. It
          is a curated version history, not an exhaustive list of model sizes, checkpoints, API
          aliases, or every deployment update. Muse is tracked as a separate family from Llama.
        </p>
        <p>
          The ten core families are
          ${esc(
            families
              .filter((family) => family.core)
              .map((family) => family.name)
              .join(', '),
          )}.
          Additional families are
          ${esc(
            families
              .filter((family) => !family.core)
              .map((family) => family.name)
              .join(', '),
          )}.
        </p>
        <h2>Portable by design</h2>
        <p>
          All release data, styles, and interaction code are embedded in this static HTML file. The
          dashboard runs locally without a backend or external libraries. Source links open external
          sites only when selected. The release index and comparison views can export their
          displayed records as CSV.
        </p>
        <p><a href="#releases">Explore the release index →</a></p>
      </article>`;
  }

  function renderRoute() {
    cancelTimelineGesture();
    const hash = location.hash.slice(1) || 'leaderboard';
    if (hash === 'main') {
      main.focus();
      return;
    }
    const [rawPage, rawParams = ''] = hash.split('?');
    const page = ['leaderboard', 'timeline', 'compare', 'releases', 'methodology'].includes(rawPage)
      ? rawPage
      : 'leaderboard';
    const params = new URLSearchParams(rawParams);
    const focusId = document.activeElement?.id;
    const samePage = page === previousPage;
    closeTooltip(false);
    currentRoute = { page, params };
    if (page === 'leaderboard') renderLeaderboard();
    if (page === 'timeline') renderTimeline(params);
    if (page === 'compare') renderCompare(params);
    if (page === 'releases') renderReleases(params);
    if (page === 'methodology') renderMethodology();
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const title = main.querySelector('h1')?.textContent || 'Version Benchmark';
    document.title = `${title} — VersionBench`;
    updateSelectionUI();
    if (samePage && focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    else if (previousPage && !samePage) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
    previousPage = page;
  }

  function openPicker() {
    draftIds = new Set(compareIds);
    document.getElementById('model-search').value = '';
    document.getElementById('latest-only').checked = false;
    renderPicker();
    dialog.showModal();
    document.getElementById('model-search').focus();
  }

  function renderPicker() {
    const query = document.getElementById('model-search').value.trim().toLocaleLowerCase();
    const highestOnly = document.getElementById('latest-only').checked;
    const choices = (highestOnly ? ranked : releases).filter(
      (release) =>
        !query ||
        `${release.name} ${release.familyInfo.name} ${release.familyInfo.provider}`
          .toLocaleLowerCase()
          .includes(query),
    );
    document.getElementById('picker-list').innerHTML =
      families
        .map((family) => {
          const group = choices
            .filter((release) => release.family === family.id)
            .sort(
              (a, b) =>
                (b.date || '').localeCompare(a.date || '') || (b.score ?? 0) - (a.score ?? 0),
            );
          return group.length
            ? /* HTML */ `<div class="picker-family">
                  <span class="swatch" style="${familyStyle(family)}"></span>${esc(
                    family.name,
                  )}<span class="table-sub">${esc(family.provider)}</span>
                </div>
                ${group
                  .map(
                    (release) =>
                      /* HTML */ `<label class="picker-model"
                        ><input
                          type="checkbox"
                          data-picker-id="${esc(release.id)}"
                          ${draftIds.has(release.id) ? 'checked' : ''}
                        /><span class="model-title"
                          >${esc(release.name)}<small
                            >${esc(release.date || 'Undated')}</small
                          ></span
                        ><span class="picker-score">${score(release)}</span></label
                      >`,
                  )
                  .join('')}`
            : '';
        })
        .join('') || '<div class="empty">No matching releases.</div>';
    document.getElementById('picker-count').textContent =
      `${draftIds.size} selected · ${choices.length} shown`;
  }

  function exportCSV(list, filename) {
    const columns = [
      'id',
      'family',
      'model',
      'version',
      'score',
      'release_date',
      'status',
      'source_title',
      'source_url',
      'date_source_url',
      'artificial_analysis_url',
      'weights_status',
      'weights_checked_at',
      'hugging_face_url',
      'weights_source_url',
      'weights_note',
      'note',
      'mapping',
    ];
    const cell = (value) =>
      `"${String(value ?? '')
        .replace(/^[=+@]/, (match) => `'${match}`)
        .replaceAll('"', '""')}"`;
    const rows = list.map((release) => [
      release.id,
      release.familyInfo.name,
      release.name,
      release.version,
      release.score,
      release.date,
      release.status,
      release.source?.title,
      release.source?.url,
      release.dateSource?.url,
      release.artificialAnalysisUrl,
      release.weightsStatus,
      release.weightsCheckedAt,
      release.huggingFaceUrl,
      release.weightsSourceUrl,
      release.weightsNote,
      release.note,
      release.mapping,
    ]);
    const blob = new Blob(
      ['\uFEFF', [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')],
      { type: 'text/csv;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${list.length} releases`);
  }

  async function copyLink() {
    const url = new URL(location.href);
    url.hash = compareHref().slice(1);
    try {
      await navigator.clipboard.writeText(url.href);
      toast('Comparison link copied');
    } catch {
      let shareDialog = document.getElementById('share-dialog');
      if (!shareDialog) {
        shareDialog = document.createElement('dialog');
        shareDialog.id = 'share-dialog';
        shareDialog.setAttribute('aria-labelledby', 'share-title');
        shareDialog.innerHTML = /* HTML */ `<div class="dialog-head">
            <h2 id="share-title">Copy comparison link</h2>
            <button class="icon-button" aria-label="Close link dialog">×</button>
          </div>
          <div class="share-content">
            <label for="share-url">Copy this URL to reopen the same selection.</label
            ><input id="share-url" type="text" readonly />
            <p class="note">For a local file, the recipient also needs a copy of VersionBench.</p>
          </div>`;
        document.body.append(shareDialog);
        shareDialog.querySelector('button').addEventListener('click', () => shareDialog.close());
      }
      shareDialog.querySelector('input').value = url.href;
      shareDialog.showModal();
      shareDialog.querySelector('input').select();
    }
  }

  main.addEventListener('click', (event) => {
    const target = event.target.closest('button,a');
    if (!target) return;
    if (target.matches('[data-open-picker]')) openPicker();
    if (target.matches('[data-copy-link]')) copyLink();
    if (target.matches('[data-remove-release]'))
      navigate(compareHref(compareIds.filter((id) => id !== target.dataset.removeRelease)));
    if (target.matches('[data-clear-comparison]')) navigate(compareHref([]));
    if (target.matches('[data-export-releases]'))
      exportCSV(filteredReleases(), 'versionbench-releases.csv');
    if (target.matches('[data-export-comparison]'))
      exportCSV(selectedReleases(), 'versionbench-comparison.csv');
    if (target.matches('[data-leaderboard-scope]')) {
      leaderboardScope = target.dataset.leaderboardScope;
      renderLeaderboard();
      updateSelectionUI();
    }
    if (target.matches('[data-family-set]')) {
      timelinePrefs.familyIds =
        target.dataset.familySet === 'core'
          ? [...coreIds]
          : target.dataset.familySet === 'all'
            ? families.map((family) => family.id)
            : [];
      navigate(timelineHref(timelinePrefs));
    }
    if (target.matches('[data-only-family]')) {
      timelinePrefs.familyIds = [target.dataset.onlyFamily];
      navigate(timelineHref(timelinePrefs));
    }
    if (target.matches('[data-timeline-zoom]'))
      zoomTimeline(target.dataset.timelineZoom === 'in' ? 0.7 : 1 / 0.7);
    if (target.matches('[data-timeline-reset]')) resetTimelineView();
    if (target.matches('[data-range]')) {
      const range = target.dataset.range;
      const end = new Date(latestTime);
      const start = new Date(latestTime);
      if (range === 'all') start.setTime(earliestTime);
      else if (range === 'ytd') start.setTime(Date.UTC(end.getUTCFullYear(), 0, 1));
      else start.setUTCFullYear(end.getUTCFullYear() - (range === '1y' ? 1 : 3));
      timelinePrefs = {
        ...timelinePrefs,
        from: isoDate(start.getTime()),
        to: isoDate(end.getTime()),
        range,
      };
      navigate(timelineHref(timelinePrefs));
    }
    if (target.matches('[data-index-sort]')) {
      const sort = target.dataset.indexSort;
      indexPrefs.direction =
        indexPrefs.sort === sort && indexPrefs.direction === 'desc' ? 'asc' : 'desc';
      indexPrefs.sort = sort;
      history.replaceState(null, '', indexHref());
      updateReleaseTable();
    }
  });

  main.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-select-release]')) {
      compareIds = target.checked
        ? uniqueValidIds([...compareIds, target.dataset.selectRelease])
        : compareIds.filter((id) => id !== target.dataset.selectRelease);
      updateSelectionUI();
    }
    if (target.matches('[data-family]')) {
      timelinePrefs.familyIds = target.checked
        ? [...timelinePrefs.familyIds, target.dataset.family]
        : timelinePrefs.familyIds.filter((id) => id !== target.dataset.family);
      navigate(timelineHref(timelinePrefs));
    }
    if (target.matches('#date-from,#date-to')) {
      const from = document.getElementById('date-from').value;
      const to = document.getElementById('date-to').value;
      const error = document.getElementById('date-error');
      if (
        !Number.isFinite(parseDate(from)) ||
        !Number.isFinite(parseDate(to)) ||
        parseDate(from) > parseDate(to)
      ) {
        error.textContent = 'Choose valid dates with the start on or before the end.';
        error.hidden = false;
        return;
      }
      const bounds = normalizeTimelineWindow(parseDate(from), parseDate(to), true);
      timelinePrefs = {
        ...timelinePrefs,
        from: isoDate(bounds.start),
        to: isoDate(bounds.end),
        range: 'custom',
      };
      navigate(timelineHref(timelinePrefs));
    }
    if (target.matches('#compare-order')) {
      compareOrder = target.value;
      navigate(compareHref());
    }
    if (target.matches('#release-family')) {
      indexPrefs.family = target.value;
      history.replaceState(null, '', indexHref());
      updateReleaseTable();
    }
  });

  main.addEventListener('input', (event) => {
    if (event.target.id === 'release-search') {
      indexPrefs.query = event.target.value;
      history.replaceState(null, '', indexHref());
      updateReleaseTable();
    }
  });
  main.addEventListener('pointerover', (event) => {
    const control = event.target.closest('[data-highlight-family]');
    if (control && !pinnedPoint) highlightFamilies([control.dataset.highlightFamily]);
  });
  main.addEventListener('pointerout', (event) => {
    const control = event.target.closest('[data-highlight-family]');
    if (control && !control.contains(event.relatedTarget) && !pinnedPoint) highlightFamilies([]);
  });
  document.getElementById('model-search').addEventListener('input', renderPicker);
  document.getElementById('latest-only').addEventListener('change', renderPicker);
  document.getElementById('close-picker').addEventListener('click', () => dialog.close());
  document.getElementById('picker-clear').addEventListener('click', () => {
    draftIds.clear();
    renderPicker();
  });
  document.getElementById('picker-done').addEventListener('click', () => {
    compareIds = [...draftIds];
    dialog.close();
    navigate(compareHref());
  });
  document.getElementById('picker-list').addEventListener('change', (event) => {
    if (event.target.matches('[data-picker-id]')) {
      const id = event.target.dataset.pickerId;
      event.target.checked ? draftIds.add(id) : draftIds.delete(id);
      document.getElementById('picker-count').textContent =
        `${draftIds.size} selected · ${document.querySelectorAll('[data-picker-id]').length} shown`;
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  document.addEventListener('click', (event) => {
    if (pinnedPoint && !tooltip.contains(event.target) && !pinnedPoint.contains(event.target))
      closeTooltip(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !tooltip.hidden) {
      event.preventDefault();
      closeTooltip(true);
    }
  });
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (timelineGesture && !event.target.closest('#timeline-chart')) commitTimelineGesture();
    },
    true,
  );
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentRoute?.page === 'timeline') drawTimeline();
      if (currentRoute?.page === 'compare') {
        const list = selectedReleases();
        drawComparison(
          compareOrder === 'score'
            ? list.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
            : list,
        );
      }
    }, 150);
  });
  document.getElementById('footer-date').textContent = `Updated ${dateLabel(latestDate)}`;
  renderRoute();
})();
