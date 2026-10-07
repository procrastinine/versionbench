(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('release-data').textContent);
  const stats = JSON.parse(document.getElementById('stats-data').textContent);
  const pending = JSON.parse(document.getElementById('pending-data').textContent);
  const watchlist = JSON.parse(document.getElementById('watch-data').textContent);
  const familyStats = new Map(
    [...stats.families, ...stats.softwareControls].map((family) => [family.id, family]),
  );
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
  const modelStartTime = Math.min(
    ...datedReleases
      .filter((release) => release.familyInfo.kind !== 'software')
      .map((release) => release.time),
  );
  const familyPeaks = families
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
  const ranked = familyPeaks.filter((release) => release.familyInfo.kind !== 'software');
  const rankMap = new Map(
    ranked.map((release, index) => [
      release.family,
      ranked.findIndex((other) => other.score === release.score) + 1,
    ]),
  );
  const highestMap = new Map(familyPeaks.map((release) => [release.family, release]));
  const coreIds = families.filter((family) => family.core).map((family) => family.id);
  const main = document.getElementById('main');
  const tooltip = document.getElementById('tooltip');
  const dialog = document.getElementById('model-dialog');
  // Every limited leaderboard view includes the complete boundary tie group.
  const takeWithTies = (rows, limit) => {
    if (!rows.length || limit < 1) return [];
    const cutoff = rows[Math.min(rows.length, limit) - 1].score;
    return rows.filter((release) => release.score >= cutoff);
  };
  let compareIds = takeWithTies(ranked, 3).map((release) => release.id);
  let compareOrder = 'score';
  let draftIds = new Set();
  let previousPage = '';
  let currentRoute = null;
  let timelinePrefs = {
    familyIds: [...coreIds],
    from: isoDate(modelStartTime),
    to: isoDate(latestTime),
    range: 'all',
    mode: 'highest',
    weights: 'all',
    kind: 'all',
    status: 'all',
  };
  let indexPrefs = {
    query: '',
    family: 'all',
    sort: 'date',
    direction: 'desc',
    weights: 'all',
    status: 'all',
    kind: 'model',
  };
  let leaderboardScope = 'all';
  let pinnedPoint = null;
  let suppressPointFocus = false;
  let toastTimer;
  let resizeTimer;
  let timelineGesture = null;
  let timelineDrag = null;
  let timelineGestureTimer;
  let timelineDrawFrame;
  const minimumTimelineSpan = 2 * day;
  const weightsOptions = [
    ['all', 'All weight statuses'],
    ['open', 'Open weights'],
    ['not-published', 'No public weights found'],
    ['unverified', 'Weights unverified'],
    ['not-applicable', 'Not applicable (software)'],
  ];
  const statusOptions = [
    ['all', 'All release statuses'],
    ...[...new Set(releases.map((release) => release.status))]
      .sort()
      .map((status) => [status, status]),
  ];
  const kindOptions = [
    ['all', 'Models & software'],
    ['model', 'Models only'],
    ['software', 'Software controls only'],
  ];
  const modeOptions = [
    ['highest', 'Highest to date'],
    ['latest', 'Latest release'],
  ];
  const optionValue = (options, value, fallback = 'all') =>
    options.some(([key]) => key === value) ? value : fallback;
  const filterControl = (id, label, options, value) =>
    `<label class="filter-control" for="${id}"><span>${label}</span><select id="${id}">${options.map(([key, title]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;
  const matchesFilters = (release, prefs) =>
    (prefs.weights === 'all' || release.weightsStatus === prefs.weights) &&
    (prefs.status === 'all' || release.status === prefs.status) &&
    (!prefs.kind || prefs.kind === 'all' || release.familyInfo.kind === prefs.kind);
  const timelineReleases = () =>
    datedReleases.filter(
      (release) =>
        timelinePrefs.familyIds.includes(release.family) && matchesFilters(release, timelinePrefs),
    );
  // Unselected software must not stretch a model-only view back to 2008.
  const timelineStartTime = () => {
    const selected = timelineReleases();
    return Math.min(
      latestTime - minimumTimelineSpan,
      ...(selected.length ? selected.map((release) => release.time) : [modelStartTime]),
    );
  };

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
  const familyHref = (id) => routeHref('family', { id });
  const familyLink = (family, className = '') =>
    `<a class="${className}" href="${familyHref(family.id)}">${esc(family.name)}</a>`;
  const timelineHref = (prefs) =>
    routeHref('timeline', {
      families: prefs.familyIds.join(','),
      from: prefs.from,
      to: prefs.to,
      range: prefs.range,
      mode: prefs.mode,
      weights: prefs.weights,
      kind: prefs.kind,
      status: prefs.status,
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
      <strong>Number responsibly.</strong> VersionBench obeys mathematics, not semantic versioning.
      Thus 3.9 &gt; 3.10. A larger number is a larger number.
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
    const chartList = takeWithTies(list, 10);
    const ceiling = Math.max(1, Math.ceil(list[0]?.score || 1));
    main.innerHTML =
      head(
        'VERSIONBENCH / LEADERBOARD',
        'Version Benchmark Leaderboard',
        'No training-data contamination, no judge bias, no prompt sensitivity, no sampling variance, no benchmark saturation, no data leakage, 100% reproducible.<span class="benchmark-definition">Benchmark score = numeric release version.</span>',
      ) +
      /* HTML */ `<div class="stats leaderboard-cards">
          ${takeWithTies(ranked, 3)
            .map(
              (release) =>
                /* HTML */ `<article class="stat" style="${familyStyle(release.familyInfo)}">
                  <div class="stat-top">
                    <span>Benchmark score</span
                    ><span class="rank-tag">#${rankMap.get(release.family)}</span>
                  </div>
                  <div class="stat-main">
                    <div>
                      <div class="stat-name">${familyLink(release.familyInfo)}</div>
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
                    <th>Family</th>
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
                              <div class="family-name">${familyLink(release.familyInfo)}</div>
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
                          href="${familyHref(release.family)}"
                          title="${esc(release.familyInfo.name)} release history and statistics"
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
              <span><strong>${stats.familyCount}</strong> model families</span
              ><span><strong>${stats.releaseCount}</strong> model releases</span
              ><span><strong>${stats.sourceCount}</strong> model sources</span>
            </div>
            <p class="note">
              ${stats.softwareControlCount} software controls are available in the
              <a
                href="${routeHref('timeline', {
                  families: families
                    .filter((family) => family.kind === 'software')
                    .map((family) => family.id)
                    .join(','),
                  mode: 'latest',
                })}"
                >expanded dataset</a
              >. They have no vote in these rankings.
            </p>
          </div>
        </div>`;
  }

  function timelineState(params) {
    const familyIds = params.has('families')
      ? [...new Set(params.get('families').split(','))].filter((id) => familyMap.has(id))
      : timelinePrefs.familyIds;
    const explicit = params.size > 0;
    const fallback = (key, value) => (explicit ? value : timelinePrefs[key]);
    timelinePrefs = {
      ...timelinePrefs,
      familyIds,
      range: ['all', '3y', '1y', 'ytd', 'custom'].includes(params.get('range'))
        ? params.get('range')
        : params.has('from') || params.has('to')
          ? 'custom'
          : fallback('range', 'all'),
      mode: optionValue(modeOptions, params.get('mode'), fallback('mode', 'highest')),
      weights: optionValue(weightsOptions, params.get('weights'), fallback('weights', 'all')),
      status: optionValue(statusOptions, params.get('status'), fallback('status', 'all')),
      kind: optionValue(kindOptions, params.get('kind'), fallback('kind', 'all')),
    };
    const earliest = timelineStartTime();
    const from =
      timelinePrefs.range === 'all'
        ? earliest
        : Number.isFinite(parseDate(params.get('from')))
          ? parseDate(params.get('from'))
          : parseDate(timelinePrefs.from);
    const to =
      timelinePrefs.range === 'all'
        ? latestTime
        : Number.isFinite(parseDate(params.get('to')))
          ? parseDate(params.get('to'))
          : parseDate(timelinePrefs.to);
    const bounds = normalizeTimelineWindow(
      from <= to ? from : earliest,
      from <= to ? to : latestTime,
      true,
    );
    timelinePrefs.from = isoDate(bounds.start);
    timelinePrefs.to = isoDate(bounds.end);
  }

  function renderTimeline(params) {
    timelineState(params);
    // Canonical dates make Back restore the view even when entered through #timeline.
    history.replaceState(null, '', timelineHref(timelinePrefs));
    const familyControls = (predicate) =>
      families
        .filter(predicate)
        .map(
          (family) =>
            /* HTML */ `<div class="family-control" data-highlight-family="${esc(family.id)}">
              <input
                class="family-check"
                type="checkbox"
                id="family-${esc(family.id)}"
                data-family="${esc(family.id)}"
                aria-label="Show ${esc(family.name)} on timeline"
                ${timelinePrefs.familyIds.includes(family.id) ? 'checked' : ''}
              /><span class="swatch" style="${familyStyle(family)}"></span
              >${familyLink(family, 'family-control-link')}
              <span class="family-version"
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
        'Track numeric progress, reversals, and prolonged commitments to the same number.',
      ) +
      /* HTML */ `<div class="timeline-layout">
        <aside class="panel families-panel" aria-label="Family filters">
          <div class="sidebar-title">
            Families<span class="mini-label"
              >${timelinePrefs.familyIds.length}/${families.length}</span
            >
          </div>
          <div class="sidebar-controls">
            <button class="text-button" data-family-set="core">Core 10</button
            ><button class="text-button" data-family-set="models">All models</button
            ><button class="text-button" data-family-set="none">None</button>
          </div>
          <label class="sr-only" for="family-search">Find a family</label>
          <input
            id="family-search"
            type="search"
            placeholder="Find a family…"
            class="family-search"
          />
          <div class="family-section-label">CORE FAMILIES</div>
          <div class="family-group">${familyControls((family) => family.core)}</div>
          <details class="expanded-families" id="expanded-families" open>
            <summary>Expanded dataset</summary>
            <div class="software-controls">
              <div class="family-section-label">SOFTWARE CONTROLS</div>
              <p class="sidebar-note">Reference only. Excluded from model ranks and statistics.</p>
              <div class="family-group">
                ${familyControls((family) => family.kind === 'software')}
              </div>
              <button class="text-button" data-family-set="software">
                Show software controls →
              </button>
            </div>
            <details class="additional-models" id="additional-models" open>
              <summary>Additional model families</summary>
              <div class="family-group">
                ${familyControls((family) => !family.core && family.kind !== 'software')}
              </div>
            </details>
            <button class="text-button" data-family-set="all">Select every family</button>
          </details>
        </aside>
        <div>
          <section class="panel">
            <div class="timeline-filters">
              ${filterControl('timeline-mode', 'Line shows', modeOptions, timelinePrefs.mode)}
              ${filterControl('timeline-weights', 'Weights', weightsOptions, timelinePrefs.weights)}
              ${filterControl('timeline-kind', 'Category', kindOptions, timelinePrefs.kind)}
              ${filterControl('timeline-status', 'Release status', statusOptions, timelinePrefs.status)}
            </div>
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
                  min="${isoDate(timelineStartTime())}"
                  max="${isoDate(latestTime)}"
                  value="${esc(timelinePrefs.from)}"
                /><label for="date-to">To</label
                ><input
                  id="date-to"
                  type="date"
                  min="${isoDate(timelineStartTime())}"
                  max="${isoDate(latestTime)}"
                  value="${esc(timelinePrefs.to)}"
                />
              </div>
            </div>
            <div class="timeline-navigation">
              <p id="timeline-gesture-hint">
                Scroll or pinch to zoom · Drag or swipe sideways to pan · Reset keeps selected
                filters<span class="sr-only"
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
                ><strong>Line:</strong>
                ${timelinePrefs.mode === 'latest' ? 'latest matching release; same-day ties use the highest score.' : 'highest matching score to date.'}
                <strong>Points:</strong> individual releases.</span
              ><span
                >Click a point for its release source. Outlined points contain multiple
                releases.</span
              >
            </div>
          </section>
          <p class="note">
            Filters apply to lines, points, and the table. Weights describe current checked
            availability.
            ${timelinePrefs.mode === 'latest' ? 'Lower numbers produce lower lines. The graph regrets nothing.' : 'Switch to “Latest release” to observe numeric regressions.'}
            <a href="#methodology">Methodology ↗</a>
          </p>
          <details class="panel timeline-details subsection">
            <summary id="timeline-table-summary">Explore plotted releases in a table</summary>
            <div id="timeline-table" class="table-wrap"></div>
            <div class="panel-foot">
              <span>Only matching releases in the visible date range.</span
              ><button class="text-button" data-export-timeline>Export CSV ↓</button>
            </div>
          </details>
        </div>
      </div>`;
    drawTimeline();
    syncTimelineControls();
    bindTimelineGestures(document.getElementById('timeline-chart'));
  }

  // Keep continuous gesture deltas internally, while the displayed/shared view uses UTC days.
  function normalizeTimelineWindow(start, end, snap = false) {
    const earliestTime = timelineStartTime();
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
    if (zoomOut) zoomOut.disabled = span >= latestTime - timelineStartTime();
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
      Math.min(latestTime - timelineStartTime(), span * factor),
    );
    const fixedTime = gesture.start + span * anchor;
    applyTimelineWindow(fixedTime - nextSpan * anchor, fixedTime + nextSpan * (1 - anchor));
    if (defer) deferTimelineCommit();
    else commitTimelineGesture();
  }

  function resetTimelineView() {
    commitTimelineGesture();
    beginTimelineGesture('control');
    applyTimelineWindow(timelineStartTime(), latestTime);
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
    const selected = timelineReleases();
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
        // Choose a daily maximum before drawing, so a day with several variants
        // has one deterministic line height while keeping all its release points.
        const daily = new Map();
        selected
          .filter((release) => release.family === familyId && release.time <= end)
          .forEach((release) => {
            const previous = daily.get(release.time);
            if (!previous || release.score > previous.score) daily.set(release.time, release);
          });
        const list = [...daily.values()].sort((a, b) => a.time - b.time);
        let high = null;
        let path = '';
        list.forEach((release) => {
          if (release.time < start) {
            high =
              timelinePrefs.mode === 'latest'
                ? release.score
                : Math.max(high ?? -Infinity, release.score);
            return;
          }
          if (!path && high !== null) path = `M${x(start).toFixed(2)},${y(high).toFixed(2)}`;
          if (high === null) {
            high = release.score;
            path = `M${x(release.time).toFixed(2)},${y(high).toFixed(2)}`;
          } else if (
            release.score !== high &&
            (timelinePrefs.mode === 'latest' || release.score > high)
          ) {
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
        Release date on x axis, benchmark score (numeric version) on y axis. Lines show the
        ${timelinePrefs.mode === 'latest' ? 'latest matching release' : 'highest matching score to date'}.
        Each release point links to its source; coincident points open a list. ${visible.length}
        releases in the selected date range. Use Tab to explore points.
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
                  ? 'No releases match these filters and dates'
                  : 'Select a family to explore releases'
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
    bindReleasePoints(container);
  }

  function bindReleasePoints(container) {
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
    tooltip.innerHTML = `${pinned ? '<button class="tip-close" aria-label="Close release list">×</button>' : ''}<strong>${point.dataset.pointTitle ? esc(point.dataset.pointTitle) : group.length > 1 ? `${group.length} releases at version ${score(release)}` : esc(release.name)}</strong><div class="tip-meta"><span>${esc(release.date)}</span><span>${point.dataset.rank ? `Family rank #${point.dataset.rank}` : `Benchmark score ${score(release)}`}</span></div>${
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
                  ? 'Release links open the dated evidence; HF links open model weights.'
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
                        <a class="family-inline" href="${familyHref(release.family)}"
                          ><span class="swatch" style="${familyStyle(release.familyInfo)}"></span
                          >${esc(release.familyInfo.name)}</a
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
          ><a
            class="preset"
            href="${compareHref(takeWithTies(ranked, 3).map((release) => release.id))}"
            >Top 3, including ties</a
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
        matchesFilters(release, indexPrefs) &&
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
    const inFamily = currentRoute?.page === 'family';
    return routeHref(inFamily ? 'family' : 'releases', {
      id: inFamily ? indexPrefs.family : undefined,
      q: indexPrefs.query || undefined,
      family: inFamily || indexPrefs.family === 'all' ? undefined : indexPrefs.family,
      sort: indexPrefs.sort,
      direction: indexPrefs.direction,
      weights: indexPrefs.weights === 'all' ? undefined : indexPrefs.weights,
      status: indexPrefs.status === 'all' ? undefined : indexPrefs.status,
      kind: inFamily || indexPrefs.kind === 'model' ? undefined : indexPrefs.kind,
    });
  }

  function readIndexPrefs(params, family = null) {
    indexPrefs = {
      query: params.get('q') || '',
      family: family || (familyMap.has(params.get('family')) ? params.get('family') : 'all'),
      sort: ['date', 'score', 'name'].includes(params.get('sort')) ? params.get('sort') : 'date',
      direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
      weights: optionValue(weightsOptions, params.get('weights')),
      status: optionValue(statusOptions, params.get('status')),
      kind: family
        ? 'all'
        : optionValue(
            kindOptions,
            params.get('kind'),
            familyMap.get(params.get('family'))?.kind || 'model',
          ),
    };
  }

  function renderReleases(params) {
    readIndexPrefs(params);
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
              ${filterControl('release-weights', 'Weights', weightsOptions, indexPrefs.weights)}
              ${filterControl('release-status', 'Release status', statusOptions, indexPrefs.status)}
              ${filterControl('release-kind', 'Category', kindOptions, indexPrefs.kind)}
            </div>
            <span id="release-count" class="index-count" aria-live="polite"></span>
          </div>
          <div id="release-table" class="table-wrap"></div>
          <div class="panel-foot">
            <span
              >Dates identify announcements, API access, weights releases, research, or explicitly
              labeled checkpoint date evidence.</span
            ><a href="${compareHref()}" data-compare-link
              >Compare selected (${compareIds.length}) →</a
            >
          </div>
        </section>
        ${note()}`;
    updateReleaseTable();
  }

  function renderFamily(params) {
    const family = familyMap.get(params.get('id'));
    if (!family) {
      main.innerHTML =
        head(
          'VERSIONBENCH / FAMILY',
          'Family not found',
          'This family has not submitted a number.',
        ) + '<p><a href="#leaderboard">Browse all families →</a></p>';
      return;
    }
    readIndexPrefs(params, family.id);
    const summary = familyStats.get(family.id);
    const best = releaseMap.get(summary.firstReleaseAtHighestVersion.id);
    const latest = releaseMap.get(summary.latestRelease.id);
    const timeline = routeHref('timeline', {
      families: family.id,
      mode: family.kind === 'software' ? 'latest' : 'highest',
    });
    const decimal = (value) =>
      value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const software = family.kind === 'software';
    const unresolved = pending.filter((row) => row.family === family.id);
    const watched = watchlist.find((entry) => entry.family === family.id);
    const metrics = software
      ? [
          [
            'Recorded releases',
            summary.releaseCount.toLocaleString('en-US'),
            'Reference history only.',
          ],
          [
            'Distinct versions',
            summary.versionCount.toLocaleString('en-US'),
            'Published labels. No rank assigned.',
          ],
        ]
      : [
          [
            'Time at #1',
            `${summary.daysAtNumberOne.toLocaleString('en-US')} days`,
            'Including shared first place.',
          ],
          ['Average rank', decimal(summary.averageRank), 'Time-weighted. Every day counts.'],
          [
            'Number of releases',
            summary.releaseCount.toLocaleString('en-US'),
            'Recorded events, including variants.',
          ],
          [
            'Average release rate',
            `${decimal(summary.releaseRatePerYear)} / year`,
            'Releases divided by time. Productivity.',
          ],
        ];
    main.innerHTML =
      `<a class="back-link" href="#leaderboard">← All families</a>` +
      head(
        'VERSIONBENCH / FAMILY',
        esc(family.name),
        `${esc(family.provider)} · ${software ? 'Software control · Unranked' : `Model family · Current rank #${summary.currentRank}`}`,
        `<div class="head-actions"><a class="button" href="${timeline}">View timeline →</a><button class="button" data-export-releases>Export releases ↓</button></div>`,
      ) +
      `${family.scope ? `<p class="family-scope">${esc(family.scope)}</p>` : ''}` +
      `<section class="family-metrics ${software ? 'control-metrics' : ''}" aria-label="${software ? 'Software reference summary' : 'Family statistics'}" style="${familyStyle(family)}">${metrics
        .map(
          ([label, value, caption]) =>
            `<article class="stat"><h2>${label}</h2><strong>${value}</strong><p>${caption}</p></article>`,
        )
        .join('')}</section>` +
      (software
        ? '<p class="note">Software controls are excluded from model counts, leaderboard ranks, time at #1, and lifetime average rank. They are here to provide perspective.</p>'
        : `<details class="stats-method"><summary>How these statistics are calculated</summary>
        <p>Tracked from ${esc(summary.firstEventDate)} through ${esc(stats.snapshot)}, inclusive (${summary.trackedDays.toLocaleString('en-US')} UTC days).
        Each model family competes from its first recorded event, using its highest numeric score reached by each day. All ${stats.familyCount} model families compete; software controls are excluded. Ties share rank and receive full days at #1.</p>
        <p>Average rank is rank × days, divided by tracked days. Release rate is ${summary.releaseCount} recorded events / (${summary.trackedDays} days / 365.2425).
        Announcements and variants count separately. Filters below affect the release table; these statistics always cover the whole family. <a href="#methodology">Full methodology →</a></p>
      </details>`) +
      `<section class="panel family-rank-panel" style="${familyStyle(family)}">
        <div class="panel-head"><div><h2>${software ? 'Version over time' : 'Version and rank over time'}</h2><p>${software ? 'Latest released version. Numeric regressions remain on the record.' : 'Lines: highest version and historical rank. Points: every release, including lower versions. Click for sources.'}</p></div></div>
        <div class="family-chart-legend">${software ? '' : '<span><i class="legend-rank"></i>Rank · left axis</span>'}<span><i class="legend-version"></i>Version · right axis</span></div>
        <div id="family-rank-chart" class="family-rank-chart" data-rank-family="${esc(family.id)}"></div>
        <details class="rank-history-details"><summary>View changes as a table</summary><div class="table-wrap"><table>
          <caption class="sr-only">${esc(family.name)} version${software ? '' : ' and rank'} history</caption><thead><tr><th>From date (UTC)</th>${software ? '' : '<th>Rank</th>'}<th>Version</th><th>Numeric score</th></tr></thead>
          <tbody>${familyHistoryRows(summary)
            .map(
              (entry) =>
                `<tr><td>${esc(entry.date)}</td>${software ? '' : `<td>#${entry.rank}</td>`}<td>${esc(entry.version)}</td><td>${numberLabel(entry.score)}</td></tr>`,
            )
            .join('')}</tbody>
        </table></div></details></section>` +
      `<div class="family-highlights">
        <section class="panel family-highlight"><span class="eyebrow">HIGHEST SCORE${software ? '' : ` · #${summary.currentRank}`}</span>
          <strong class="family-highlight-score">${score(best)}</strong><h2>${sourceLink(best, esc(best.name))}</h2>
          <p>First reached ${esc(best.date)}. Priority goes to the first number on the scene.</p>
          <div class="head-actions">${analysisLink(best)} ${weightsLink(best)}</div></section>
        <section class="panel family-highlight"><span class="eyebrow">LATEST RECORDED RELEASE</span>
          <strong class="family-highlight-score">${score(latest)}</strong><h2>${sourceLink(latest, esc(latest.name))}</h2>
          <p>${esc(latest.date)} · ${latest.score < best.score ? 'A lower number. The previous record stands.' : 'The number speaks for itself.'}</p>
          <div class="head-actions">${analysisLink(latest)} ${weightsLink(latest)}</div></section>
      </div>` +
      `<section class="panel family-history"><div class="panel-head"><div><h2>Release history</h2><p>${esc(summary.firstEventDate)} – ${esc(summary.lastEventDate)} · Links, dates, and the numbers in question.</p></div></div>
        <div class="table-toolbar"><div class="inline-controls">
          <label class="sr-only" for="release-search">Search this family's releases</label><input class="search-input" id="release-search" type="search" placeholder="Search this family…" value="${esc(indexPrefs.query)}" />
          ${filterControl('release-weights', 'Weights', weightsOptions, indexPrefs.weights)}
          ${filterControl('release-status', 'Release status', statusOptions, indexPrefs.status)}
        </div><span id="release-count" class="index-count" aria-live="polite"></span></div>
        <div id="release-table" class="table-wrap"></div>
        <div class="panel-foot"><span>First recorded release does not imply first-ever release.</span><a href="${compareHref()}" data-compare-link>Compare selected (${compareIds.length}) →</a></div></section>` +
      (unresolved.length
        ? `<section class="panel family-sources"><div class="panel-head"><div><h2>Awaiting date evidence</h2><p>These candidates do not enter dated rankings.</p></div></div><ul>${unresolved.map((row) => `<li><strong>${esc(row.name)}</strong><span>${esc(row.reason)} ${row.sourceUrls.map((url, i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ${i + 1} ↗</a>`).join(' · ')}</span></li>`).join('')}</ul></section>`
        : '') +
      `<section class="panel family-sources"><div class="panel-head"><div><h2>Pages to watch</h2><p>Announcements, API releases, and weights can arrive on different days.</p></div></div>
        <ul>${watched.sources
          .map((source) => {
            const url =
              source.type === 'huggingface'
                ? `https://huggingface.co/${source.author}/models`
                : source.url;
            const label =
              source.type === 'huggingface'
                ? `${source.author} on Hugging Face`
                : url.replace(/^https:\/\//, '');
            return `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a><span>${esc(source.purpose)}</span></li>`;
          })
          .join('')}</ul>
        <div class="panel-foot"><span>Listed sources are monitored by the repository audit. The numbers receive no special treatment.</span></div></section>`;
    updateReleaseTable();
    drawFamilyRank();
  }

  function familyHistoryRows(summary) {
    const ranks = summary.rankHistory ?? [];
    const versions = summary.versionHistory;
    const dates = [...new Set([...ranks, ...versions].map((entry) => entry.date))].sort();
    let ri = 0,
      vi = 0;
    return dates.map((date) => {
      while (ri + 1 < ranks.length && ranks[ri + 1].date <= date) ri++;
      while (vi + 1 < versions.length && versions[vi + 1].date <= date) vi++;
      return { ...versions[vi], date, ...(ranks.length ? { rank: ranks[ri].rank } : {}) };
    });
  }

  function drawFamilyRank() {
    const container = document.getElementById('family-rank-chart');
    if (!container) return;
    const family = familyMap.get(container.dataset.rankFamily);
    const summary = familyStats.get(family.id);
    const entries = summary.rankHistory ?? [];
    const versions = summary.versionHistory;
    const software = family.kind === 'software';
    const familyReleases = datedReleases.filter((release) => release.family === family.id);
    const versionGroups = new Map();
    for (const release of familyReleases) {
      const key = release.date + ':' + release.score;
      if (!versionGroups.has(key)) versionGroups.set(key, []);
      versionGroups.get(key).push(release);
    }
    const rankDates = software
      ? []
      : [...new Set([...entries.map((e) => e.date), ...familyReleases.map((r) => r.date)])].sort();
    const rankPoints = rankDates.map((date) => {
      const entry = entries.findLast((e) => e.date <= date);
      const own = familyReleases.filter((r) => r.date === date);
      return {
        date,
        rank: entry.rank,
        changed: entries.some((e) => e.date === date),
        releases:
          entry.date === date
            ? datedReleases.filter((r) => r.date === date && r.familyInfo.kind !== 'software')
            : own,
      };
    });
    const width = Math.max(280, container.clientWidth);
    const height = 320;
    const pad = { top: 24, right: 72, bottom: 52, left: software ? 30 : 66 };
    const start = parseDate(summary.firstEventDate);
    const end = Math.max(start + day, parseDate(stats.snapshot));
    const maxRank = Math.max(2, ...entries.map((entry) => entry.rank));
    const maxVersion = Math.max(1, Math.ceil(summary.highestScore));
    const plotHeight = height - pad.top - pad.bottom;
    const right = width - pad.right;
    const x = (time) => pad.left + ((time - start) / (end - start)) * (right - pad.left);
    const yRank = (rank) => pad.top + ((rank - 1) / (maxRank - 1)) * plotHeight;
    const yVersion = (value) => height - pad.bottom - (value / maxVersion) * plotHeight;
    const stepPath = (series, value, y) => {
      let path = `M${x(start).toFixed(2)},${y(series[0][value]).toFixed(2)}`;
      for (const entry of series.slice(1))
        path += `H${x(parseDate(entry.date)).toFixed(2)}V${y(entry[value]).toFixed(2)}`;
      return path + `H${x(end).toFixed(2)}`;
    };
    const interval = Math.max(1, Math.ceil((maxRank - 1) / 5));
    const ticks = [
      ...new Set([
        1,
        ...Array.from({ length: Math.floor(maxRank / interval) }, (_, i) => (i + 1) * interval),
        maxRank,
      ]),
    ].sort((a, b) => a - b);
    // Do not crowd the final rank tick against the preceding one.
    const rankTicks = ticks.filter(
      (rank, i) => i === ticks.length - 1 || maxRank - rank >= interval * 0.55,
    );
    const versionTicks = Array.from({ length: 6 }, (_, i) => (i * maxVersion) / 5);
    const middle = pad.top + plotHeight / 2;
    const releasePoint = (group, cx, cy, shape, extra, label) => {
      const attrs = `data-point-ids="${esc(group.map((r) => r.id).join(','))}" data-point-families="${esc([...new Set(group.map((r) => r.family))].join(','))}" ${extra}`;
      const hit = `<circle class="point-hit" cx="${cx}" cy="${cy}" r="10" fill="transparent"/>`;
      const title = `<title>${esc(label)}</title>`;
      if (group.length === 1)
        return `<a class="point-link family-point" ${attrs} href="${esc(group[0].source.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}. Open release source.">${hit}${shape}${title}</a>`;
      return `<g class="point-link point-group family-point" ${attrs} role="button" tabindex="0" aria-haspopup="dialog" aria-label="${esc(label)}. Open ${group.length} release sources.">${hit}${shape}${title}</g>`;
    };
    container.innerHTML = `<svg class="rank-svg" viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="rank-title rank-description">
      <title id="rank-title">${esc(family.name)} version${software ? '' : ' and rank'} over time</title>
      <desc id="rank-description">${software ? 'Latest released version on the right axis. Software controls have no rank.' : 'Historical competition rank on the left axis, with number 1 at the top. Highest numeric version reached on the right axis, with higher versions at the top.'} Both use dates from ${esc(summary.firstEventDate)} through ${esc(stats.snapshot)}. A table of all changes follows.</desc>
      ${software ? '' : `<text class="axis-title rank-axis-title" transform="translate(16 ${middle}) rotate(-90)" text-anchor="middle">Rank</text>`}
      <text class="axis-title version-axis-title" transform="translate(${width - 15} ${middle}) rotate(90)" text-anchor="middle">Version</text>
      ${(software ? versionTicks : rankTicks)
        .map((value) => {
          const y = software ? yVersion(value) : yRank(value);
          return `<line class="grid-line" x1="${pad.left}" x2="${right}" y1="${y}" y2="${y}"/>${software ? '' : `<text x="${pad.left - 12}" y="${y + 4}" text-anchor="end">${value}</text>`}`;
        })
        .join('')}
      ${versionTicks.map((value) => `<text x="${right + 12}" y="${yVersion(value) + 4}" text-anchor="start">${numberLabel(value)}</text>`).join('')}
      ${dateTicks(start, end, right - pad.left)
        .map(
          (tick) =>
            `<text x="${x(tick.time)}" y="${height - 27}" text-anchor="middle">${esc(tick.label)}</text>`,
        )
        .join('')}
      <path class="family-version-line" d="${stepPath(versions, 'score', yVersion)}" fill="none" stroke-width="2.5" stroke-dasharray="6 4"/>
      ${software ? '' : `<path class="rank-line" d="${stepPath(entries, 'rank', yRank)}" stroke="${family.color}" fill="none" stroke-width="2.5"/>`}
      ${[...versionGroups.values()]
        .map((group) => {
          const r = group[0],
            cx = x(r.time),
            cy = yVersion(r.score);
          return releasePoint(
            group,
            cx,
            cy,
            `<rect class="family-version-point" x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7"/>`,
            `data-version="${esc(r.version)}" data-version-score="${r.score}" data-version-date="${r.date}"`,
            `${r.date} · Version ${r.version} · ${group.map((r) => r.name).join(' / ')}`,
          );
        })
        .join('')}
      ${rankPoints
        .map((entry) => {
          const cx = x(parseDate(entry.date)),
            cy = yRank(entry.rank);
          return releasePoint(
            entry.releases,
            cx,
            cy,
            `<circle class="rank-point" cx="${cx}" cy="${cy}" r="${entry.changed ? 4.5 : 3.5}" fill="${family.color}"/>`,
            `data-rank="${entry.rank}" data-rank-date="${entry.date}" data-rank-change="${entry.changed}" data-point-title="${esc(family.name)} · rank #${entry.rank}"`,
            `${entry.date} · ${family.name} rank #${entry.rank} · ${entry.releases.map((r) => r.name).join(' / ')}`,
          );
        })
        .join('')}
      <text class="axis-title" x="${(pad.left + right) / 2}" y="${height - 6}" text-anchor="middle">Date (UTC)</text>
    </svg>`;
    bindReleasePoints(container);
  }

  function updateReleaseTable() {
    const list = filteredReleases();
    document.getElementById('release-table').innerHTML = releaseTable(list, true, true);
    document.getElementById('release-count').textContent =
      `${list.length} of ${currentRoute?.page === 'family' ? familyStats.get(indexPrefs.family).releaseCount : releases.filter((release) => indexPrefs.kind === 'all' || release.familyInfo.kind === indexPrefs.kind).length} releases`;
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
          benchmark does not imply a more capable model. VersionBench obeys mathematics, not
          semantic versioning. Thus <code>3.9 &gt; 3.10</code>. Vendors are advised to number
          responsibly. Additional decimal points are removed: Dolphin <code>2.9.3</code> scores
          <code>2.93</code>. The published label stays intact.
        </p>
        <h2>Software controls</h2>
        <p>
          Python, PyTorch, and GTA are unranked software controls. Python 3.10 scores
          <code>3.1</code>; PyTorch 2.10 scores <code>2.1</code>. GTA V's platform releases each
          score <code>5</code>. Stable minor versions are recorded for Python 3 and PyTorch 1.0
          onward; patch releases and previews are excluded. GTA covers the releases and rereleases
          of GTA V. Consistency is documented.
        </p>
        <p>
          Software controls live in a separate category under “Expanded dataset”. They are
          deselected by default, and their dates do not extend a model-only timeline. Select them to
          include their history.
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
          The horizontal axis uses the documented event date. Checkpoint commits use UTC and are
          labeled separately; they do not establish when a private repository became public.
          Availability labels distinguish research announcements, previews, and released models; an
          announcement date does not imply general availability. The vertical axis is the exact
          numeric version. “Highest to date” follows the family's highest matching score reached so
          far. “Latest release” follows the newest matching release and can go down. If several
          releases share a day, that day's highest score sets the latest-release line. Individual
          points retain every event and its own version.
        </p>
        <p>
          Variants retain separate release records even when they have the same numeric version.
          Points sharing the exact date and version occupy the same coordinate. An outlined point
          opens a list of all release sources at that position. Date filters change the visible
          interval; a line can continue into that interval from a release that predates it. Family,
          weights, category, and release-status filters apply to points, lines, and the table,
          including the history carried into the viewport. These filters are saved in the URL.
        </p>
        <h2>Family statistics</h2>
        <p>
          Each family enters the historical leaderboard on its first recorded event and remains
          active through the snapshot date, inclusive. Every UTC day's events take effect together;
          model families compete using their highest numeric score reached by then. Python, PyTorch,
          and GTA are excluded from model statistics and ranks. Rank is one plus the number of
          active model families with a strictly higher score.
        </p>
        <p>
          <strong>Time at #1</strong> counts days in first place, giving each tied family the full
          day. <strong>Average rank</strong> is the sum of rank × days at that rank, divided by
          tracked days. <strong>Number of releases</strong> counts recorded events, including
          variants and separate announcements. <strong>Average release rate</strong> is that count /
          (tracked days / 365.2425), in releases per year. Quiet time after the last release still
          counts as time. Page filters do not recalculate these metrics.
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
          When Hugging Face is the only release evidence, only the first commit containing model
          weights counts for that checkpoint. If that history is inaccessible, a reviewed repository
          creation date can serve as an explicitly labeled fallback after verifying weight metadata.
          Documentation changes and later weight uploads are not new model releases. Quantizations and format conversions do not
          count either. Uploading is not a numbering strategy.
        </p>
        <p>
          A repository creation fallback does not establish when weights were uploaded or made
          public. “Available by” marks dated evidence that a hosted model already existed, not its
          original launch day. Historical ranks use the recorded dates and inherit these limits.
        </p>
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
          of the check; “Weights unverified” means an exact match remains unresolved. Software
          controls use “Not applicable”; their source code is not classified as model weights.
        </p>
        <p>
          This snapshot contains <strong>${stats.releaseCount} model release records</strong> across
          <strong>${stats.familyCount} model families</strong>, with
          <strong>${stats.sourceCount} model source records</strong>, as of
          ${esc(dateLabel(latestDate))}. Separately, it includes ${stats.softwareControlCount}
          software controls with ${stats.softwareReleaseCount} release records. It is a curated
          version history, not an exhaustive list of model sizes, checkpoints, API aliases, or every
          deployment update. Muse is tracked as a separate family from Llama.
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
              .filter((family) => !family.core && family.kind !== 'software')
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
    const page = [
      'leaderboard',
      'timeline',
      'compare',
      'releases',
      'family',
      'methodology',
    ].includes(rawPage)
      ? rawPage
      : 'leaderboard';
    const params = new URLSearchParams(rawParams);
    const focusId = document.activeElement?.id;
    const pageKey = page === 'family' ? `family:${params.get('id')}` : page;
    const samePage = pageKey === previousPage;
    closeTooltip(false);
    currentRoute = { page, params };
    if (page === 'leaderboard') renderLeaderboard();
    if (page === 'timeline') renderTimeline(params);
    if (page === 'compare') renderCompare(params);
    if (page === 'releases') renderReleases(params);
    if (page === 'family') renderFamily(params);
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
    previousPage = pageKey;
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
    const choices = (highestOnly ? familyPeaks : releases).filter(
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
      'event_type',
      'date_basis',
      'date_repository_url',
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
      release.eventType,
      release.dateBasis || 'publisher',
      release.dateRepositoryUrl,
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
      exportCSV(
        filteredReleases(),
        currentRoute?.page === 'family'
          ? `versionbench-${indexPrefs.family}.csv`
          : 'versionbench-releases.csv',
      );
    if (target.matches('[data-export-timeline]'))
      exportCSV(
        timelineReleases()
          .filter(
            (release) => release.date >= timelinePrefs.from && release.date <= timelinePrefs.to,
          )
          .sort((a, b) => b.time - a.time || b.score - a.score),
        'versionbench-timeline.csv',
      );
    if (target.matches('[data-export-comparison]'))
      exportCSV(selectedReleases(), 'versionbench-comparison.csv');
    if (target.matches('[data-leaderboard-scope]')) {
      leaderboardScope = target.dataset.leaderboardScope;
      renderLeaderboard();
      updateSelectionUI();
    }
    if (target.matches('[data-family-set]')) {
      const set = target.dataset.familySet;
      timelinePrefs.familyIds =
        set === 'core'
          ? [...coreIds]
          : set === 'all'
            ? families.map((family) => family.id)
            : set === 'models'
              ? families.filter((family) => family.kind === 'model').map((family) => family.id)
              : set === 'software'
                ? families.filter((family) => family.kind === 'software').map((family) => family.id)
                : [];
      if (set === 'software')
        Object.assign(timelinePrefs, {
          mode: 'latest',
          kind: 'all',
          weights: 'all',
          status: 'all',
          range: 'all',
        });
      if (set === 'core' || set === 'models') timelinePrefs.kind = 'all';
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
      if (range === 'all') start.setTime(timelineStartTime());
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
    if (target.matches('#timeline-mode,#timeline-weights,#timeline-kind,#timeline-status')) {
      timelinePrefs[target.id.replace('timeline-', '')] = target.value;
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
    if (target.matches('#release-family,#release-weights,#release-status,#release-kind')) {
      indexPrefs[target.id.replace('release-', '')] = target.value;
      if (target.id === 'release-family' && familyMap.has(target.value)) {
        indexPrefs.kind = familyMap.get(target.value).kind;
        document.getElementById('release-kind').value = indexPrefs.kind;
      }
      if (
        target.id === 'release-kind' &&
        familyMap.has(indexPrefs.family) &&
        indexPrefs.kind !== 'all' &&
        familyMap.get(indexPrefs.family).kind !== indexPrefs.kind
      ) {
        indexPrefs.family = 'all';
        document.getElementById('release-family').value = 'all';
      }
      history.replaceState(null, '', indexHref());
      updateReleaseTable();
    }
  });

  main.addEventListener('input', (event) => {
    if (event.target.id === 'family-search') {
      const query = event.target.value.trim().toLocaleLowerCase();
      document.querySelectorAll('.family-control').forEach((row) => {
        const family = familyMap.get(row.dataset.highlightFamily);
        row.hidden = !`${family.name} ${family.provider}`.toLocaleLowerCase().includes(query);
      });
      if (query) {
        document.getElementById('expanded-families').open = true;
        document.getElementById('additional-models').open = true;
      }
    }
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
      if (currentRoute?.page === 'family') drawFamilyRank();
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
