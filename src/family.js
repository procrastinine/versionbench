// Family statistics, source watchlists, and version/rank history charts.
export function createFamilyPage(app) {
  const { state } = app;
  const { main } = app.dom;
  const {
    esc,
    parseDate,
    day,
    numberLabel,
    calculatedLabel,
    filterControl,
    sourceLink,
    analysisLink,
    weightsLink,
    familyStyle,
    score,
    dateTicks,
  } = app.format;
  const {
    stats,
    pending,
    watchlist,
    familyStats,
    familyMap,
    releaseMap,
    datedReleases,
    weightsOptions,
    statusOptions,
  } = app.catalog;
  const { routeHref, compareHref } = app.router;
  const { head } = app.ui;
  const { bindReleasePoints } = app.points;
  const { readIndexPrefs, updateReleaseTable } = app.releases;

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
          <label class="sr-only" for="release-search">Search this family's releases</label><input class="search-input" id="release-search" type="search" placeholder="Search this family…" value="${esc(state.indexPrefs.query)}" />
          ${filterControl('release-weights', 'Weights', weightsOptions, state.indexPrefs.weights)}
          ${filterControl('release-status', 'Release status', statusOptions, state.indexPrefs.status)}
        </div><span id="release-count" class="index-count" aria-live="polite"></span></div>
        <div id="release-table" class="table-wrap"></div>
        <div class="panel-foot"><span>First recorded release does not imply first-ever release.</span><a href="${compareHref()}" data-compare-link>Compare selected (${state.compareIds.length}) →</a></div></section>` +
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
      ${versionTicks.map((value) => `<text x="${right + 12}" y="${yVersion(value) + 4}" text-anchor="start">${calculatedLabel(value)}</text>`).join('')}
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

  return { drawFamilyRank, renderFamily };
}
