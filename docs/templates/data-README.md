# VersionBench release data

{{STATS_SUMMARY}}

## Files

`releases.json` is the editable source of truth. From the repository root, run `node scripts/generate.mjs` to generate the CSV tables, `stats.json`, SQLite database, standalone page, and both READMEs.

Statistics include counts, coverage dates, releases by year and availability, weight availability and link coverage, and each family's highest version and first recorded release at that version. They are derived entirely from the catalog. Edit the release data to change them, and edit `docs/templates/` to change README prose.

## Schema

| Table    | Fields                              | Meaning                                                              |
| -------- | ----------------------------------- | -------------------------------------------------------------------- |
| families | `id`, `name`, `provider`            | Family identity and originating organization.                        |
| families | `color`, `core`                     | Chart color and membership in the default comparison group.          |
| sources  | `id`, `title`, `url`, `publisher`   | Reusable source record and direct link.                              |
| sources  | `date`, `checkedAt`                 | Optional publication date and snapshot verification date.            |
| releases | `id`, `family`, `name`              | Event identity, family reference, and published model name.          |
| releases | `version`, `score`                  | Version string and its numeric value.                                |
| releases | `date`, `status`                    | Event date and availability at that time.                            |
| releases | `sourceId`, `dateSourceId`          | Main source and optional additional date evidence.                   |
| releases | `artificialAnalysisUrl`             | Optional verified profile for the matching model or checkpoint.      |
| releases | `weightsStatus`, `weightsCheckedAt` | Weight availability assessment and date checked.                     |
| releases | `huggingFaceUrl`                    | Optional model repository or release collection containing weights.  |
| releases | `weightsSourceUrl`, `weightsNote`   | Evidence and checkpoint, conversion, or availability qualifications. |
| releases | `note`, `mapping`                   | Event qualifications and explanations of version interpretation.     |

SQLite and browser CSV exports use snake_case fields such as `artificial_analysis_url` and `hugging_face_url`; the generated CSV tables preserve JSON field names. SQLite's `release_sources` view joins releases with their source and date-evidence links.

## Weight availability

Every event has a weights assessment, separate from its historical release `status`. `open` means downloadable model weights were verified, including gated or restricted-license weights; it is not an open-source license claim. `not-published` means no public checkpoint was found for that release in the reviewed publisher material. `unverified` means the exact checkpoint match remains unresolved. The check date describes current availability, not when the weights first became available.

Prefer the publisher's Hugging Face repository or a collection for a multi-model release. Community conversions, quantizations, base checkpoints, and partial coverage of a broader announcement are identified in `weightsNote`. Hosted variants do not inherit another checkpoint's weights merely because they share a version number. Promised future weights are not marked open.

Run `node scripts/audit-weights.mjs` to write `output/weights-audit.json`. It checks repository metadata for checkpoint files and collections for at least one such model. It does not download weights, verify their contents, or establish that a checkpoint matches a release; that association requires reviewing the model card and publisher evidence. Failed links remain review items and cause a nonzero exit. Run `node --test scripts/weights-audit.test.mjs` to test invalid links, empty repositories, gated weights, and failed source requests.

## Dates and versions

Use the calendar date stated by the publisher. Do not infer a release date from a model suffix, repository creation, search crawl date, or website copyright. Announcements, previews, API availability, technical reports, and open-weight releases can be separate labeled events. Keep publication dates distinct from event dates, and preserve source disagreements in the record's notes. Label any secondary date evidence explicitly.

Scores are literal numeric versions, not semantic-version tuples or capability measurements. Parameter counts, context sizes, checkpoint dates, and software versions do not affect the score. An unnumbered initial model can map to generation 1 when a subsequent numbered lineage supports that interpretation; explain the mapping in its record.

Each family uses its highest numeric version, represented by the earliest recorded event at that version. Same-day ties use alphabetical model names. Later releases with lower version numbers remain in the timeline without lowering the family's maximum.

The catalog covers named language-model generations, major variants, and release milestones. It is not exhaustive across sizes, quantizations, fine-tunes, deployments, or providers. The first recorded event is not necessarily a family's first-ever release. Artificial Analysis links identify matching profiles; their absence does not imply that a model is unavailable. Prices and capability benchmarks are not imported.

## Find and review gaps

Run `node scripts/audit-releases.mjs` to compare against [LLM Timeline](https://llm-timeline.com/), [LLM Releases](https://www.llm-releases.com/), [LLM Gateway](https://llmgateway.io/timeline), [LLM Stats](https://llm-stats.com/llm-updates), [Opper](https://opper.ai/model-releases), and [Artificial Analysis](https://artificialanalysis.ai/models).

The audit also checks official model repositories and provider pages for every family, configured in `data/provider-sources.json`. It writes `output/release-audit.json` with the observed versions, evidence, source URLs, higher-version candidates, and catalog name/date differences. Higher versions and unreadable sources make the command exit unsuccessfully so they need review. A successful fetch or a matching catalog entry does not establish completeness.

The audit does not modify curated data. Review candidates against primary evidence, preserve existing IDs, reuse sources shared by multiple releases, and retain availability distinctions in `status` and `note`. Repository creation and modification times are not release dates. InternVL and InternLM share a dashboard family; each release retains its published name and version.

After edits, run the generator. Checks catch stale artifacts, invalid records, missing provider discovery configuration, and bundle mismatches. They check data consistency, not whether every real-world release is included. Run `node --test scripts/provider-audit.test.mjs` to check discovery parsing and the known missing-version cases.
