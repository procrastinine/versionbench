// Search, filter, sort, and render the release index and shared family tables.
export function createReleaseIndex(app) {
  const { state } = app;
  const { main } = app.dom;
  const { esc, optionValue, filterControl, matchesFilters } = app.format;
  const { familyStats, families, familyMap, releases, weightsOptions, statusOptions, kindOptions } =
    app.catalog;
  const { routeHref, compareHref } = app.router;
  const { head, note, releaseTable } = app.ui;

  function filteredReleases() {
    const query = state.indexPrefs.query.trim().toLocaleLowerCase();
    const list = releases.filter(
      (release) =>
        (state.indexPrefs.family === 'all' || release.family === state.indexPrefs.family) &&
        matchesFilters(release, state.indexPrefs) &&
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
    const direction = state.indexPrefs.direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const comparison =
        state.indexPrefs.sort === 'score'
          ? (a.score ?? -Infinity) - (b.score ?? -Infinity)
          : String(a[state.indexPrefs.sort] || '').localeCompare(
              String(b[state.indexPrefs.sort] || ''),
            );
      return comparison * direction || a.name.localeCompare(b.name);
    });
  }

  function indexHref() {
    const inFamily = state.currentRoute?.page === 'family';
    return routeHref(inFamily ? 'family' : 'releases', {
      id: inFamily ? state.indexPrefs.family : undefined,
      q: state.indexPrefs.query || undefined,
      family: inFamily || state.indexPrefs.family === 'all' ? undefined : state.indexPrefs.family,
      sort: state.indexPrefs.sort,
      direction: state.indexPrefs.direction,
      weights: state.indexPrefs.weights === 'all' ? undefined : state.indexPrefs.weights,
      status: state.indexPrefs.status === 'all' ? undefined : state.indexPrefs.status,
      kind: inFamily || state.indexPrefs.kind === 'model' ? undefined : state.indexPrefs.kind,
    });
  }

  function readIndexPrefs(params, family = null) {
    state.indexPrefs = {
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
                value="${esc(state.indexPrefs.query)}"
              /><label class="sr-only" for="release-family">Filter by model family</label
              ><select id="release-family">
                <option value="all">All families</option>
                ${families
                  .map(
                    (family) =>
                      /* HTML */ `<option
                        value="${esc(family.id)}"
                        ${state.indexPrefs.family === family.id ? 'selected' : ''}
                      >
                        ${esc(family.name)}
                      </option>`,
                  )
                  .join('')}
              </select>
              ${filterControl(
                'release-weights',
                'Weights',
                weightsOptions,
                state.indexPrefs.weights,
              )}
              ${filterControl(
                'release-status',
                'Release status',
                statusOptions,
                state.indexPrefs.status,
              )}
              ${filterControl('release-kind', 'Category', kindOptions, state.indexPrefs.kind)}
            </div>
            <span id="release-count" class="index-count" aria-live="polite"></span>
          </div>
          <div id="release-table" class="table-wrap"></div>
          <div class="panel-foot">
            <span
              >Dates identify announcements, API access, weights releases, research, or explicitly
              labeled checkpoint date evidence.</span
            ><a href="${compareHref()}" data-compare-link
              >Compare selected (${state.compareIds.length}) →</a
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
      `${list.length} of ${state.currentRoute?.page === 'family' ? familyStats.get(state.indexPrefs.family).releaseCount : releases.filter((release) => state.indexPrefs.kind === 'all' || release.familyInfo.kind === state.indexPrefs.kind).length} releases`;
  }

  return { filteredReleases, indexHref, readIndexPrefs, updateReleaseTable, renderReleases };
}
