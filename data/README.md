# VersionBench release data

Snapshot: **2026-10-06**. The current collection contains **404 release events across 18 families**, supported by **264 sources**.

VersionBench measures the number in a model's name. It does not measure model quality, intelligence, price, speed, or a benchmark result. The dataset is a curated history of named generations, major variants, and release milestones, with links primarily to official announcements, research papers, repositories, and developer release notes. Contemporary reporting is explicitly identified when an older provider announcement could not be recovered.

## Files and relationships

`releases.json` is the canonical editable dataset. The build produces `families.csv`, `sources.csv`, and `releases.csv`; the database export produces `versionbench.sqlite`. Sources are stored once and referenced by ID.

| Table    | Column                | Meaning                                                                                                            |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| families | id                    | Stable family key.                                                                                                 |
| families | name, provider        | Display name and originating organization.                                                                         |
| families | color                 | Chart color.                                                                                                       |
| families | core                  | Whether the family belongs to the Core 10 group used by the leaderboard filter and the default timeline selection. |
| sources  | id                    | Stable source key, referenced by release records.                                                                  |
| sources  | title, url, publisher | Source identification and direct link; publisher labels identify contemporary reporting used for older releases.   |
| sources  | date                  | Source publication date when it has one; omitted for continuously updated indexes and changelogs.                  |
| sources  | checkedAt             | Date the source was checked for this snapshot.                                                                     |
| releases | id, family            | Unique event key and family foreign key.                                                                           |
| releases | name                  | Published model name, with event qualifiers where needed.                                                          |
| releases | version               | Numeric version label preserved as a string.                                                                       |
| releases | score                 | Numeric conversion of the version for plotting and comparisons.                                                    |
| releases | date                  | Exact calendar date of the recorded event.                                                                         |
| releases | status                | Availability at the recorded event, not today's availability.                                                      |
| releases | sourceId              | Source supporting the named model or event.                                                                        |
| releases | dateSourceId          | Optional additional source supporting its date.                                                                    |
| releases | note                  | Event scope, availability, or date clarification.                                                                  |
| releases | mapping               | Explanation where a name needs interpretation to produce a numeric score.                                          |

## Date conventions

Use the calendar date stated by the publisher. Do not convert publication days between time zones or infer release dates from checkpoint suffixes, URLs, search-engine crawl dates, or a site's copyright year.

The preferred event is the first documented public announcement or public availability of a named release. A preview, restricted release, research paper, public API launch, later stable release, or later open-weights release can each be a separately labeled event. These are not all general availability dates. Multiple variants on the same day remain separate records; models with the same version on different days retain their own dates. Records marked `Announced` do not imply unrestricted access.

Specific date decisions are recorded in each affected row:

