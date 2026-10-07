// Timeline preferences, family selectors, and page layout.
export function createTimeline(app) {
  const { state } = app;
  const { main } = app.dom;
  const { esc, parseDate, isoDate, optionValue, filterControl, familyStyle, score } = app.format;
  const {
    families,
    familyMap,
    latestTime,
    highestMap,
    weightsOptions,
    statusOptions,
    kindOptions,
    modeOptions,
  } = app.catalog;
  const { familyLink, timelineHref } = app.router;
  const { head } = app.ui;
  const { timelineStartTime, normalizeTimelineWindow, syncTimelineControls, bindTimelineGestures } =
    app.timelineNavigation;
  const { drawTimeline } = app.timelineChart;

  function timelineState(params) {
    const familyIds = params.has('families')
      ? [...new Set(params.get('families').split(','))].filter((id) => familyMap.has(id))
      : state.timelinePrefs.familyIds;
    const explicit = params.size > 0;
    const fallback = (key, value) => (explicit ? value : state.timelinePrefs[key]);
    state.timelinePrefs = {
      ...state.timelinePrefs,
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
      state.timelinePrefs.range === 'all'
        ? earliest
        : Number.isFinite(parseDate(params.get('from')))
          ? parseDate(params.get('from'))
          : parseDate(state.timelinePrefs.from);
    const to =
      state.timelinePrefs.range === 'all'
        ? latestTime
        : Number.isFinite(parseDate(params.get('to')))
          ? parseDate(params.get('to'))
          : parseDate(state.timelinePrefs.to);
    const bounds = normalizeTimelineWindow(
      from <= to ? from : earliest,
      from <= to ? to : latestTime,
      true,
    );
    state.timelinePrefs.from = isoDate(bounds.start);
    state.timelinePrefs.to = isoDate(bounds.end);
  }

  function renderTimeline(params) {
    timelineState(params);
    // Canonical dates make Back restore the view even when entered through #timeline.
    history.replaceState(null, '', timelineHref(state.timelinePrefs));
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
                ${state.timelinePrefs.familyIds.includes(family.id) ? 'checked' : ''}
              /><span class="swatch" style="${familyStyle(family)}"></span>${familyLink(
                family,
                'family-control-link',
              )}
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
              >${state.timelinePrefs.familyIds.length}/${families.length}</span
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
              ${filterControl('timeline-mode', 'Line shows', modeOptions, state.timelinePrefs.mode)}
              ${filterControl(
                'timeline-weights',
                'Weights',
                weightsOptions,
                state.timelinePrefs.weights,
              )}
              ${filterControl('timeline-kind', 'Category', kindOptions, state.timelinePrefs.kind)}
              ${filterControl(
                'timeline-status',
                'Release status',
                statusOptions,
                state.timelinePrefs.status,
              )}
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
                        class="${state.timelinePrefs.range === value ? 'active' : ''}"
                        aria-pressed="${state.timelinePrefs.range === value}"
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
                  value="${esc(state.timelinePrefs.from)}"
                /><label for="date-to">To</label
                ><input
                  id="date-to"
                  type="date"
                  min="${isoDate(timelineStartTime())}"
                  max="${isoDate(latestTime)}"
                  value="${esc(state.timelinePrefs.to)}"
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
                ${state.timelinePrefs.mode === 'latest'
                  ? 'latest matching release; same-day ties use the highest score.'
                  : 'highest matching score to date.'}
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
            ${state.timelinePrefs.mode === 'latest'
              ? 'Lower numbers produce lower lines. The graph regrets nothing.'
              : 'Switch to “Latest release” to observe numeric regressions.'}
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

  return { renderTimeline };
}
