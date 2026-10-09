# VersionBench release data

{{STATS_SUMMARY}}

## Files

`releases.json` is the editable source of truth. From the repository root, run `node scripts/generate.mjs` to generate the CSV tables, `stats.json`, SQLite database, standalone page, both READMEs, and source/audit documentation. The build uses saved files only, with no online fetching, credentials, packages to install, or audit cache. Use Node.js 26.1 or later. Tests rebuild a fresh copy twice with Node network permission denied and compare every generated artifact.

`provider-sources.json` defines each family's watchlist, publisher accounts, model-name scopes, and discovery patterns. `history-review.json` records earlier-generation reviews. `pending-releases.json` preserves candidates awaiting review; `candidate-resolutions.json` preserves every completed decision and links it to releases and saved observations in `evidence/candidate-review.json`. `discovery-decisions.json` records exact-URL review decisions. `checkpoint-imports.json` is the reviewed repository-to-family/version mapping for the optional checkpoint importer. All are checked in; the generator never refreshes them.

Statistics include counts, coverage dates, releases by year and availability, weight availability and link coverage, and each family's highest version, first recorded release at that version, and historical ranking metrics. `family-stats.csv` contains the family summaries; SQLite includes a `family_stats` table. They are derived entirely from the catalog. Edit the release data to change them, and edit `docs/templates/` to change README prose.

## Schema

| Table    | Fields                              | Meaning                                                                                                |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| families | `id`, `name`, `provider`            | Family identity and originating organization.                                                          |
| families | `color`, `core`                     | Chart color and membership in the default comparison group.                                            |
| families | `kind`, `scope`                     | Model or software control, with optional coverage limits.                                              |
| sources  | `id`, `title`, `url`, `publisher`   | Reusable source record and direct link.                                                                |
| sources  | `date`, `checkedAt`                 | Optional publication date and snapshot verification date.                                              |
| releases | `id`, `family`, `name`              | Event identity, family reference, and published model name.                                            |
| releases | `version`, `score`                  | Version string and its numeric value.                                                                  |
| releases | `date`, `status`, `eventType`       | Event day, display status, and announcement/API/weights/preview/research/release/checkpoint milestone. |
| releases | `dateBasis`                         | `publisher` by default; `checkpoint-commit`, `repository-created`, `documented-by`, `announcement-commit`, or `evaluation-metadata` identify other evidence. |
| releases | `dateRepositoryUrl`                 | Original repository used for checkpoint dating when the current download link points to a surviving mirror. |
| releases | `sourceId`, `dateSourceId`          | Main source and optional additional date evidence.                                                     |
| releases | `artificialAnalysisUrl`             | Optional verified profile for the matching model or checkpoint.                                        |
| releases | `weightsStatus`, `weightsCheckedAt` | Weight availability assessment and date checked.                                                       |
| releases | `huggingFaceUrl`                    | Optional model repository or release collection containing weights.                                    |
| releases | `weightsSourceUrl`, `weightsNote`   | Evidence and checkpoint, conversion, or availability qualifications.                                   |
| releases | `note`, `mapping`                   | Event qualifications and explanations of version interpretation.                                       |

SQLite and browser CSV exports use snake_case fields such as `artificial_analysis_url` and `hugging_face_url`; the generated CSV tables preserve JSON field names. SQLite's `release_sources` view joins releases with their source and date-evidence links.

## Weight availability

Every event has a weights assessment, separate from its historical release `status`. `open` means downloadable model weights were verified, including gated or restricted-license weights; it is not an open-source license claim. `not-published` means no public checkpoint was found for that release in the reviewed publisher material. `unverified` means the exact checkpoint match remains unresolved. The check date describes current availability, not when the weights first became available.

Software controls use `not-applicable`. Open-source software is not classified as a model with open weights.

Prefer the publisher's Hugging Face repository or a collection for a multi-model release. Community conversions used as weight links, base checkpoints, and partial coverage of a broader announcement are identified in `weightsNote`. A converted weights link does not create another release. Hosted variants do not inherit another checkpoint's weights merely because they share a version number. Promised future weights and dummy test checkpoints are not marked open.

Run `node scripts/audit-weights.mjs` to write `output/weights-audit.json`. It checks repository metadata for checkpoint files and collections for at least one such model. It does not download weights, verify their contents, or establish that a checkpoint matches a release; that association requires reviewing the model card and publisher evidence. Failed links remain review items and cause a nonzero exit. Run `node --test scripts/weights-audit.test.mjs` to test invalid links, empty repositories, gated weights, and failed source requests.