- Claude 3 Haiku has separate March 4, 2024 announcement and March 13 API-release events. Claude 3.5 Haiku similarly separates its October 22 announcement from November 4 API availability, using Anthropic’s original announcement and API release notes instead of a hosting partner’s availability post.
- Claude 3.5 Sonnet uses June 20, 2024, supported by Anthropic’s API release notes, although the current announcement header shows June 21. Claude Fable/Mythos 5.1 and GPT-6 releases also retain provider changelogs as explicit date evidence.
- Gemini 1.0 Ultra, Gemma 2, and Gemma 3n retain their initial announcement or preview separately from later consumer or open-weights availability.
- Phi-3.5 Vision links Microsoft’s model card and its dated August 20, 2024 release-card commit. The current card gives only the release month.
- Qwen1.5 separates the February 4, 2024 blog announcement from the official repository’s February 5 release entry.
- Claude 1.3 retains the original Anthropic tweet link. Its April 18, 2023 date is also documented by a contemporaneous NeurIPS paper that quotes and references the announcement; the tweet is unavailable to automated retrieval.
- Qwen2 uses the official repository's June 6, 2024 release entry; the companion blog was published June 7.
- Qwen’s newer blog renders its datelines in the viewer’s timezone. Qwen3-Coder-Next uses February 3, 2026 and the Qwen3-Max-Thinking blog uses January 26, checked in the publisher’s Asia/Shanghai timezone. The latter’s separate API event remains January 23.
- Qwen hosted API releases use Alibaba Cloud's official model-release ledger, preserving region notes and separating public release days from snapshot suffixes. Qwen3.8-Max has distinct August 2 API and August 3 announcement events.
- Grok 4.5 uses the July 8, 2026 API changelog entry; its blog announcement was published July 16.
- Grok 3's included event is the February 19, 2025 release-blog announcement. It does not claim to date the earlier livestream.
- Llama 3.3 uses the explicit December 6, 2024 release date in its model card.
- ERNIE 5.1 uses the article's May 9, 2026 date and same-day release statement, rather than treating the URL's `0508` suffix as a date.
- Mistral Medium 3.5 uses the official lifecycle table's April 29, 2026 release date; the associated Vibe product post is dated May 22.
- Original DeepSeek Coder and DeepSeek LLM use dated official repository commits whose release text links the public downloads: November 2 and November 29, 2023. Repository creation alone is not treated as a model release.
- DeepSeek Coder V2's June 14, 2024 API event is distinct from its June 17 paper/open-model documentation.
- GLM-130B uses the authors' August 4, 2022 research announcement, with its later October 5 technical paper retained as the main model link. GLM-5 uses the official Chinese index's February 11, 2026 date; the English post is dated February 12.
- Original Kimi Chat is recorded from its October 9, 2023 closed-test launch, explicitly dated in Volcengine's official partner article and contemporary CNStock reporting. Public opening on November 16 is a separate event, supported by the dated Moonshot WeChat announcement index and November 17 ChinaZ reporting. The March 18, 2024 two-million-character context preview remains generation 1; context capacity and product-interface version numbers are not model versions.
- The [archived China Daily article](https://web.archive.org/web/20250120165401/https://caijing.chinadaily.com.cn/a/202403/26/WS6602b471a3109f7860dd70c5.html), published March 26, 2024 from Eastday reporting, is preserved as additional date evidence for the March 18 Kimi preview. It also confirms the original October 2023 launch; the January 20, 2025 archive timestamp is not a release date.
- Kimi k0-math has separately dated November 16, 2024 announcement and November 26 public rollout records, supported by contemporary Yicai and IT Home reporting. Both are explicitly labeled as reporting rather than provider publications.
- Kimi K1's December 16, 2024 date uses contemporary IT Home reporting of Moonshot's announcement. The main link is the launch designer's project record. This is explicitly marked secondary date evidence; the original dated provider post was not recovered.
- Mistral 7B v0.2 is the December 11, 2023 Instruct release, not the later standalone base-model upload. Early Mixtral records identify the public Instruct announcements; they do not claim to date earlier base-weight uploads.
- Mistral Large 4 and Gemini 4 Argon are previews at this snapshot. Their rows do not imply generally available downloadable weights.

## Version mapping and scope

Decimals are literal numbers, not semantic-version tuples: the source label `4.20` is retained in `version`, while the Version Benchmark is the numeric score 4.2. Variant names such as Pro, Flash-Lite, Sonnet, Astra, Thinking, and Live do not increase the number. Parameter counts, context windows, checkpoint dates, and API revision suffixes do not become scores.

Original releases without an explicit generation number can be normalized to 1 when their subsequent numbered lineage makes that interpretation clear; those rows have an explicit `mapping`. Examples include the original GPT, Claude, LLaMA, Qwen, Gemma, Nova, Muse Spark, Mistral Large, DeepSeek LLM, and GLM. GLM-130B remains generation 1; its parameter count is not a generation number.

Mistral includes 7B v0.1, v0.2, and v0.3, numbered Mixtral releases, and named Large, Medium, and Small releases. The early published 0.x versions remain fractional scores; 7B and 8x22B are parameter counts, never scores. Independent sublineage numbers are scored directly and documented in each row. DeepSeek includes its original LLM and Coder, Coder V2, the V series, and the R reasoning series: R1, R1-Zero, and R1-0528 all score 1, independently of the V and Coder numbering. Kimi k0-math retains the literal score 0 for its announcement and public rollout; 0 is valid data, not a missing value. A later release with a lower number is not a model regression. Family leaderboards use the highest recorded score. Muse is separate from Llama. OpenAI's o-series is separate from GPT.

The collection emphasizes language and conversational multimodal models, including foundation-model research and named coding/reasoning variants. Kimi's K-series, Moonshot-v1 API variants, and Kimi Code model releases are included; Kimi Code client software versions are not model versions. It is not an exhaustive inventory of every size, quantization, dated snapshot, fine-tune, regional endpoint, embedding model, image/video generator, or provider. Some additional families begin at the earliest clearly sourced milestone included here, not their first-ever research model. Unnumbered products without a defensible generation mapping are omitted.

## Updating

Add a primary source and a release record, preserving existing IDs where possible. If an older exact date requires contemporary secondary reporting, label that exception in the source publisher and release note, and use `dateSourceId` to keep it distinct from the model's main source. Reuse a source ID for announcements covering multiple variants. Keep important availability distinctions in `status` and `note`. If the event date differs from the announcement's publication date, add the date source rather than silently changing the source date. Run the project build and checks to regenerate exports and validate IDs, foreign keys, dates, scores, and the standalone HTML.
