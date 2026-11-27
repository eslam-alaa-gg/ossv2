import { ApiError, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } };
  }>;
};

export const GET = handle(async (req) => {
  await requireUser();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) throw new ApiError(400, "Enter at least 2 characters to search.");
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new ApiError(503, "YouTube search is not configured. Add YOUTUBE_API_KEY to the server environment.", "not_configured");
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "12",
    q,
    regionCode: "EG",
    safeSearch: "strict",
    key,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { errors?: Array<{ reason?: string }> } } | null;
    const reason = payload?.error?.errors?.[0]?.reason;
    if (response.status === 403 || reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new ApiError(503, "YouTube search quota or API access is unavailable. Check the Google Cloud API settings.", "quota_or_access");
    }
    throw new ApiError(502, "YouTube search could not be completed. Please try again.", "upstream_error");
  }
  const data = await response.json() as YouTubeSearchResponse;
  const results = (data.items ?? []).flatMap((item) => {
    const id = item.id?.videoId;
    const title = item.snippet?.title;
    if (!id || !title) return [];
    return [{
      id,
      title,
      channel: item.snippet?.channelTitle ?? "",
      thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      publishedAt: item.snippet?.publishedAt ?? "",
    }];
  });
  return { results };
});
