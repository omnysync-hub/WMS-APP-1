import axios from "axios";

/**
 * Turns any API failure into a sentence a technician can act on: the ERP's own `error`/`message`
 * text when there is one, otherwise a plain description (offline, timeout, server problem).
 * Used by the shared axios interceptor, so every screen that shows `e.message` gets this text
 * instead of "Request failed with status code 400".
 */
export function describeApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) return err instanceof Error ? err.message : "Something went wrong. Try again.";
  if (!err.response) {
    if (err.code === "ECONNABORTED") return "The server took too long to answer. Check your internet and try again.";
    if (err.code === "ERR_CANCELED") return "Request cancelled.";
    return "Can't reach the server. Check your internet connection and try again.";
  }
  const data: any = err.response.data;
  const serverMsg =
    (data && typeof data === "object" && (typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "")) ||
    (typeof data === "string" && data.length < 300 && !data.trim().startsWith("<") ? data : "");
  if (serverMsg) return serverMsg;
  const status = err.response.status;
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return "Not found. It may have been removed. Refresh and try again.";
  if (status === 409) return "This was changed by someone else. Refresh and try again.";
  if (status === 413) return "The file is too large to upload.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status >= 500) return "The ERP server had a problem. Try again in a minute.";
  return `The request was not accepted (error ${status}). Check the details and try again.`;
}
