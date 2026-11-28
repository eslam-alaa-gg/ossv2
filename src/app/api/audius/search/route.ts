import { ApiError, handle } from "@/lib/server/api";
import { clientIp, rateLimit, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
type AudiusTrack = { id?: string | number; title?: string; duration?: number; is_streamable?: boolean; user?: { name?: string }; artwork?: Record<string, string | undefined> | null };

function safeArtwork(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; }
  catch { return null; }
}

export const GET = handle(async (req) => {
  const auth = await requireUser();
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (query.length < 2) throw new ApiError(400, "Enter at least 2 characters to search.");
  rateLimit("audius-search:user:" + auth.id, 12, 60_000);
  rateLimit("audius-search:ip:" + await clientIp(), 30, 60_000);
  const url = new URL("https://api.audius.co/v1/tracks/search");
  url.search = new URLSearchParams({ query, limit: "15", app_name: "OSSv2" }).toString();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.AUDIUS_API_KEY) headers["x-api-key"] = process.env.AUDIUS_API_KEY;
  let response: Response;
  try {
    response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new ApiError(502, "Could not reach Audius search. Check the provider connection and try again.", "audius_search_network_error");
  }

  if (response.status === 429) {
    throw new ApiError(503, "Audius search is rate-limited. Wait briefly and try again.", "audius_search_rate_limited");
  }
  if (!response.ok) {
    throw new ApiError(502, "Audius search is temporarily unavailable.", "audius_search_unavailable");
  }

  const payload = await response.json().catch(() => null) as { data?: AudiusTrack[] } | null;
  if (!payload || !Array.isArray(payload.data)) {
    throw new ApiError(502, "Audius returned an invalid search response. Try again shortly.", "audius_search_invalid_response");
  }
  const results = payload.data.flatMap((track) => {
    const id = track.id === undefined ? "" : String(track.id);
    const title = typeof track.title === "string" ? track.title.trim() : "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !title || track.is_streamable === false) return [];
    return [{
      id, title: title.slice(0, 500), artist: (track.user?.name ?? "Unknown artist").slice(0, 300),
      artwork: safeArtwork(track.artwork?.["480x480"] ?? track.artwork?.["150x150"] ?? track.artwork?.["1000x1000"]),
      duration: typeof track.duration === "number" && Number.isFinite(track.duration) ? Math.max(0, track.duration) : 0,
    }];
  });
  return { results };
});
