import axios from "axios";

export type LoginErrorKind = "deactivated" | "locked" | "device" | "credentials" | "unknown";

export class LoginError extends Error {
  kind: LoginErrorKind;
  status?: number;
  lockedUntil?: string;
  remainingSeconds?: number;
  remainingMinutes?: number;
  remainingAttempts?: number;
  isLocked?: boolean;

  constructor(
    kind: LoginErrorKind,
    message: string,
    extras: Partial<LoginError> = {}
  ) {
    super(message);
    this.name = "LoginError";
    this.kind = kind;
    Object.assign(this, extras);
  }
}

type AuthErrorBody = {
  code?: string;
  error?: string;
  message?: string;
  isLocked?: boolean;
  lockedUntil?: string;
  remainingSeconds?: number;
  remainingMinutes?: number;
  remainingAttempts?: number;
};

/**
 * Maps one identifier field to ERP body keys.
 * ERP accepts username | phone | email | employeeId (see mobile/auth/route.ts).
 * Admin-provisioned logins primarily use mobileUsername → `username`.
 */
export function resolveLoginIdentifier(raw: string): {
  username?: string;
  phone?: string;
  email?: string;
} {
  const v = raw.trim();
  if (!v) return {};
  if (v.includes("@")) return { email: v };
  const compact = v.replace(/[\s\-\(\)]/g, "");
  if (/^\+?\d{7,}$/.test(compact)) return { phone: v };
  return { username: v.toLowerCase() };
}

/** Maps ERP /api/mobile/auth failure bodies to typed LoginError. */
export function parseLoginFailure(err: unknown): LoginError {
  if (!axios.isAxiosError(err) || !err.response) {
    let host = "";
    try {
      const base = axios.isAxiosError(err) ? err.config?.baseURL : undefined;
      host = base ? new URL(base).host : "";
    } catch {
      host = "";
    }
    const timedOut = axios.isAxiosError(err) && err.code === "ECONNABORTED";
    return new LoginError(
      "unknown",
      timedOut
        ? `The server${host ? ` (${host})` : ""} took too long to answer. Check your internet and try again.`
        : `Can't reach the server${host ? ` (${host})` : ""}. Check your internet connection and try again.`
    );
  }

  const status = err.response.status;
  const data = (err.response.data ?? {}) as AuthErrorBody;
  const serverMsg =
    (typeof data.error === "string" && data.error) ||
    (typeof data.message === "string" && data.message) ||
    "Login failed";

  if (status === 423 || data.isLocked === true) {
    return new LoginError("locked", serverMsg, {
      status,
      isLocked: true,
      lockedUntil:
        typeof data.lockedUntil === "string"
          ? data.lockedUntil
          : data.lockedUntil
            ? new Date(data.lockedUntil as unknown as string).toISOString()
            : undefined,
      remainingSeconds:
        typeof data.remainingSeconds === "number" ? data.remainingSeconds : undefined,
      remainingMinutes:
        typeof data.remainingMinutes === "number" ? data.remainingMinutes : undefined,
    });
  }

  if (status === 409 && data.code === "DEVICE_ALREADY_BOUND") {
    return new LoginError("device", serverMsg, { status });
  }

  if (status === 429) {
    return new LoginError("locked", serverMsg, { status });
  }

  if (status === 403) {
    // Use the ERP's exact reason (suspended / mobile access not enabled), not a generic line.
    return new LoginError(
      "deactivated",
      serverMsg !== "Login failed" ? serverMsg : "Your mobile access has been disabled — contact your admin/HR",
      { status }
    );
  }

  if (status >= 500) {
    return new LoginError("unknown", "The ERP server had a problem signing you in. Try again in a minute.", { status });
  }

  if (status === 401) {
    return new LoginError("credentials", serverMsg, {
      status,
      remainingAttempts:
        typeof data.remainingAttempts === "number" ? data.remainingAttempts : undefined,
    });
  }

  return new LoginError("unknown", serverMsg, { status });
}

/** Mid-session revoke: ERP resolveCaller returns null when mobileLoginActive is false. */
export function isMobileAccessDisabledResponse(status?: number, body?: unknown): boolean {
  if (status !== 401 && status !== 403) return false;
  const data = (body ?? {}) as AuthErrorBody & { code?: string };
  const msg = `${data.error ?? ""} ${data.message ?? ""} ${data.code ?? ""}`.toLowerCase();

  // ERP jobs/procurement RBAC gates: action not allowed for this role/job — NOT a revoked session.
  if (data.code === "PERMISSION_DENIED" || /lacks permission|not assigned to this job/.test(msg)) {
    return false;
  }
  if (/deactivat|mobile app access|not provisioned|mobile_access/.test(msg)) return true;
  if (/incorrect (current )?password|incorrect (current )?pin/.test(msg)) return false;
  // A bare 403 is an authorization refusal for ONE action (ownership, password-change gate, etc.),
  // not a revoked session. Only the explicit deactivation messages above/codes below sign out.
  if (status === 403) return data.code === "MOBILE_ACCESS_DISABLED" || data.code === "UNAUTHENTICATED";
  if (
    status === 401 &&
    /unauthorized|unauthenticated|missing or invalid|authentication required|expired.*session|session.*ended|deactivated session|invalid.*session/.test(
      msg
    )
  ) {
    return true;
  }
  return false;
}
