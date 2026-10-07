// Shareable hash URLs, page dispatch, navigation focus, and history restoration.
export function createRouter(app) {
  const { state } = app;
  const { main } = app.dom;
  const { esc } = app.format;
  const { releaseMap } = app.catalog;

  const routeHref = (page, params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) search.set(key, value);
    });
    return `#${page}${search.size ? `?${search}` : ''}`;
  };

  const compareHref = (ids = state.compareIds, order = state.compareOrder) =>
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

  function renderRoute() {
    app.timelineNavigation.cancelTimelineGesture();
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
    const samePage = pageKey === state.previousPage;
    app.points.closeTooltip(false);
    state.currentRoute = { page, params };
    if (page === 'leaderboard') app.leaderboard.renderLeaderboard();
    if (page === 'timeline') app.timeline.renderTimeline(params);
    if (page === 'compare') app.comparison.renderCompare(params);
    if (page === 'releases') app.releases.renderReleases(params);
    if (page === 'family') app.family.renderFamily(params);
    if (page === 'methodology') app.methodology.renderMethodology();
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const title = main.querySelector('h1')?.textContent || 'Version Benchmark';
    document.title = `${title} — VersionBench`;
    app.ui.updateSelectionUI();
    if (samePage && focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    else if (state.previousPage && !samePage) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
    state.previousPage = pageKey;
  }

  return {
    routeHref,
    compareHref,
    familyHref,
    familyLink,
    timelineHref,
    uniqueValidIds,
    navigate,
    renderRoute,
  };
}
