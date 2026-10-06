# VersionBench

An extremely scientific LLM benchmark: bigger version number wins.

Rank model families by numeric version, explore their release history, and follow links to announcements, Artificial Analysis profiles, and available Hugging Face weights. Each family's score shows the first recorded release at its highest version. Equal versions share a rank.

[Live demo](https://procrastinine.github.io/versionbench/) · [Data documentation](data/README.md) · [Generated statistics](data/stats.json)

{{STATS_SUMMARY}}

## Run locally

Open **index.html** in a browser. Everything is embedded in one file and works offline, with no installation or background network requests.

Browse the leaderboard, zoom and filter the timeline, compare releases, or search the release index. Comparisons and timeline views support shareable URLs; tables export as CSV.

## Generate

Edit `data/releases.json`, the dashboard in `src/`, or the README templates in `docs/templates/`, then run:

```sh
node scripts/generate.mjs
```

This generates the final READMEs, catalog statistics, standalone HTML, CSV tables, and SQLite database, then validates them. It requires a Node.js version with `node:sqlite`. All numbers come from the release data.

To check official provider sources and external catalogs for missing versions and date differences:

```sh
node scripts/audit-releases.mjs
```

Review `output/release-audit.json` against primary sources before updating the catalog. See the [data documentation](data/README.md) for source and version conventions.

Run `node scripts/audit-weights.mjs` to recheck linked Hugging Face repositories and collections for checkpoint files. Both audits read external metadata without importing it into the catalog.

## Hosting

Host `index.html` on any static web server. The included [GitHub Pages workflow](.github/workflows/pages.yml) generates, checks, and deploys the page when enabled for the repository.