## Dates and versions

Use the calendar date stated by the publisher. Do not infer a release date from a model suffix, repository creation, search crawl date, or website copyright. Announcements, previews, API availability, technical reports, and open-weight releases can be separate labeled events. Keep publication dates distinct from event dates, and preserve source disagreements in the record's notes. Label any secondary date evidence explicitly. OpenRouter creation dates describe gateway listings, not original model release days.

When Hugging Face is the only release-date evidence, prefer the first commit containing model weights for that checkpoint. README/tokenizer/configuration changes and later weight uploads are not additional model releases. Quantizations and format conversions never get separate entries. The importer traverses all commit pages in date order, inspects checkpoint filenames, and stops at the first weight-bearing commit. Validation rejects multiple checkpoint events for the same original repository; the importer refuses to append a later commit to an already recorded checkpoint.

These events use `eventType: checkpoint`, `status: First weights commit`, and `dateBasis: checkpoint-commit`, with a direct commit link and UTC date. The first weight-bearing commit may contain only the first shard, and does not establish when a private repository became public. Prefer explicit publisher announcements and release notes when available.

If first-weight history is inaccessible (HTTP 401, 403, or 404), a reviewed mapping may opt into `allowRepositoryCreated: true`. Verify actual weight filenames in publisher metadata, or recorded safetensor parameters in an archived publisher page. Use `status: Repository created (fallback)` and `dateBasis: repository-created`, with a direct metadata source and explicit note. Creation is a date fallback, not a claim about first upload, public access, or when a renamed model acquired its name. Empty repositories, missing offline responses, malformed history, and rate limits never qualify. If history is accessible, the first weight-bearing commit still wins. A mirror download link does not change which original repository supplies the date.

`Available by` / `documented-by` means a dated source confirms an already existing model without establishing its launch day. Historical ranks use this conservative bound, while repository-creation fallbacks can precede public availability. `announcement-commit` is limited to an actual release announcement preserved in publisher Git history, not arbitrary code updates. `evaluation-metadata` uses an explicit release-date field from a named evaluation project. The [candidate review](../docs/pending-releases.md) keeps these limitations, closed exclusions, and supporting evidence visible. Candidates still awaiting review never enter dated counts or rankings.

Scores are numeric versions, not semantic-version tuples or capability measurements. Keep the first decimal point and concatenate later segments: `2.9.3` scores `2.93`. `3.10` scores `3.1` and loses to `3.9`. The complete published version string is retained. Parameter counts, context sizes, checkpoint dates, and dependency versions do not affect the score. An unnumbered initial model can map to generation 1 with an explicit explanation in `mapping`.

Quantizations and format conversions are not releases: GGUF, GGML, GPTQ, AWQ, EXL2, MLX, ONNX, and precision variants are excluded from discovery candidates, imports, and release counts. Native binary/ternary model architectures remain eligible. Named trained variants, sizes, base/instruction models, and separately sourced availability milestones can be recorded. Packaging receives no credit.

Each family uses its highest numeric version, represented by the earliest recorded event at that version. Same-day ties use alphabetical model names. Later releases with lower version numbers remain in the timeline without lowering the family's maximum.

Python and PyTorch are software controls, including minor and patch releases. Python starts at 3.0 and uses the official documentation release archive; PyTorch includes the official GitHub catalog's numbered releases, including 0.x, excluding drafts and entries marked prerelease. Dates use the Python archive's stated day and PyTorch's GitHub publication time in UTC. Published version labels are retained, including `.0` where the source uses it; existing release IDs remain valid. Later dots are removed as for models: Python 3.9.9 scores 3.99, then 3.9.10 scores 3.910 (3.91). Python 3.11.17 scores 3.1117; displayed scores retain all stored digits. Maintenance can be a setback. `versionCount` counts distinct labels, even when scores tie.

GTA includes GTA V's platform releases, rereleases, and title updates from the [GTA Wiki version history](https://gta.fandom.com/wiki/Grand_Theft_Auto_V/Title_Update_Notes#Version_History). Each dated title-update row is one event, with repeated platform columns combined. Weekly in-game content events are excluded, and platform-launch rows reuse the existing releases. Patch/build/Online labels stay in names and notes; every GTA record has `version: "5"` and `score: 5`. The version has shown considerable discipline. Wiki dates are secondary evidence. Reviewed corrections and an explicitly uncertain date's conservative available-by bound are retained in `gta-update-reviews.json` and the release notes.

