/**
 * On-device face embedding cache.
 *
 * Biometric template (~10KB JSON for 512 floats) exceeds SecureStore's practical
 * ~2KB platform limits, so we:
 *   - keep a 32-byte AES key in expo-secure-store (OS keystore / Keychain)
 *   - store AES-CTR ciphertext in the app documentDirectory (not readable without the key)
 *
 * Legacy: older builds wrote the raw JSON into SecureStore under `wms_face_emb_<id>` —
 * we migrate that to the encrypted file on first read, then delete the oversized key.
 */
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import aesjs from "aes-js";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";
import { assertEmbeddingDim } from "@/services/face/math";

const legacyKeyFor = (employeeId: string) => `wms_face_emb_${employeeId}`;
const aesKeyFor = (employeeId: string) => `wms_face_emb_aes_${employeeId}`;

function cipherPath(employeeId: string) {
  return `${FileSystem.documentDirectory}wms_face_emb_${employeeId}.bin`;
}

function bytesToHex(bytes: Uint8Array): string {
  return aesjs.utils.hex.fromBytes(bytes);
}

function hexToBytes(hex: string): Uint8Array {
  return aesjs.utils.hex.toBytes(hex);
}

async function getOrCreateAesKey(employeeId: string): Promise<Uint8Array> {
  const storeKey = aesKeyFor(employeeId);
  const existing = await SecureStore.getItemAsync(storeKey);
  if (existing && existing.length === 64) {
    return hexToBytes(existing);
  }
  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(storeKey, bytesToHex(key));
  return key;
}

function encryptUtf8(key: Uint8Array, plaintext: string): string {
  const textBytes = aesjs.utils.utf8.toBytes(plaintext);
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  return bytesToHex(aesCtr.encrypt(textBytes));
}

function decryptUtf8(key: Uint8Array, cipherHex: string): string {
  const encryptedBytes = hexToBytes(cipherHex);
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(aesCtr.decrypt(encryptedBytes));
}

/** Cache enrolled embedding on-device (encrypted at rest). */
export async function cacheEnrollmentEmbedding(
  employeeId: string,
  embedding: number[]
) {
  assertEmbeddingDim(embedding);
  const json = JSON.stringify(embedding);
  const key = await getOrCreateAesKey(employeeId);
  const cipherHex = encryptUtf8(key, json);
  await FileSystem.writeAsStringAsync(cipherPath(employeeId), cipherHex, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  // Drop legacy plaintext SecureStore entry if present
  await SecureStore.deleteItemAsync(legacyKeyFor(employeeId)).catch(() => {});
}

export async function getCachedEnrollmentEmbedding(
  employeeId: string
): Promise<number[] | null> {
  // Preferred: encrypted file + SecureStore key
  try {
    const path = cipherPath(employeeId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const keyHex = await SecureStore.getItemAsync(aesKeyFor(employeeId));
      if (!keyHex) return null;
      const cipherHex = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const json = decryptUtf8(hexToBytes(keyHex), cipherHex);
      const vec = JSON.parse(json) as number[];
      if (Array.isArray(vec) && vec.length === FACE_THRESHOLDS.embeddingDim) {
        return vec;
      }
    }
  } catch {
    // fall through to legacy
  }

  // Legacy migration: raw JSON in SecureStore (may have failed on iOS if >2KB)
  try {
    const raw = await SecureStore.getItemAsync(legacyKeyFor(employeeId));
    if (!raw) return null;
    const vec = JSON.parse(raw) as number[];
    if (!Array.isArray(vec) || vec.length !== FACE_THRESHOLDS.embeddingDim) {
      return null;
    }
    await cacheEnrollmentEmbedding(employeeId, vec);
    return vec;
  } catch {
    return null;
  }
}

export async function clearCachedEnrollmentEmbedding(employeeId: string) {
  await SecureStore.deleteItemAsync(legacyKeyFor(employeeId)).catch(() => {});
  await SecureStore.deleteItemAsync(aesKeyFor(employeeId)).catch(() => {});
  const path = cipherPath(employeeId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
