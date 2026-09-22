/**
 * Self-check: signed token detector + embedding JSON size rationale.
 * Run: npx tsx scripts/check-auth-embedding-security.ts
 * (or node after compile). Uses plain assert.
 */
import { isSignedMobileToken } from "../services/authToken";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// New signed format
assert(
  isSignedMobileToken(
    "wms_mobile_YWJjOjE3.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  ),
  "signed token should pass"
);

// Old unsigned format (no signature segment)
assert(!isSignedMobileToken("wms_mobile_Y2I0ZGVhODItYzFmNC00Y2EwLWJmNDQ6MTc1"), "old unsigned must fail");
assert(!isSignedMobileToken("Bearer wms_mobile_abc"), "malformed must fail");
assert(!isSignedMobileToken(""), "empty must fail");

const emb = Array.from({ length: 512 }, (_, i) => Math.sin(i) * 0.5);
const bytes = new TextEncoder().encode(JSON.stringify(emb)).length;
assert(bytes > 2048, `expected embedding JSON >2KB for SecureStore limit rationale, got ${bytes}`);

console.log("auth+embedding security checks ok", { embeddingJsonBytes: bytes });
