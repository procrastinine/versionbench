// Render timeline steps, release points, and the matching release table.
export function createTimelineChart(app) {
  const { state } = app;

  const { esc, parseDate, day, dateLabel, score, dateTicks } = app.format;
  const { familyMap } = app.catalog;
  const { releaseTable } = app.ui;
  const { bindReleasePoints, closeTooltip } = app.points;
  const { timelineReleases } = app.timelineNavigation;

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
    const start = parseDate(state.timelinePrefs.from);
    const end = parseDate(state.timelinePrefs.to);
    const actualEnd = end === start ? end + day : end;
    const familySet = new Set(state.timelinePrefs.familyIds);
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
    const steps = state.timelinePrefs.familyIds
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
              state.timelinePrefs.mode === 'latest'
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
            (state.timelinePrefs.mode === 'latest' || release.score > high)
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
            fill="${group.length > 1
              ? group[group.length - 1].familyInfo.color
              : release.familyInfo.color}"
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
        ${state.timelinePrefs.mode === 'latest'
          ? 'latest matching release'
          : 'highest matching score to date'}.
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
      ${!visible.length
        ? /* HTML */ `<text
            x="${pad.left + chartWidth / 2}"
            y="${height / 2}"
            text-anchor="middle"
            style="font-family:inherit;font-size:14px"
            >${familySet.size
              ? 'No releases match these filters and dates'
              : 'Select a family to explore releases'}</text
          >`
        : ''}
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

  return { drawTimeline };
}
