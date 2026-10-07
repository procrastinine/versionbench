// Shared page components, selection controls, source details, and CSV downloads.
export function createUI(app) {
  const { state } = app;
  const {
    esc,
    dateLabel,
    statusLabel,
    external,
    sourceLink,
    analysisLink,
    weightsLabel,
    weightsLink,
    familyStyle,
    score,
  } = app.format;
  const { releaseMap, latestDate } = app.catalog;
  const { compareHref, familyHref } = app.router;

  const selectedReleases = () => state.compareIds.map((id) => releaseMap.get(id)).filter(Boolean);

  const head = (eyebrow, title, description, actions = '') =>
    /* HTML */ `<div class="page-head">
      <div>
        <span class="eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${actions ||
      /* HTML */ `<div class="snapshot">
        CURATED SNAPSHOT<strong>${esc(dateLabel(latestDate))}</strong>
      </div>`}
    </div>`;

  const note = () =>
    /* HTML */ `<p class="note">
      <strong>Number responsibly.</strong> VersionBench obeys mathematics, not semantic versioning.
      Thus 3.9 &gt; 3.10. A larger number is a larger number.
      <a href="#methodology">Read the methodology ↗</a>
    </p>`;

  const toast = (message) => {
    document.querySelector('.toast')?.remove();
    clearTimeout(state.toastTimer);
    const element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    element.textContent = message;
    document.body.append(element);
    state.toastTimer = setTimeout(() => element.remove(), 3200);
  };

  const updateSelectionUI = () => {
    document.getElementById('nav-count').textContent = state.compareIds.length;
    document.querySelector('[data-nav="compare"]').href = compareHref();
    document.querySelectorAll('[data-compare-link]').forEach((link) => {
      link.href = compareHref();
      link.textContent = `Compare selected (${state.compareIds.length}) →`;
    });
    document.querySelectorAll('[data-select-release]').forEach((input) => {
      input.checked = state.compareIds.includes(input.dataset.selectRelease);
    });
  };

  const selectionCheckbox = (release) =>
    /* HTML */ `<input
      type="checkbox"
      data-select-release="${esc(release.id)}"
      aria-label="Select ${esc(release.name)} for comparison"
      ${state.compareIds.includes(release.id) ? 'checked' : ''}
    />`;

  function sourceDetails(release) {
    const items = [];
    if (release.source)
      items.push(
        /* HTML */ `<div class="source-title">
            ${sourceLink(release, `${esc(release.source.title)} ↗`)}
          </div>
          <div class="table-sub">
            ${esc(release.source.publisher || release.familyInfo.provider)}${release.source.date
              ? ` · ${esc(release.source.date)}`
              : ''}
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
          ${release.weightsNote
            ? /* HTML */ `<p>
                <strong>Weights:</strong> ${esc(release.weightsNote)}
                ${release.weightsSourceUrl ? external(release.weightsSourceUrl, 'Evidence ↗') : ''}
              </p>`
            : ''}
          ${release.note ? /* HTML */ `<p>${esc(release.note)}</p>` : ''}${release.mapping
            ? /* HTML */ `<p><strong>Version mapping:</strong> ${esc(release.mapping)}</p>`
            : ''}${release.dateSource
            ? /* HTML */ `<p>
                <strong>Date evidence:</strong> ${external(
                  release.dateSource.url,
                  `${esc(release.dateSource.title)} ↗`,
                )}
              </p>`
            : ''}
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
            aria-pressed="${state.indexPrefs.sort === key}"
          >
            ${title}${state.indexPrefs.sort === key
              ? state.indexPrefs.direction === 'desc'
                ? ' ↓'
                : ' ↑'
              : ''}
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
        ${list.length
          ? list
              .map(
                (release) =>
                  /* HTML */ `<tr>
                    ${selectable
                      ? /* HTML */ `<td class="select-cell">${selectionCheckbox(release)}</td>`
                      : ''}
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
            </tr>`}
      </tbody>
    </table>`;
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

  return {
    head,
    note,
    toast,
    selectedReleases,
    updateSelectionUI,
    selectionCheckbox,
    releaseTable,
    exportCSV,
  };
}
