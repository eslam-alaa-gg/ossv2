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
  const headers: Record<string, string> = { Accept: "audio/mpeg, application/octet-stream;q=0.9, */*;q=0.5" };
  if (process.env.AUDIUS_API_KEY) headers["x-api-key"] = process.env.AUDIUS_API_KEY;
  const response = await fetch(url, { headers, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.url) throw new ApiError(502, "Audius could not provide a playable stream for this track.", "audius_stream_unavailable");
  let streamUrl: URL;
  try { streamUrl = new URL(response.url); } catch { throw new ApiError(502, "Audius returned an invalid stream URL."); }
  if (streamUrl.protocol !== "https:" || !/(^|\.)audius\.(co|org)$/i.test(streamUrl.hostname)) {
    await response.body?.cancel();
    throw new ApiError(502, "Audius returned an unsupported stream host.");
  }
  await response.body?.cancel();
  return { streamUrl: streamUrl.toString() };
});
