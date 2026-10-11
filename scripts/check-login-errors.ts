/**
 * Self-check: login error parsing + identifier routing mirrors ERP auth/route.ts.
 * Run: npx --yes tsx scripts/check-login-errors.ts
 */
import axios from "axios";
import {
  parseLoginFailure,
  isMobileAccessDisabledResponse,
  resolveLoginIdentifier,
} from "../services/loginErrors";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function axiosErr(status: number, data: unknown) {
  return new axios.AxiosError("fail", undefined, undefined, undefined, {
    status,
    data,
    statusText: "x",
    headers: {},
    config: {} as never,
  });
}

assert(resolveLoginIdentifier("tech.ali").username === "tech.ali", "username");
assert(resolveLoginIdentifier("Ali@Corp.com").email === "Ali@Corp.com", "email");
assert(!!resolveLoginIdentifier("+971 50 456 7890").phone, "phone");

const locked423 = parseLoginFailure(
  axiosErr(423, {
    error: "Account is temporarily locked...",
    isLocked: true,
    remainingSeconds: 900,
    remainingMinutes: 15,
  })
);
assert(locked423.kind === "locked", "423 → locked");

const locked401 = parseLoginFailure(
  axiosErr(401, {
    error: "Incorrect password. Maximum failed attempts...",
    isLocked: true,
  })
);
assert(locked401.kind === "locked", "401 isLocked → locked");

const deactivated = parseLoginFailure(
  axiosErr(403, {
    error: "Mobile app access is deactivated or not provisioned for this account. Contact HR.",
  })
);
assert(deactivated.kind === "deactivated", "403 → deactivated");

const wrongPw = parseLoginFailure(
  axiosErr(401, {
    error: "Incorrect password. Please try again. 3 attempt(s) remaining.",
    remainingAttempts: 3,
  })
);
assert(wrongPw.kind === "credentials", "401 → credentials");
assert(wrongPw.remainingAttempts === 3, "remainingAttempts");

assert(
  isMobileAccessDisabledResponse(403, { error: "Mobile app access is deactivated" }),
  "403 deactivated"
);
assert(
  isMobileAccessDisabledResponse(401, {
    error: "Unauthorized: Missing or invalid authentication credentials.",
  }),
  "401 unauthorized"
);
assert(
  !isMobileAccessDisabledResponse(401, { error: "Incorrect current password." }),
  "wrong password must not force logout"
);

console.log("check-login-errors: ok");
