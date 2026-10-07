import { sourceURL } from './source-inventory.mjs';

const escape = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
export function renderWatchlist(data, definitions) {
  const lines = [
    '# Pages to watch',
    '',
    'Generated offline from `data/provider-sources.json` by `node scripts/generate.mjs`. Every family has a watchlist. The build never visits these pages. The numbers will not announce themselves.',
    '',
    'The audit traverses every page of each configured Hugging Face model inventory. Webpages are watched at the listed URLs; this is not a recursive crawl of an entire company website. It records named links, earlier versions, unnumbered repositories, and source failures. GitHub pages provide model cards, dated news, and links; SDK tags are not model versions.',
    '',
    'Run `node scripts/audit-releases.mjs` to capture sources and build the review report. Run `node scripts/audit-releases.mjs --offline` to replay it without network access. `--family gemma,intellect --providers-only` narrows either run; `--snapshot FILE` preserves separate captures. Live captures can change; offline replay is deterministic.',
    '',
    'Announcement, API availability, and weights publication require separate dated evidence. A Hugging Face link shows where weights are now, not when a hosted endpoint or announcement launched. Inventory creation/modified timestamps are never release dates.',
    '',
    'Quantizations and format conversions remain visible as excluded artifacts in inventory reports, but never count as separate releases or missing model versions.',
    '',
    'Shared discovery catalogs: [LLM Timeline](https://llm-timeline.com/), [LLM Releases](https://www.llm-releases.com/), [LLM Gateway](https://llmgateway.io/timeline), [LLM Stats](https://llm-stats.com/llm-updates), [Opper](https://opper.ai/model-releases), [OpenRouter](https://openrouter.ai/models), [Artificial Analysis](https://artificialanalysis.ai/models). Confirm candidates against publisher evidence. OpenRouter creation dates are gateway listing dates. No prices or capability scores are imported.',
    '',
  ];
  for (const family of data.families) {
    const definition = definitions.find((d) => d.family === family.id);
    lines.push(
      `<a id="${family.id}"></a>`,
      `## ${family.name}`,
      '',
      `${family.provider}${family.kind === 'software' ? ' · software control' : ''}`,
      '',
      '| Page | Watch for | Evidence |',
      '| --- | --- | --- |',
    );
    for (const source of definition.sources) {
      const url = sourceURL(source);
      lines.push(
        `| [${escape(source.type === 'huggingface' ? `${source.author} on Hugging Face` : url.replace(/^https:\/\//, ''))}](${url}) | ${escape(source.purpose)} | ${source.signals.join(', ')} |`,
      );
    }
    lines.push('', ...(definition.coverageNotes ?? []).map((note) => note + '\n'));
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function renderHistoryReview(data, reviews) {
  const sources = new Map(data.sources.map((s) => [s.id, s]));
  const lines = [
    '# Earlier-version audit',
    '',
    'Generated from `data/history-review.json` and the release catalog. This records the review of families whose history did not begin at 1, including fractional starts. Software controls keep their deliberately limited scope. A missing integer is a question, not permission to invent a model.',
    '',
    '| Family | Previous first version | First recorded now | Review |',
    '| --- | --- | --- | --- |',
  ];
  for (const review of reviews) {
    const family = data.families.find((f) => f.id === review.family);
    const first = data.releases
      .filter((r) => r.family === family.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
    lines.push(
      `| [${escape(family.name)}](https://procrastinine.github.io/versionbench/#family?id=${family.id}) | ${review.previousFirstVersion} | ${first.version} (${first.date}) | ${escape(review.summary)} |`,
    );
  }
  for (const review of reviews) {
    lines.push(
      '',
      `## ${data.families.find((f) => f.id === review.family).name}`,
      '',
      `Checked ${review.checkedAt}. ${review.summary}`,
      '',
    );
    if (review.unresolved?.length)
      lines.push('Still unresolved: ' + review.unresolved.join(' ') + '\n');
    for (const id of review.sourceIds) {
      const source = sources.get(id);
      lines.push(`- [${source.title}](${source.url})`);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function renderPending(data, pending) {
  const names = new Map(data.families.map((f) => [f.id, f.name]));
  const lines = [
    '# Releases awaiting evidence',
    '',
    'Generated from `data/pending-releases.json`. These candidates have no invented release date and do not enter rankings or dated release counts. Uncertainty has not been promoted to a version number.',
    '',
    '| Family | Candidate | Version label | Missing evidence | Sources |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of pending)
    lines.push(
      `| ${escape(names.get(row.family))} | ${escape(row.name)} | ${escape(row.version)} | ${escape(row.reason)} | ${row.sourceUrls.map((url, i) => `[${i + 1}](${url})`).join(' · ')} |`,
    );
  return lines.join('\n') + '\n';
}