Software controls occupy a separate category under “Expanded dataset”. They are excluded from the default timeline and its date range. They are also excluded from the model leaderboard, model counts, and all historical model statistics. `stats.json` reports them separately under `softwareControls`, `softwareControlCount`, and `softwareReleaseCount`; all other aggregate counts and the `families` summaries describe models only. `family-stats.csv` and SQLite's `family_stats` table contain only model families.

The timeline can follow either the highest score to date or the latest release. For multiple releases on the same day, the latest-release line uses that day's highest score; points retain every event. Filters apply to the line's history as well as its points and table. Weight filters describe availability at the check date, not at the historical event date.

## Family statistics

Only model families compete in the historical rankings. On each UTC day, a family uses its highest score reached by that day. All events on the same day take effect together. Rank is 1 plus the number of active model families with a higher score; ties share a competition rank. A family enters on its first recorded event and remains active through the snapshot date, inclusive. Python, PyTorch, and GTA do not affect these calculations.

- **Time at #1:** total days ranked first, including shared first place. Tied families each receive the full day.
- **Average rank:** sum of rank × days at that rank, divided by tracked days. It is time-weighted, not averaged over release events.
- **Number of releases:** all recorded events in the family, including separately documented variants and announcements.
- **Average release rate:** recorded events / (tracked days / 365.2425), in releases per year. The denominator runs from the first recorded event through the snapshot, including quiet periods after the latest release.

Family pages also show current rank, the first release at the highest score, the latest recorded event, and coverage dates. Page and timeline filters do not recalculate historical rankings. These statistics describe the catalog's coverage; the first recorded event need not be a family's first-ever release. Run `node --test scripts/stats.test.mjs` to check ties, elapsed time, new entrants, and decimal regressions.

Each model's `rankHistory` records its initial rank and every date on which that rank changes. `versionHistory` records its highest numeric version reached on each change date. The family-page graph overlays rank on the left axis (#1 at the top) and version on the right (higher numbers at the top), with a shared UTC date axis and an accessible table. Both lines continue through the snapshot date. Points include every release, including versions below the historical maximum. Points link to their sources; overlapping releases open a source list. Rank-change points include the model events recorded that day, including other families' releases. SQLite's `family_rank_history` and `family_version_history` tables contain the line series. Software controls have only a version series, following their latest release to show numeric regressions, and never receive a rank.

The catalog covers named language-model generations, major variants, and release milestones. It is not exhaustive across sizes, fine-tunes, deployments, or providers; quantizations and packaging conversions are excluded. The first recorded event is not necessarily a family's first-ever release. Artificial Analysis links identify matching profiles; their absence does not imply that a model is unavailable. Prices and capability benchmarks are not imported.

## Find and review gaps

Run `node scripts/refresh.mjs` to pull every configured watch page, publisher model inventory, linked weight metadata, Python/PyTorch catalog, and GTA history through one shared response recorder. It advances the proposal's cutoff to today's UTC date without changing curated data. Review `output/refresh/review.json` for additions, substantive corrections, refreshed checks, failed sources, and model candidates; `proposal.json` contains the proposed catalog. Each later fresh capture also identifies newly observed provider candidates against the preceding capture.

After review, `node scripts/refresh.mjs --apply` verifies the saved inputs and response checksums, replays the control importers offline, applies their evidence and verified check dates, and regenerates every artifact. It refuses stale proposals after curated inputs change and refuses incomplete control captures. Failed watch pages and weight links remain explicit review items; they are never treated as successful checks. Model identities, dates, variants, version mappings, and profile links still require curated review. Apply the control proposal before making model edits, or replay with `--offline` to regenerate a proposal against those edits.

