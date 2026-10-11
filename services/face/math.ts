import { FACE_THRESHOLDS } from "@/services/face/thresholds";

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

export function averageEmbeddings(vectors: number[][]): number[] {
  if (!vectors.length) throw new Error("No embeddings to average");
  const dim = vectors[0].length;
  const acc = new Array(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) throw new Error("Embedding dimension mismatch");
    for (let i = 0; i < dim; i++) acc[i] += v[i];
  }
  const avg = acc.map((x) => x / vectors.length);
  return l2Normalize(avg);
}

/**
 * Average embeddings, drop outliers far from the mean, then re-average.
 * Makes multi-angle enrollments more robust than a raw mean of everything.
 */
export function robustAverageEmbeddings(
  vectors: number[][],
  minKeepRatio = 0.5,
  outlierCosineMin = 0.35
): { embedding: number[]; kept: number; dropped: number } {
  if (vectors.length < 2) {
    return { embedding: averageEmbeddings(vectors), kept: vectors.length, dropped: 0 };
  }
  const provisional = averageEmbeddings(vectors);
  const kept = vectors.filter((v) => cosineSimilarity(v, provisional) >= outlierCosineMin);
  const minKeep = Math.max(2, Math.ceil(vectors.length * minKeepRatio));
  if (kept.length < minKeep) {
    throw new Error(
      `Only ${kept.length}/${vectors.length} shots agreed. Retake in even light — stay in the oval.`
    );
  }
  return {
    embedding: averageEmbeddings(kept),
    kept: kept.length,
    dropped: vectors.length - kept.length,
  };
}

/** Cosine similarity for L2-normalized vectors ≈ dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function assertEmbeddingDim(vec: number[]) {
  if (vec.length !== FACE_THRESHOLDS.embeddingDim) {
    throw new Error(
      `Expected ${FACE_THRESHOLDS.embeddingDim}-d embedding, got ${vec.length}`
    );
  }
}
