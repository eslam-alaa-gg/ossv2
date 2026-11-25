"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiErr extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiErr("Network error — check your connection and try again.", 0, "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/api/auth") && !url.startsWith("/api/spotify") && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiErr((data as { error?: string }).error ?? "Request failed.", res.status, (data as { code?: string }).code);
  }
  return data as T;
}

export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    try {
      const d = await api<T>(url);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function minutesLabel(m: number) {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
