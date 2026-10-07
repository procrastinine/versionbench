import { paginatedJSON } from './source-snapshot.mjs';
import { checkpointFiles, huggingFaceTarget } from './weights-audit.mjs';

// A commit timestamp is evidence of a checkpoint in repository history, not
// proof of when a private repository became public. Never turn it into an API
// or announcement date. Inspect metadata only; never download weights.
export async function checkpointHistory(
  client,
  url,
  { allowRepositoryCreated = false, archivedMetadataUrl } = {},
) {
  const target = huggingFaceTarget(url);
  if (target.type !== 'model') throw new Error('Checkpoint history requires one model repository');
  try {
    return await firstWeights(client, url, target);
  } catch (error) {
    // A reviewed mapping may opt into the repository-date fallback. Never use
    // it to hide a missing offline response, rate limit, or malformed history.
    if (
      !allowRepositoryCreated ||
      !/^HTTP (401|403|404):/.test(error.message) ||
      client.blockedHosts?.has(new URL(url).host)
    )
      throw error;
    const metadataUrl = archivedMetadataUrl ?? `https://huggingface.co/api/models/${target.id}`;
    let model;
    if (archivedMetadataUrl) {
      const archive = new URL(archivedMetadataUrl);
      if (
        archive.protocol !== 'https:' ||
        archive.host !== 'web.archive.org' ||
        archive.pathname.replace(/^\/web\/\d{14}(?:id_)?\//, '') !== url ||
        archive.search || archive.hash
      )
        throw new Error('Archive must preserve the exact publisher model URL');
      model = archivedHuggingFaceModel(await client.text(metadataUrl), target.id);
    } else model = await client.json(metadataUrl);
    if (model.id?.toLowerCase() !== target.id.toLowerCase())
      throw new Error('Repository-date fallback model identity mismatch');
    const files = checkpointFiles(model.siblings);
    const archivedWeights = archivedMetadataUrl && model.safetensors?.total > 0;
    if (!files.length && !archivedWeights)
      throw new Error('Repository-date fallback requires actual model weights');
    if (!model.createdAt || !Number.isFinite(Date.parse(model.createdAt)))
      throw new Error('Repository-date fallback requires a valid createdAt timestamp');
    return {
      url,
      evidenceType: 'repository-created',
      date: model.createdAt,
      metadataUrl,
      ...(files.length
        ? { checkpointFileCount: files.length, firstWeightFile: files[0] }
        : { archivedSafetensorsParameters: model.safetensors.total }),
      historyError: error.message,
      caveat:
        `Hugging Face repository creation date used as a fallback because first-weight history is inaccessible. ${archivedMetadataUrl ? 'Archived publisher metadata records model weights' : 'Model weights exist now'}, but this date does not establish when weights were uploaded or the repository became public.`,
    };
  }
}

// Archived HF pages contain JSON attributes. Parse data; never execute the page.
export function archivedHuggingFaceModel(html, id) {
  for (const match of html.matchAll(/data-props="([\s\S]*?)"/g)) {
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    let props;
    try { props = JSON.parse(decoded); } catch { continue; }
    if (props.model?.id?.toLowerCase() === id.toLowerCase()) return props.model;
  }
  throw new Error('Archived page has no metadata for the requested model');
}

async function firstWeights(client, url, target) {
  const { rows, pages } = await paginatedJSON(
    client,
    `https://huggingface.co/api/models/${target.id}/commits/main`,
  );
  if (!rows.length || rows.some((r) => !r.id || !r.date))
    throw new Error('Empty or invalid commit history');
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const commit of rows) {
    const model = await client.json(
      `https://huggingface.co/api/models/${target.id}/revision/${commit.id}`,
    );
    const files = checkpointFiles(model.siblings);
    if (files.length)
      return {
        url,
        evidenceType: 'checkpoint-commit',
        date: commit.date,
        commitUrl: `${url}/commit/${commit.id}`,
        revision: commit.id,
        checkpointFileCount: files.length,
        firstWeightFile: files[0],
        pages,
        caveat:
          'First commit containing model weights in accessible repository history, used as Hugging Face-only date evidence. Later commits are not model releases. This may be the first shard upload; public availability may have started later.',
      };
  }
  throw new Error('No model weights in accessible commit history');
}
