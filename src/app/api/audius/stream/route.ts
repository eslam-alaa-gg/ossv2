import { ApiError, handle } from "@/lib/server/api";
import { clientIp, rateLimit, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const auth = await requireUser();
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ApiError(400, "Invalid Audius track ID.");
  rateLimit("audius-stream:user:" + auth.id, 30, 60_000);
  rateLimit("audius-stream:ip:" + await clientIp(), 60, 60_000);

  const url = new URL("https://api.audius.co/v1/tracks/" + encodeURIComponent(id) + "/stream");
  url.searchParams.set("app_name", "OSSv2");
  const headers: Record<string, string> = {
    Accept: "audio/mpeg, application/octet-stream;q=0.9, */*;q=0.5",
  };
  const range = req.headers.get("range");
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
  if (process.env.AUDIUS_API_KEY) headers["x-api-key"] = process.env.AUDIUS_API_KEY;

  // Audius intentionally redirects stream requests to distributed CDN hosts.
  // Keep the redirect instead of incorrectly requiring the final host to be audius.co.
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(502, "Could not reach the Audius audio stream. Check the provider connection and try again.", "audius_stream_network_error");
  }

  if (response.status === 404) {
    await response.body?.cancel();
    throw new ApiError(404, "Audius could not find this track.", "audius_track_not_found");
  }
  if (response.status === 429) {
    await response.body?.cancel();
    throw new ApiError(503, "Audius streaming is rate-limited. Wait briefly and try again.", "audius_stream_rate_limited");
  }
  if (!response.ok || !response.url) {
    await response.body?.cancel();
    throw new ApiError(502, "Audius could not provide a playable stream for this track.", "audius_stream_unavailable");
  }

  let streamUrl: URL;
  try {
    streamUrl = new URL(response.url);
  } catch {
    await response.body?.cancel();
    throw new ApiError(502, "Audius returned an invalid stream URL.");
  }
  if (streamUrl.protocol !== "https:") {
    await response.body?.cancel();
    throw new ApiError(502, "Audius returned an insecure stream URL.");
  }

  await response.body?.cancel();
  return new Response(null, {
    status: 307,
    headers: {
      Location: streamUrl.toString(),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
