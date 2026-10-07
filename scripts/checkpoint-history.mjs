import { paginatedJSON } from './source-snapshot.mjs';
import { checkpointFiles, huggingFaceTarget } from './weights-audit.mjs';

// A commit timestamp is evidence of a checkpoint in repository history, not
// proof of when a private repository became public. Never turn it into an API
// or announcement date. Inspect metadata only; never download weights.
export async function checkpointHistory(client, url) {
  const target = huggingFaceTarget(url);
  if (target.type !== 'model') throw new Error('Checkpoint history requires one model repository');
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
