// Family rankings and cards, preserving complete ties at display limits.
export function createLeaderboard(app) {
  const { state } = app;
  const { main } = app.dom;
  const {
    esc,
    takeWithTies,
    statusLabel,
    sourceLink,
    analysisLink,
    weightsLabel,
    weightsLink,
    familyStyle,
    mark,
    score,
  } = app.format;
  const { stats, families, ranked, rankMap } = app.catalog;
  const { routeHref, compareHref, familyHref, familyLink, timelineHref } = app.router;
  const { head, note, selectionCheckbox } = app.ui;

  function renderLeaderboard() {
    const list = ranked.filter(
      (release) => state.leaderboardScope === 'all' || release.familyInfo.core,
    );
    const chartList = takeWithTies(list, 10);
    const ceiling = Math.max(1, Math.ceil(list[0]?.score || 1));
    main.innerHTML =
      head(
        'VERSIONBENCH / LEADERBOARD',
        'Version Benchmark Leaderboard',
        'No training-data contamination, no judge bias, no prompt sensitivity, no sampling variance, no benchmark saturation, no data leakage, 100% reproducible.<span class="benchmark-definition">Benchmark score = numeric release version.</span>',
      ) +
      /* HTML */ `<div class="stats leaderboard-cards">
          ${takeWithTies(ranked, 3)
            .map(
              (release) =>
                /* HTML */ `<article class="stat" style="${familyStyle(release.familyInfo)}">
                  <div class="stat-top">
                    <span>Benchmark score</span
                    ><span class="rank-tag">#${rankMap.get(release.family)}</span>
                  </div>
                  <div class="stat-main">
                    <div>
                      <div class="stat-name">${familyLink(release.familyInfo)}</div>
                      <div class="stat-provider">${esc(release.familyInfo.provider)}</div>
                    </div>
                    <div class="stat-score">${score(release)}</div>
                  </div>
                  <div class="stat-bottom">
                    <span>${esc(release.name)}</span><span aria-hidden="true">·</span>${sourceLink(
                      release,
                    )}
                    ${analysisLink(release, 'AA ↗')} ${weightsLink(release, 'HF ↗')}
                  </div>
                </article>`,
            )
            .join('')}
        </div>
        <div class="dashboard-grid">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Overall rankings</h2>
                <p>Highest benchmark score per family</p>
              </div>
              <div class="segments" aria-label="Leaderboard scope">
                <button
                  data-leaderboard-scope="all"
                  class="${state.leaderboardScope === 'all' ? 'active' : ''}"
                  aria-pressed="${state.leaderboardScope === 'all'}"
                >
                  All families</button
                ><button
                  data-leaderboard-scope="core"
                  class="${state.leaderboardScope === 'core' ? 'active' : ''}"
                  aria-pressed="${state.leaderboardScope === 'core'}"
                >
                  Core 10
                </button>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <caption class="sr-only">
                  Language model families ranked by their highest numeric version
                </caption>
                <thead>
                  <tr>
                    <th><span class="sr-only">Compare</span></th>
                    <th>Rank</th>
                    <th>Family</th>
                    <th>Score</th>
                    <th class="date-col">Date</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  ${list
                    .map((release) => {
                      const tied =
                        ranked.filter((other) => other.score === release.score).length > 1;
                      return /* HTML */ `<tr>
                        <td class="select-cell">${selectionCheckbox(release)}</td>
                        <td class="rank-cell" title="${tied ? 'Shared rank' : 'Rank'}">
                          ${tied ? '=' : ''}${rankMap.get(release.family)}
                        </td>
                        <td>
                          <div class="family-cell">
                            ${mark(release.familyInfo)}
                            <div>
                              <div class="family-name">${familyLink(release.familyInfo)}</div>
                              <div class="table-sub">
                                ${esc(release.name)}
                                <span class="availability-label"
                                  >${esc(statusLabel(release.status))}</span
                                >
                              </div>
                              <div
                                class="table-sub"
                                data-weights-status="${esc(release.weightsStatus)}"
                              >
                                ${weightsLabel(release)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td class="score-cell">${score(release)}</td>
                        <td class="date-cell date-col">${esc(release.date || 'Undated')}</td>
                        <td class="source-link">
                          ${sourceLink(
                            release,
                            '↗',
                            `aria-label="Open release source for ${esc(release.name)}"`,
                          )}
                          ${analysisLink(release, 'AA ↗')} ${weightsLink(release, 'HF ↗')}
                        </td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
            <div class="panel-foot">
              <span>${list.length} families · Equal versions share a rank</span
              ><a href="${compareHref()}" data-compare-link
                >Compare selected (${state.compareIds.length}) →</a
              >
            </div>
          </section>
          <div>
            <section class="panel chart-card">
              <div class="panel-head">
                <div>
                  <h2>Version Benchmark by family</h2>
                  <p>Top ${chartList.length} families · Higher score ranks first</p>
                </div>
                <span class="mini-label">SCORE</span>
              </div>
              <div class="bars">
                ${chartList
                  .map(
                    (release) =>
                      /* HTML */ `<div class="bar-row" style="${familyStyle(release.familyInfo)}">
                        <a
                          class="bar-name"
                          href="${familyHref(release.family)}"
                          title="${esc(release.familyInfo.name)} release history and statistics"
                          >${esc(release.familyInfo.name)}</a
                        >
                        <div class="bar-track">
                          <div
                            class="bar-fill"
                            style="width:${(release.score / ceiling) * 100}%"
                          ></div>
                        </div>
                        <span class="bar-score">${score(release)}</span>
                      </div>`,
                  )
                  .join('')}
                <div class="axis-line" style="grid-template-columns:repeat(${ceiling + 1},1fr)">
                  ${Array.from(
                    { length: ceiling + 1 },
                    (_, index) => /* HTML */ `<span>${index}</span>`,
                  ).join('')}
                </div>
              </div>
              <div class="panel-foot">
                <span>Zero baseline · Raw version numbers</span
                ><a href="${compareHref()}">Build comparison →</a>
              </div>
            </section>
            <section class="panel subsection">
              <a class="link-card" href="${timelineHref(state.timelinePrefs)}"
                ><svg viewBox="0 0 64 36" aria-hidden="true">
                  <path d="M2 32H62M2 2V32" fill="none" stroke="#dce3ef" />
                  <path
                    d="M3 29H13V24H27V16H42V10H60V4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle cx="42" cy="10" r="3" fill="currentColor" />
                </svg>
                <div>
                  <h3>Explore the release timeline</h3>
                  <p>Trace model versions across time, with direct release sources.</p>
                </div>
                <span aria-hidden="true" style="margin-left:auto">→</span></a
              >
            </section>
            ${note()}
            <div class="metric-counts">
              <span><strong>${stats.familyCount}</strong> model families</span
              ><span><strong>${stats.releaseCount}</strong> model releases</span
              ><span><strong>${stats.sourceCount}</strong> model sources</span>
            </div>
            <p class="note">
              ${stats.softwareControlCount} software controls are available in the
              <a
                href="${routeHref('timeline', {
                  families: families
                    .filter((family) => family.kind === 'software')
                    .map((family) => family.id)
                    .join(','),
                  mode: 'latest',
                })}"
                >expanded dataset</a
              >. They have no vote in these rankings.
            </p>
          </div>
        </div>`;
  }

  return { renderLeaderboard };
}
