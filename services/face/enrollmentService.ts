import { api } from "@/services/api";
import { cacheEnrollmentEmbedding, getCachedEnrollmentEmbedding } from "@/services/face/embeddingCache";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";

export async function enrollFaceEmbedding(opts: {
  employeeId: string;
  embedding: number[];
  actorName?: string;
  actorRole?: string;
}) {
  if (opts.embedding.length !== FACE_THRESHOLDS.embeddingDim) {
    throw new Error(`Embedding must be ${FACE_THRESHOLDS.embeddingDim}-d`);
  }
  const { data } = await api.enrollFace(opts.employeeId, {
    embedding: opts.embedding,
    enrolledAt: new Date().toISOString(),
    actorName: opts.actorName,
    actorRole: opts.actorRole,
    actorId: opts.employeeId,
  });
  await cacheEnrollmentEmbedding(opts.employeeId, opts.embedding);
  return data;
}

export async function fetchEnrollmentStatus(employeeId: string) {
  const { data } = await api.getEnrollmentStatus(employeeId, false);
  return data as {
    faceEnrolled: boolean;
    hasEmbedding: boolean;
    enrollmentCount?: number;
    enrolledAt?: string;
  };
}

/** Hydrate on-device embedding cache for check-in (self + includeEmbedding). */
export async function hydrateEnrollmentEmbedding(employeeId: string) {
  const cached = await getCachedEnrollmentEmbedding(employeeId);
  if (cached) return cached;

  const { data } = await api.getEnrollmentStatus(employeeId, true);
  if (Array.isArray(data?.embedding) && data.embedding.length === FACE_THRESHOLDS.embeddingDim) {
    await cacheEnrollmentEmbedding(employeeId, data.embedding);
    return data.embedding as number[];
  }
  return null;
}
