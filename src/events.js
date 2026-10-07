// Delegated page events and persistent shell controls. Bound once at startup.
export function bindEvents(app) {
  const { state } = app;
  const { main, tooltip, dialog } = app.dom;
  const { parseDate, isoDate, dateLabel } = app.format;
  const { families, familyMap, latestDate, latestTime, coreIds } = app.catalog;
  const { compareHref, timelineHref, uniqueValidIds, navigate, renderRoute } = app.router;
  const { selectedReleases, updateSelectionUI, exportCSV } = app.ui;
  const { highlightFamilies, closeTooltip } = app.points;
  const {
    timelineReleases,
    timelineStartTime,
    normalizeTimelineWindow,
    commitTimelineGesture,
    zoomTimeline,
    resetTimelineView,
  } = app.timelineNavigation;
  const { drawTimeline } = app.timelineChart;
  const { filteredReleases, indexHref, updateReleaseTable } = app.releases;
  const { drawFamilyRank } = app.family;
  const { drawComparison, openPicker, renderPicker, copyLink } = app.comparison;
  const { renderLeaderboard } = app.leaderboard;

  main.addEventListener('click', (event) => {
    const target = event.target.closest('button,a');
    if (!target) return;
    if (target.matches('[data-open-picker]')) openPicker();
    if (target.matches('[data-copy-link]')) copyLink();
    if (target.matches('[data-remove-release]'))
      navigate(compareHref(state.compareIds.filter((id) => id !== target.dataset.removeRelease)));
    if (target.matches('[data-clear-comparison]')) navigate(compareHref([]));
    if (target.matches('[data-export-releases]'))
      exportCSV(
        filteredReleases(),
        state.currentRoute?.page === 'family'
          ? `versionbench-${state.indexPrefs.family}.csv`
          : 'versionbench-releases.csv',
      );
    if (target.matches('[data-export-timeline]'))
      exportCSV(
        timelineReleases()
          .filter(
            (release) =>
              release.date >= state.timelinePrefs.from && release.date <= state.timelinePrefs.to,
          )
          .sort((a, b) => b.time - a.time || b.score - a.score),
        'versionbench-timeline.csv',
      );
    if (target.matches('[data-export-comparison]'))
      exportCSV(selectedReleases(), 'versionbench-comparison.csv');
    if (target.matches('[data-leaderboard-scope]')) {
      state.leaderboardScope = target.dataset.leaderboardScope;
      renderLeaderboard();
      updateSelectionUI();
    }
    if (target.matches('[data-family-set]')) {
      const set = target.dataset.familySet;
      state.timelinePrefs.familyIds =
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
        Object.assign(state.timelinePrefs, {
          mode: 'latest',
          kind: 'all',
          weights: 'all',
          status: 'all',
          range: 'all',
        });
      if (set === 'core' || set === 'models') state.timelinePrefs.kind = 'all';
      navigate(timelineHref(state.timelinePrefs));
    }
    if (target.matches('[data-only-family]')) {
      state.timelinePrefs.familyIds = [target.dataset.onlyFamily];
      navigate(timelineHref(state.timelinePrefs));
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
      state.timelinePrefs = {
        ...state.timelinePrefs,
        from: isoDate(start.getTime()),
        to: isoDate(end.getTime()),
        range,
      };
      navigate(timelineHref(state.timelinePrefs));
    }
    if (target.matches('[data-index-sort]')) {
      const sort = target.dataset.indexSort;
      state.indexPrefs.direction =
        state.indexPrefs.sort === sort && state.indexPrefs.direction === 'desc' ? 'asc' : 'desc';
      state.indexPrefs.sort = sort;
      history.replaceState(null, '', indexHref());
      updateReleaseTable();
    }
  });

  main.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-select-release]')) {
      state.compareIds = target.checked
        ? uniqueValidIds([...state.compareIds, target.dataset.selectRelease])
        : state.compareIds.filter((id) => id !== target.dataset.selectRelease);
      updateSelectionUI();
    }
    if (target.matches('[data-family]')) {
      state.timelinePrefs.familyIds = target.checked
        ? [...state.timelinePrefs.familyIds, target.dataset.family]
        : state.timelinePrefs.familyIds.filter((id) => id !== target.dataset.family);
      navigate(timelineHref(state.timelinePrefs));
    }
    if (target.matches('#timeline-mode,#timeline-weights,#timeline-kind,#timeline-status')) {
      state.timelinePrefs[target.id.replace('timeline-', '')] = target.value;
      navigate(timelineHref(state.timelinePrefs));
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
      state.timelinePrefs = {
        ...state.timelinePrefs,
        from: isoDate(bounds.start),
        to: isoDate(bounds.end),
        range: 'custom',
      };
      navigate(timelineHref(state.timelinePrefs));
    }
    if (target.matches('#compare-order')) {
      state.compareOrder = target.value;
      navigate(compareHref());
    }
    if (target.matches('#release-family,#release-weights,#release-status,#release-kind')) {
      state.indexPrefs[target.id.replace('release-', '')] = target.value;
      if (target.id === 'release-family' && familyMap.has(target.value)) {
        state.indexPrefs.kind = familyMap.get(target.value).kind;
        document.getElementById('release-kind').value = state.indexPrefs.kind;
      }
      if (
        target.id === 'release-kind' &&
        familyMap.has(state.indexPrefs.family) &&
        state.indexPrefs.kind !== 'all' &&
        familyMap.get(state.indexPrefs.family).kind !== state.indexPrefs.kind
      ) {
        state.indexPrefs.family = 'all';
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
      state.indexPrefs.query = event.target.value;
      history.replaceState(null, '', indexHref());
      updateReleaseTable();
    }
  });
  main.addEventListener('pointerover', (event) => {
    const control = event.target.closest('[data-highlight-family]');
    if (control && !state.pinnedPoint) highlightFamilies([control.dataset.highlightFamily]);
  });
  main.addEventListener('pointerout', (event) => {
    const control = event.target.closest('[data-highlight-family]');
    if (control && !control.contains(event.relatedTarget) && !state.pinnedPoint)
      highlightFamilies([]);
  });
  document.getElementById('model-search').addEventListener('input', renderPicker);
  document.getElementById('latest-only').addEventListener('change', renderPicker);
  document.getElementById('close-picker').addEventListener('click', () => dialog.close());
  document.getElementById('picker-clear').addEventListener('click', () => {
    state.draftIds.clear();
    renderPicker();
  });
  document.getElementById('picker-done').addEventListener('click', () => {
    state.compareIds = [...state.draftIds];
    dialog.close();
    navigate(compareHref());
  });
  document.getElementById('picker-list').addEventListener('change', (event) => {
    if (event.target.matches('[data-picker-id]')) {
      const id = event.target.dataset.pickerId;
      event.target.checked ? state.draftIds.add(id) : state.draftIds.delete(id);
      document.getElementById('picker-count').textContent =
        `${state.draftIds.size} selected · ${document.querySelectorAll('[data-picker-id]').length} shown`;
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
    if (
      state.pinnedPoint &&
      !tooltip.contains(event.target) &&
      !state.pinnedPoint.contains(event.target)
    )
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
      if (state.timelineGesture && !event.target.closest('#timeline-chart'))
        commitTimelineGesture();
    },
    true,
  );
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('resize', () => {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => {
      if (state.currentRoute?.page === 'timeline') drawTimeline();
      if (state.currentRoute?.page === 'family') drawFamilyRank();
      if (state.currentRoute?.page === 'compare') {
        const list = selectedReleases();
        drawComparison(
          state.compareOrder === 'score'
            ? list.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
            : list,
        );
      }
    }, 150);
  });
  document.getElementById('footer-date').textContent = `Updated ${dateLabel(latestDate)}`;
}
