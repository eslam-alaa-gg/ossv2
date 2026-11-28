import { ApiError, handle } from "@/lib/server/api";
import { clientIp, rateLimit, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
type MusicResult = { id: string; title: string; channel: string; thumbnail: string; publishedAt: string };
type MusicRenderer = {
  flexColumns?: Array<{ musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: Array<{ text?: string }> } } }>;
  thumbnail?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: Array<{ url?: string }> } } };
  thumbnailRenderer?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: Array<{ url?: string }> } } };
  playlistItemData?: { videoId?: string };
  overlay?: { musicItemThumbnailOverlayRenderer?: { content?: { musicPlayButtonRenderer?: { playNavigationEndpoint?: { watchEndpoint?: { videoId?: string } } } } } };
  navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
};
function collectMusicResults(value: unknown, output: MusicResult[], seen: Set<string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const item of value) collectMusicResults(item, output, seen); return; }
  const record = value as Record<string, unknown>;
  const renderer = record.musicResponsiveListItemRenderer as MusicRenderer | undefined;
  if (renderer) {
    const id = renderer.playlistItemData?.videoId ?? renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ?? renderer.navigationEndpoint?.watchEndpoint?.videoId;
    const title = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text ?? "").join("").trim();
    const channel = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text ?? "").join("").trim() ?? "";
    const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
    const thumbnail = thumbnails.at(-1)?.url;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && title && !seen.has(id)) {
      seen.add(id);
      output.push({ id, title: title.slice(0, 500), channel: channel.slice(0, 300), thumbnail: thumbnail?.startsWith("https://") ? thumbnail : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, publishedAt: "" });
    }
  }
  for (const child of Object.values(record)) collectMusicResults(child, output, seen);
}
function collectDataApiResults(payload: unknown): MusicResult[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as { items?: unknown[] }).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item): MusicResult[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } } };
    const id = row.id?.videoId, title = row.snippet?.title?.trim();
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !title) return [];
    return [{ id, title: title.slice(0, 500), channel: (row.snippet?.channelTitle ?? "").slice(0, 300), thumbnail: row.snippet?.thumbnails?.medium?.url ?? row.snippet?.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, publishedAt: row.snippet?.publishedAt ?? "" }];
  });
}
async function searchWithDataApi(query: string): Promise<MusicResult[] | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({ part: "snippet", type: "video", videoCategoryId: "10", maxResults: "15", q: query, key }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate: 60 } });
  if (!response.ok) return null;
  return collectDataApiResults(await response.json());
}
async function searchWithMusicWeb(query: string): Promise<MusicResult[]> {
  const home = await fetch("https://music.youtube.com/", { headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!home.ok) throw new Error("YouTube Music is temporarily unavailable.");
  const html = await home.text();
  const readConfig = (name: string) => html.match(new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`))?.[1];
  const key = readConfig("INNERTUBE_API_KEY"), clientVersion = readConfig("INNERTUBE_CLIENT_VERSION"), visitorData = readConfig("VISITOR_DATA");
  if (!key || !clientVersion) throw new Error("YouTube Music client configuration is unavailable.");
  const response = await fetch(`https://music.youtube.com/youtubei/v1/search?key=${encodeURIComponent(key)}&prettyPrint=false`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Origin: "https://music.youtube.com", Referer: "https://music.youtube.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
    body: JSON.stringify({ context: { client: { clientName: "WEB_REMIX", clientVersion, hl: "en", gl: "US", ...(visitorData ? { visitorData } : {}) } }, query, params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D" }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("YouTube Music search could not be completed.");
  const results: MusicResult[] = [];
  collectMusicResults(await response.json(), results, new Set());
  return results.slice(0, 15);
}
export const GET = handle(async (req) => {
  const auth = await requireUser();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) throw new ApiError(400, "Enter at least 2 characters to search.");
  rateLimit(`youtube-music-search:user:${auth.id}`, 12, 60_000);
  rateLimit(`youtube-music-search:ip:${await clientIp()}`, 30, 60_000);
  // Prefer the supported YouTube Data API when configured. Keep the existing
  // YouTube Music WEB_REMIX path as a compatibility fallback for deployments
  // without a usable API key or when the official search returns no results.
  const official = await searchWithDataApi(q).catch(() => null);
  if (official?.length) return { results: official };

  try {
    const fallback = await searchWithMusicWeb(q);
    if (fallback.length) return { results: fallback };
  } catch {
    // WEB_REMIX is undocumented and its client configuration can change.
  }
  throw new ApiError(502, "YouTube Music search is temporarily unavailable. Check the server-side YOUTUBE_API_KEY and try again.", "music_search_unavailable");
});
