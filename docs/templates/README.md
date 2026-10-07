# VersionBench

VersionBench: No training-data contamination, no judge bias, no prompt sensitivity, no sampling variance, no benchmark saturation, no data leakage, 100% reproducible.

VersionBench is a leaderboard that ranks language models by the numeric version in their names. It is also unironically quite a convenient place to look at the release history and announcement pages of LLMs.

VersionBench obeys mathematics, not semantic versioning. Thus 3.9 > 3.10. Vendors are advised to number responsibly. Python, PyTorch, and GTA provide [software controls](https://procrastinine.github.io/versionbench/#timeline?families=python,pytorch,gta&mode=latest) in the expanded dataset.

[Live demo](https://procrastinine.github.io/versionbench/) · [Data documentation](data/README.md) · [Generated statistics](data/stats.json) · [Pages to watch](docs/source-watchlist.md)

{{STATS_SUMMARY}}

[![VersionBench leaderboard with model-family rankings, release links, and a version-number comparison chart.](docs/leaderboard.png)](https://procrastinine.github.io/versionbench/)

## Run locally

Open **index.html** in a browser. Everything is embedded in one file and works offline, with no installation or background network requests.

Click a family for its releases, version/rank graph, historical statistics, and source watchlist. Filter the timeline by family, weights, release status, or model/software type. “Latest release” reveals numeric regressions; “Highest to date” preserves past achievements. Views support shareable URLs and CSV export.

## Generate

Edit `data/releases.json`, the dashboard in `src/`, or the README templates in `docs/templates/`, then run:

```sh
node scripts/generate.mjs
```

This generates both READMEs, all statistics, the standalone HTML, CSV tables, SQLite database, and source/audit documentation from saved repository data only. It never fetches online data. Use Node.js 26.1 or later. `node --test scripts/*.test.mjs` includes a fresh build with network access denied and checks that repeated builds are identical.

To refresh the separate source audit explicitly:

```sh
node scripts/audit-releases.mjs
node scripts/audit-weights.mjs
```

These commands save source responses and review reports under `output/`; they never run during a build or automatically add releases. Both support `--offline` to replay their saved snapshots. See the [data documentation](data/README.md), [earlier-version audit](docs/history-audit.md), and [candidate decisions](docs/pending-releases.md). Quantizations do not get another vote.

## Hosting

Host `index.html` on any static web server. The included [GitHub Pages workflow](.github/workflows/pages.yml) generates, checks, and deploys the page when enabled for the repository.

Licensed under [MIT](LICENSE).
