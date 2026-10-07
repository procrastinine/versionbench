// Source tooltips, coincident release groups, keyboard focus, and chart highlights.
export function createChartPoints(app) {
  const { state } = app;
  const { tooltip } = app.dom;
  const { esc, statusLabel, sourceLink, weightsLink, familyStyle, score } = app.format;
  const { releaseMap } = app.catalog;

  function bindReleasePoints(container) {
    container.querySelectorAll('[data-point-ids]').forEach((point) => {
      point.addEventListener('pointerenter', (event) => {
        if (!state.pinnedPoint) showPointTooltip(point, event, false);
      });
      point.addEventListener('pointermove', (event) => {
        if (!state.pinnedPoint) positionTooltip(event.clientX, event.clientY);
      });
      point.addEventListener('pointerleave', () => {
        if (!state.pinnedPoint) {
          closeTooltip(false);
          highlightFamilies([]);
        }
      });
      point.addEventListener('focus', () => {
        if (!state.pinnedPoint && !state.suppressPointFocus) showPointTooltip(point, null, false);
      });
      point.addEventListener('blur', () => {
        if (!state.pinnedPoint) {
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
    if (state.timelineGesture) return;
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
                      <span class="swatch" style="${familyStyle(item.familyInfo)}"></span>${pinned
                        ? sourceLink(item, `${esc(item.name)} ↗`)
                        : /* HTML */ `<span>${esc(item.name)}</span>`}
                      ${pinned ? weightsLink(item, 'HF ↗') : ''}
                    </div>`,
                )
                .join('')}
            </div>
            <p>
              ${pinned
                ? 'Release links open the dated evidence; HF links open model weights.'
                : 'Click or press Enter to choose a release source.'}
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
    if (pinned) state.pinnedPoint = point;
    highlightFamilies(point.dataset.pointFamilies.split(','));
    const rect = point.getBoundingClientRect();
    positionTooltip(event?.clientX || rect.left + rect.width / 2, event?.clientY || rect.bottom);
    if (pinned) {
      tooltip.querySelector('.tip-close').addEventListener('click', () => closeTooltip(true));
      tooltip.querySelector('a,button')?.focus();
    }
  }

  function closeTooltip(restoreFocus = false) {
    const trigger = state.pinnedPoint;
    state.pinnedPoint = null;
    tooltip.hidden = true;
    tooltip.classList.remove('pinned');
    highlightFamilies([]);
    if (restoreFocus && trigger?.isConnected) {
      state.suppressPointFocus = true;
      trigger.focus({ preventScroll: true });
      state.suppressPointFocus = false;
    }
  }

  return { bindReleasePoints, highlightFamilies, closeTooltip };
}
