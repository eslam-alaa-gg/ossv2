import { ApiError, handle } from "@/lib/server/api";
import { clientIp, rateLimit, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type MusicResult = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt: string;
};

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

function collectDataApiResults(payload: unknown): MusicResult[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as { items?: unknown[] }).items;
  if (!Array.isArray(items)) return [];

  return items.flatMap((item): MusicResult[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as YouTubeSearchItem;
    const id = row.id?.videoId;
    const title = row.snippet?.title?.trim();
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !title) return [];

    const thumbnail = row.snippet?.thumbnails?.high?.url
      ?? row.snippet?.thumbnails?.medium?.url
      ?? row.snippet?.thumbnails?.default?.url
      ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

    return [{
      id,
      title: title.slice(0, 500),
      channel: (row.snippet?.channelTitle ?? "").slice(0, 300),
      thumbnail: thumbnail.startsWith("https://") ? thumbnail : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      publishedAt: row.snippet?.publishedAt ?? "",
    }];
  });
}

async function searchYouTubeMusic(query: string): Promise<MusicResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new ApiError(503, "YouTube search is not configured. Add the server-side YOUTUBE_API_KEY environment variable.", "youtube_api_key_missing");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    order: "relevance",
    maxResults: "15",
    q: query,
    key,
  }).toString();

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const payload = await response.json().catch(() => null) as {
    items?: unknown[];
    error?: { errors?: Array<{ reason?: string }> };
  } | null;

  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new ApiError(503, "YouTube search quota has been reached. Try again later.", "youtube_quota_exceeded");
    }
    if (reason === "keyInvalid" || reason === "accessNotConfigured") {
      throw new ApiError(503, "The YouTube Data API key is invalid or the YouTube Data API v3 is not enabled.", "youtube_api_key_invalid");
    }
    throw new ApiError(502, "YouTube search is temporarily unavailable. Check the API key, API access and quota.", "youtube_api_unavailable");
  }

  return collectDataApiResults(payload).slice(0, 15);
}

export const GET = handle(async (req) => {
  const auth = await requireUser();
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (query.length < 2) throw new ApiError(400, "Enter at least 2 characters to search.");

  rateLimit(`youtube-music-search:user:${auth.id}`, 12, 60_000);
  rateLimit(`youtube-music-search:ip:${await clientIp()}`, 30, 60_000);

  return { results: await searchYouTubeMusic(query) };
});
