import "server-only";
import { ApiError } from "./api";

/** Resolve redirects and emailed links from trusted deployment configuration, never request Host headers. */
export function getAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!configured) {
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
    throw new ApiError(503, "The application URL is not configured.");
  }
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new ApiError(503, "The configured application URL is invalid."); }
  const localDevelopment = process.env.NODE_ENV !== "production"
    && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if ((!localDevelopment && url.protocol !== "https:") || url.username || url.password) {
    throw new ApiError(503, "The configured application URL must use HTTPS.");
  }
  return url.origin;
}
