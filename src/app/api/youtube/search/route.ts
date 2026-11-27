import { ApiError, handle } from "@/lib/server/api";
import { clientIp, rateLimit, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type MusicItem = {
  musicResponsiveListItemRenderer?: {
    flexColumns?: Array<{ musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: Array<{ text?: string }> } } }>;
    thumbnail?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: Array<{ url?: string }> } } };
    thumbnailRenderer?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: Array<{ url?: string }> } } };
    playlistItemData?: { videoId?: string };
    overlay?: { musicItemThumbnailOverlayRenderer?: { content?: { musicPlayButtonRenderer?: { playNavigationEndpoint?: { watchEndpoint?: { videoId?: string } } } } } };
    navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
  };
};

function collectMusicItems(value: unknown, output: MusicItem[], seen: Set<string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectMusicItems(item, output, seen);
    return;
  }
  const record = value as Record<string, unknown>;
  const renderer = record.musicResponsiveListItemRenderer as MusicItem["musicResponsiveListItemRenderer"] | undefined;
  if (renderer) {
    const id = renderer.playlistItemData?.videoId
      ?? renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
      ?? renderer.navigationEndpoint?.watchEndpoint?.videoId;
    const title = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text ?? "").join("").trim();
    const channel = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text ?? "").join("").trim() ?? "";
    const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      ?? renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails
      ?? [];
    const thumbnail = thumbnails.at(-1)?.url;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && title && !seen.has(id)) {
      seen.add(id);
      output.push({ id, title: title.slice(0, 500), channel: channel.slice(0, 300), thumbnail: thumbnail?.startsWith("https://") ? thumbnail : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, publishedAt: "" });
    }
  }
  for (const child of Object.values(record)) collectMusicItems(child, output, seen);
}

export const GET = handle(async (req) => {
  const auth = await requireUser();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) throw new ApiError(400, "Enter at least 2 characters to search.");
  rateLimit(`youtube-music-search:user:${auth.id}`, 12, 60_000);
  rateLimit(`youtube-music-search:ip:${await clientIp()}`, 30, 60_000);

  // YouTube Music has no public search API. Read the current public WEB_REMIX
  // client config, then use its music search endpoint instead of Data API v3.
  const home = await fetch("https://music.youtube.com/", {
    headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000),
  });
  if (!home.ok) throw new ApiError(502, "YouTube Music is temporarily unavailable.", "music_upstream_error");
  const html = await home.text();
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  const visitorData = html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1];
  if (!key || !clientVersion) throw new ApiError(502, "Could not initialize YouTube Music search.", "music_client_config");

  const response = await fetch(`https://music.youtube.com/youtubei/v1/search?key=${encodeURIComponent(key)}&prettyPrint=false`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://music.youtube.com",
      Referer: "https://music.youtube.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion, hl: "en", gl: "US", ...(visitorData ? { visitorData } : {}) } },
      query: q,
      params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new ApiError(502, "YouTube Music search could not be completed. Try again shortly.", "music_search_failed");
  const payload: unknown = await response.json();
  const items: MusicItem[] = [];
  collectMusicItems(payload, items, new Set());
  return { results: items.slice(0, 15) };
});
