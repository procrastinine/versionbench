// Comparison view, bar chart, model picker, and share links.
export function createComparison(app) {
  const { state } = app;
  const { main, dialog } = app.dom;
  const { esc, dateLabel, numberLabel, spreadLabel, takeWithTies, familyStyle, score } = app.format;
  const { families, releases, familyPeaks, ranked } = app.catalog;
  const { compareHref, uniqueValidIds } = app.router;
  const { head, note, toast, selectedReleases, releaseTable } = app.ui;

  function renderCompare(params) {
    if (params.has('models')) state.compareIds = uniqueValidIds(params.get('models').split(','));
    state.compareOrder = params.get('order') === 'selection' ? 'selection' : 'score';
    const selected = selectedReleases();
    const list =
      state.compareOrder === 'score'
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
              ${selected.length
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
                : '<span class="chart-hint">No models selected</span>'}
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
          ${list.length
            ? /* HTML */ `<div class="comparison-heading">
                  <div>
                    <h2>Benchmark score</h2>
                    <p>Raw version numbers · Zero baseline</p>
                  </div>
                  <label class="compare-sort"
                    ><span class="sr-only">Bar order</span
                    ><select id="compare-order">
                      <option value="score" ${state.compareOrder === 'score' ? 'selected' : ''}>
                        Highest score first
                      </option>
                      <option
                        value="selection"
                        ${state.compareOrder === 'selection' ? 'selected' : ''}
                      >
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
              </div>`}
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
              <span>Score spread</span><strong>${spreadLabel(max, min)}</strong>
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

  function openPicker() {
    state.draftIds = new Set(state.compareIds);
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
                          ${state.draftIds.has(release.id) ? 'checked' : ''}
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
      `${state.draftIds.size} selected · ${choices.length} shown`;
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

  return { drawComparison, openPicker, renderPicker, copyLink, renderCompare };
}
