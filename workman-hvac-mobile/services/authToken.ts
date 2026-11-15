/**
 * Mobile session token shape (must match ERP `signMobileToken`):
 *   wms_mobile_<base64url(employeeId:timestamp)>.<hmac_sha256_hex>
 *
 * Mirrors services/authToken.ts in the main Workman app. Old unsigned tokens
 * (no dot/signature) must force re-login after the ERP auth hardening.
 */
export function isSignedMobileToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const t = token.trim();
  if (!t.startsWith("wms_mobile_")) return false;
  const body = t.slice("wms_mobile_".length);
  const parts = body.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;
  // HMAC-SHA256 hex = 64 chars
  if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
  return true;
}