The shared release audit compares against [LLM Timeline](https://llm-timeline.com/), [LLM Releases](https://www.llm-releases.com/), [LLM Gateway](https://llmgateway.io/timeline), [LLM Stats](https://llm-stats.com/llm-updates), [Opper](https://opper.ai/model-releases), [OpenRouter](https://openrouter.ai/models), and [Artificial Analysis](https://artificialanalysis.ai/models).

The audit checks the [pages to watch](../docs/source-watchlist.md) for every family. Hugging Face scans traverse every page of each configured publisher's inventory before filtering by repository name; this includes older generations and unnumbered relatives. Web-page scans inspect the listed page's visible text and named links; they do not recursively crawl entire sites. Earlier missing versions, higher versions, unreviewed variants, catalog differences, unresolved dates, and failed sources all remain review items and cause exit 1. A matching highest version cannot conceal missing predecessors. A successful fetch does not establish completeness.

The audit does not modify curated data. Review candidates against primary evidence, preserve existing IDs, reuse sources shared by multiple releases, and retain availability distinctions in `status` and `note`. Repository creation and modification times are not release dates. InternVL and InternLM share a dashboard family; each release retains its published name and version.

After edits, run the generator. Checks catch stale artifacts, invalid records, missing provider discovery configuration, and bundle mismatches. They check data consistency, not whether every real-world release is included. Run `node --test scripts/provider-audit.test.mjs` to check discovery parsing and the known missing-version cases.

## Capture once, replay offline

Network access belongs only to explicit refresh commands. Each audit saves HTTPS response bodies, HTTP failures, pagination links, and SHA-256 hashes. Replays fail if required responses are absent or changed. Requests are bounded and stop after a rate limit; blocked pages are never reported as clean.

```sh
# Pull all sources and prepare a reviewable proposal. No catalog mutation.
node scripts/refresh.mjs

# Replay the saved inputs, without fetching.
node scripts/refresh.mjs --offline

# Apply reviewed controls and check dates, then regenerate all artifacts offline.
node scripts/refresh.mjs --apply

# Retry saved failures without fetching successful responses again.
node scripts/refresh.mjs --resume --retry-errors

# Narrow an audit, or reuse a capture and fetch only missing responses.
node scripts/audit-releases.mjs --family gemma,dolphin --providers-only
node scripts/audit-releases.mjs --resume
```

The unified command accepts `--directory DIR` and `--as-of YYYY-MM-DD`. It saves all raw responses, per-section reports, extracted control catalogs, a complete proposal, and a checksum manifest together under `output/refresh/`. Exit 1 means the capture awaits review, including any source failures. `--resume` is not a fresh check; add `--retry-errors` to retry saved failures after fixing access or waiting for the rate limit. Output snapshots can be large and are ignored by Git. The curated release/source records, review decisions and watchlists are checked in, so builds do not need snapshots. The manual [source audit workflow](../.github/workflows/audit.yml) uploads captured evidence for review; deployment only builds saved data.

The unified command uses the same deterministic Python/PyTorch importer as the focused commands below. The complete extracted catalogs, excluded entries, source URLs, and response hashes are saved in `evidence/software-releases.json`. Generation checks every software record against this evidence, including patch versions that score below an earlier release. In the focused importer, fetching happens only with `--refresh`:

```sh
# Fetch all catalog pages and save a proposal; do not change the dataset.
node scripts/import-software.mjs --refresh

# Review output/software-releases/catalog.json, then replay the capture and apply.
node scripts/import-software.mjs --offline --apply
node scripts/generate.mjs

# Check against committed evidence without a network or output/ cache.
node scripts/import-software.mjs
```

The check exits 1 when saved catalogs contain changes not yet applied. `--apply` alone regenerates software records from committed evidence; `--offline` instead replays the raw capture selected by `--snapshot`. The importer follows every GitHub pagination link, rejects incomplete or conflicting evidence, preserves existing release IDs, and never removes a recorded version just because a refreshed source omits it. Update the dataset's `updated` date when accepting newer releases; entries after that date remain excluded.

GTA follows the same workflow with `node scripts/import-gta.mjs --refresh`, then `node scripts/import-gta.mjs --offline --apply` and the generator. `node scripts/import-gta.mjs` checks the committed `evidence/gta-updates.json` without fetching. The importer uses the wiki's public API, accounts for every history row, preserves separate dates for updates sharing patch notes, and requires saved evidence for date/label corrections. Generation rejects omitted updates or any GTA score other than 5.

For a reviewed checkpoint mapping, use the optional importer separately from the build:

```sh
node scripts/import-checkpoints.mjs --family dolphin
node scripts/import-checkpoints.mjs --family dolphin --offline --apply
node scripts/generate.mjs
```

The importer reads `checkpoint-imports.json`, records date evidence, and refuses to apply a batch with failed repositories or conversion entries. `--repository OWNER/MODEL,OWNER/OTHER` selects exact reviewed mappings. The saved `evidence/hf-date-fallbacks.json` snapshot replays the reviewed creation-date cases without network access. It does not guess identities, versions or publication dates. `scripts/audit-checkpoint-history.mjs` inspects explicit repository URLs without importing them; `scripts/capture-sources.mjs --input urls.json` captures a JSON array of exact evidence URLs. Both support snapshots and offline replay. Live captures may change; identical saved inputs produce identical reports.
