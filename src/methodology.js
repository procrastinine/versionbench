// Render the benchmark rules and dataset methodology.
export function createMethodology(app) {
  const { main } = app.dom;
  const { esc, dateLabel } = app.format;
  const { stats, families, latestDate } = app.catalog;
  const { head } = app.ui;

  function renderMethodology() {
    main.innerHTML =
      head(
        'VERSIONBENCH / METHODOLOGY',
        'Benchmark Methodology',
        'A transparent definition of the metric, date conventions, and dataset scope.',
      ) +
      /* HTML */ `<article class="methodology">
        <h2>The benchmark score is the version number</h2>
        <p>
          VersionBench records the numeric version of a language model release. GPT-6.1 receives
          <code>6.1</code>; Claude 5.5 receives <code>5.5</code>. These are decimal numbers, not
          semantic-version tuples. Model size, context length, inference cost, and benchmark
          performance do not enter the calculation.
        </p>
        <p>
          Version numbers are assigned independently by each provider. A higher position in this
          benchmark does not imply a more capable model. VersionBench obeys mathematics, not
          semantic versioning. Thus <code>3.9 &gt; 3.10</code>. Vendors are advised to number
          responsibly. Additional decimal points are removed: Dolphin <code>2.9.3</code> scores
          <code>2.93</code>. The published label stays intact.
        </p>
        <h2>Software controls</h2>
        <p>
          Python, PyTorch, and GTA are unranked software controls. Python 3.10 scores
          <code>3.1</code>; PyTorch 2.10 scores <code>2.1</code>. GTA V's platform releases each
          score <code>5</code>. Python includes stable minor and patch releases from 3.0; PyTorch
          includes numbered releases from its official catalog, including 0.x, except entries marked
          prerelease. Python 3.9.9 scores <code>3.99</code>, then 3.9.10 scores <code>3.91</code>.
          Maintenance can be a setback. GTA covers platform releases, rereleases, and title updates
          of GTA V. Patch labels stay in the release details; every version and score remains
          <code>5</code>. Consistency is documented.
        </p>
        <p>
          Software controls live in a separate category under “Expanded dataset”. They are
          deselected by default, and their dates do not extend a model-only timeline. Select them to
          include their history.
        </p>
        <h2>One leaderboard entry per family</h2>
        <p>
          Each family is represented by its highest numeric version in this curated dataset. When
          releases within a family share that version, the first recorded release is shown; releases
          with the same version and date are resolved alphabetically. Families with equal scores
          share a competition rank. For example, two families tied at rank 5 are both ranked 5, and
          the next rank is 7.
        </p>
        <p>
          OpenAI’s o-series has an independent numeric sequence and is tracked separately from GPT.
          Both families retain OpenAI as their provider. For example, o3 scores <code>3</code> on
          the OpenAI o line.
        </p>
        <h2>Release timeline</h2>
        <p>
          The horizontal axis uses the documented event date. Checkpoint commits use UTC and are
          labeled separately; they do not establish when a private repository became public.
          Availability labels distinguish research announcements, previews, and released models; an
          announcement date does not imply general availability. The vertical axis is the exact
          numeric version. “Highest to date” follows the family's highest matching score reached so
          far. “Latest release” follows the newest matching release and can go down. If several
          releases share a day, that day's highest score sets the latest-release line. Individual
          points retain every event and its own version.
        </p>
        <p>
          Variants retain separate release records even when they have the same numeric version.
          Points sharing the exact date and version occupy the same coordinate. An outlined point
          opens a list of all release sources at that position. Date filters change the visible
          interval; a line can continue into that interval from a release that predates it. Family,
          weights, category, and release-status filters apply to points, lines, and the table,
          including the history carried into the viewport. These filters are saved in the URL.
        </p>
        <h2>Family statistics</h2>
        <p>
          Each family enters the historical leaderboard on its first recorded event and remains
          active through the snapshot date, inclusive. Every UTC day's events take effect together;
          model families compete using their highest numeric score reached by then. Python, PyTorch,
          and GTA are excluded from model statistics and ranks. Rank is one plus the number of
          active model families with a strictly higher score.
        </p>
        <p>
          <strong>Time at #1</strong> counts days in first place, giving each tied family the full
          day. <strong>Average rank</strong> is the sum of rank × days at that rank, divided by
          tracked days. <strong>Number of releases</strong> counts recorded events, including
          variants and separate announcements. <strong>Average release rate</strong> is that count /
          (tracked days / 365.2425), in releases per year. Quiet time after the last release still
          counts as time. Page filters do not recalculate these metrics.
        </p>
        <h2>Comparison pages</h2>
        <p>
          Select any set of releases to generate a comparison. Bar height is the raw numeric version
          on a zero-baseline axis. The version spread is the largest selected version minus the
          smallest; it is not a performance improvement. Selections and bar order are encoded in the
          URL fragment, so the same HTML file can reopen a comparison without a server.
        </p>
        <h2>Sources and date evidence</h2>
        <p>
          When Hugging Face is the only release evidence, only the first commit containing model
          weights counts for that checkpoint. If that history is inaccessible, a reviewed repository
          creation date can serve as an explicitly labeled fallback after verifying weight metadata.
          Documentation changes and later weight uploads are not new model releases. Quantizations
          and format conversions do not count either. Uploading is not a numbering strategy.
        </p>
        <p>
          A repository creation fallback does not establish when weights were uploaded or made
          public. “Available by” marks dated evidence that a hosted model already existed, not its
          original launch day. Historical ranks use the recorded dates and inherit these limits.
        </p>
        <p>
          The release index links each record to its original provider announcement, documentation,
          repository, or model card. When a separate source establishes the date, it appears under
          that record’s source notes. Notes also record naming or numeric-version mappings where
          needed. Clicking a timeline point or comparison bar opens the corresponding release
          source.
        </p>
        <h2>Curated coverage</h2>
        <p>
          Hugging Face links lead to available model weights or release collections. Weight
          availability is checked separately from the original event date and can include later
          publications, gated access, or restricted licenses. Community conversions and checkpoint
          differences are identified in source notes. “No public weights found” records the result
          of the check; “Weights unverified” means an exact match remains unresolved. Software
          controls use “Not applicable”; their source code is not classified as model weights.
        </p>
        <p>
          This snapshot contains <strong>${stats.releaseCount} model release records</strong> across
          <strong>${stats.familyCount} model families</strong>, with
          <strong>${stats.sourceCount} model source records</strong>, as of
          ${esc(dateLabel(latestDate))}. Separately, it includes ${stats.softwareControlCount}
          software controls with ${stats.softwareReleaseCount} release records. It is a curated
          version history, not an exhaustive list of model sizes, checkpoints, API aliases, or every
          deployment update. Muse is tracked as a separate family from Llama.
        </p>
        <p>
          The ten core families are
          ${esc(
            families
              .filter((family) => family.core)
              .map((family) => family.name)
              .join(', '),
          )}.
          Additional families are
          ${esc(
            families
              .filter((family) => !family.core && family.kind !== 'software')
              .map((family) => family.name)
              .join(', '),
          )}.
        </p>
        <h2>Portable by design</h2>
        <p>
          All release data, styles, and interaction code are embedded in this static HTML file. The
          dashboard runs locally without a backend or external libraries. Source links open external
          sites only when selected. The release index and comparison views can export their
          displayed records as CSV.
        </p>
        <p><a href="#releases">Explore the release index →</a></p>
      </article>`;
  }

  return { renderMethodology };
}
