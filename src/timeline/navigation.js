// Timeline windows, filters, zoom, pan, and gesture history.
export function createTimelineNavigation(app) {
  const { state } = app;
  const { parseDate, day, isoDate, dateLabel, minimumTimelineSpan, matchesFilters } = app.format;
  const { datedReleases, latestTime, modelStartTime } = app.catalog;
  const { timelineHref } = app.router;
  const { closeTooltip } = app.points;

  const timelineReleases = () =>
    datedReleases.filter(
      (release) =>
        state.timelinePrefs.familyIds.includes(release.family) &&
        matchesFilters(release, state.timelinePrefs),
    );
  // Unselected software must not stretch a model-only view back to 2008.

  const timelineStartTime = () => {
    const selected = timelineReleases();
    return Math.min(
      latestTime - minimumTimelineSpan,
      ...(selected.length ? selected.map((release) => release.time) : [modelStartTime]),
    );
  };

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
    const start = parseDate(state.timelinePrefs.from);
    const end = parseDate(state.timelinePrefs.to);
    const span = end - start;
    const fromInput = document.getElementById('date-from');
    const toInput = document.getElementById('date-to');
    if (fromInput) fromInput.value = state.timelinePrefs.from;
    if (toInput) toInput.value = state.timelinePrefs.to;
    document.querySelectorAll('[data-range]').forEach((button) => {
      const active = button.dataset.range === state.timelinePrefs.range;
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
        status.textContent = `${dateLabel(state.timelinePrefs.from)} to ${dateLabel(state.timelinePrefs.to)}. ${Math.round(span / day)} days in view.`;
    }
  }

  function beginTimelineGesture(kind) {
    if (state.timelineGesture && state.timelineGesture.kind !== kind) commitTimelineGesture();
    if (!state.timelineGesture) {
      state.timelineGesture = {
        kind,
        start: parseDate(state.timelinePrefs.from),
        end: parseDate(state.timelinePrefs.to),
        dirty: false,
      };
      closeTooltip(false);
    }
    return state.timelineGesture;
  }

  function requestTimelineDraw() {
    if (!state.timelineDrawFrame)
      state.timelineDrawFrame = requestAnimationFrame(() => {
        state.timelineDrawFrame = null;
        if (state.currentRoute?.page === 'timeline') app.timelineChart.drawTimeline(false);
      });
  }

  function applyTimelineWindow(start, end) {
    const continuous = normalizeTimelineWindow(start, end);
    if (state.timelineGesture) Object.assign(state.timelineGesture, continuous);
    const view = normalizeTimelineWindow(continuous.start, continuous.end, true);
    const from = isoDate(view.start);
    const to = isoDate(view.end);
    if (from === state.timelinePrefs.from && to === state.timelinePrefs.to) return;
    if (state.timelineGesture) state.timelineGesture.dirty = true;
    state.timelinePrefs = { ...state.timelinePrefs, from, to, range: 'custom' };
    syncTimelineControls();
    requestTimelineDraw();
  }

  function commitTimelineGesture(redraw = true) {
    clearTimeout(state.timelineGestureTimer);
    const gesture = state.timelineGesture;
    state.timelineGesture = null;
    if (state.timelineDrawFrame) {
      cancelAnimationFrame(state.timelineDrawFrame);
      state.timelineDrawFrame = null;
    }
    if (!gesture || state.currentRoute?.page !== 'timeline') return;
    if (gesture.dirty) {
      const hash = timelineHref(state.timelinePrefs);
      if (location.hash !== hash) history.pushState(null, '', hash);
      state.currentRoute.params = new URLSearchParams(hash.split('?')[1] || '');
      if (redraw) app.timelineChart.drawTimeline();
      syncTimelineControls(true);
    }
  }

  function cancelTimelineGesture() {
    clearTimeout(state.timelineGestureTimer);
    if (state.timelineDrawFrame) cancelAnimationFrame(state.timelineDrawFrame);
    state.timelineDrawFrame = null;
    state.timelineGesture = null;
    state.timelineDrag = null;
    document.getElementById('timeline-chart')?.classList.remove('is-panning');
  }

  function deferTimelineCommit() {
    clearTimeout(state.timelineGestureTimer);
    state.timelineGestureTimer = setTimeout(commitTimelineGesture, 240);
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
    state.timelinePrefs.range = 'all';
    // Reset also makes a custom full-width view report the All time preset.
    if (state.timelineGesture)
      state.timelineGesture.dirty = location.hash !== timelineHref(state.timelinePrefs);
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
      if (!state.timelineDrag || event.pointerId !== state.timelineDrag.pointerId) return;
      const pointerId = state.timelineDrag.pointerId;
      if (state.timelineDrag.moved) ignoreClickUntil = performance.now() + 350;
      state.timelineDrag = null;
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
      state.timelineDrag = {
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
      if (!state.timelineDrag || event.pointerId !== state.timelineDrag.pointerId) return;
      const delta = event.clientX - state.timelineDrag.x;
      if (!state.timelineDrag.moved && Math.abs(delta) < 4) return;
      state.timelineDrag.moved = true;
      const offset =
        (-delta / state.timelineDrag.width) * (state.timelineDrag.end - state.timelineDrag.start);
      applyTimelineWindow(state.timelineDrag.start + offset, state.timelineDrag.end + offset);
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
        if (state.timelineDrag || nativePinch) return;
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
        clearTimeout(state.timelineGestureTimer);
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

  return {
    timelineReleases,
    timelineStartTime,
    normalizeTimelineWindow,
    syncTimelineControls,
    commitTimelineGesture,
    zoomTimeline,
    resetTimelineView,
    bindTimelineGestures,
    cancelTimelineGesture,
  };
}
