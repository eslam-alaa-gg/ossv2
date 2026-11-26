"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Monitor, Music2, Smartphone, Trash2 } from "lucide-react";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";

type BridgeDevice = { id: string; platform: "android" | "windows"; deviceName: string; updatedAt: string };
type BridgeTrack = {
  idle: boolean;
  playing?: boolean;
  track?: { title: string; artist: string; album: string; artwork: string | null; appName: string };
  device?: { id: string; name: string; platform: string };
  progressMs?: number;
  durationMs?: number;
  fetchedAt?: number;
};
type PairResult = { device: { id: string; platform: string; deviceName: string }; token: string };

export function MusicBridgePanel() {
  const { lang } = useApp();
  const ar = lang === "ar";
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [track, setTrack] = useState<BridgeTrack | null>(null);
  const [pairing, setPairing] = useState<PairResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const autoPairTriggered = useRef(false);
  const loadInFlight = useRef(false);

  const load = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    try {
      const [d, n] = await Promise.all([
        api<{ devices: BridgeDevice[] }>("/api/music-bridge/devices"),
        api<BridgeTrack>("/api/music-bridge/now-playing"),
      ]);
      setDevices(d.devices);
      setTrack(n);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : (ar ? "تعذر تحميل البيانات." : "Could not load bridge data."));
    } finally {
      loadInFlight.current = false;
    }
  }, [ar]);

  useEffect(() => {
    let timer: ReturnType<typeof window.setInterval> | null = null;
    const stop = () => { if (timer) window.clearInterval(timer); timer = null; };
    const start = () => {
      if (document.visibilityState !== "visible" || timer) return;
      void load();
      timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10000);
    };
    const onVisibility = () => { if (document.visibilityState === "visible") start(); else stop(); };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [load]);

  async function pair(platform: "android" | "windows") {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<PairResult>("/api/music-bridge/pair", {
        body: { platform, deviceName: platform === "android" ? "Android device" : "Windows PC" },
      });
      setPairing(result);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : (ar ? "فشل إنشاء رمز الربط." : "Could not create a pairing token."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("pair") !== "android" || autoPairTriggered.current) return;
    autoPairTriggered.current = true;
    window.history.replaceState({}, "", "/music-bridge");
    void pair("android");
  }, [searchParams]);

  async function revoke(deviceId: string) {
    setBusy(true);
    try {
      await api("/api/music-bridge/revoke", { body: { deviceId } });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : (ar ? "تعذر إلغاء الجهاز." : "Could not revoke device."));
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!pairing) return;
    await navigator.clipboard.writeText(pairing.token);
    setMessage(ar ? "تم نسخ رمز الجهاز." : "Device token copied.");
  }

  const format = (ms: number) => {
    const s = Math.floor(Math.max(0, ms) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title={ar ? "التعرّف على الموسيقى" : "Music Detection"} subtitle={ar ? "اعرض الأغنية التي تعمل على أجهزتك دون ربط Spotify API." : "Show what's playing on your devices without Spotify API."} />
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-card text-accent"><Music2 className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{ar ? "الأغنية الحالية" : "Currently playing"}</h2>
            <p className="text-xs text-muted">{ar ? "تحديث تلقائي كل 10 ثوانٍ أثناء فتح الصفحة" : "Automatically refreshes every 10 seconds while this tab is visible"}</p>
          </div>
          <Badge tone={track && !track.idle ? "green" : undefined}>{track && !track.idle ? (track.playing ? (ar ? "يعمل الآن" : "Playing") : (ar ? "متوقف مؤقتًا" : "Paused")) : (ar ? "لا توجد أغنية" : "Nothing playing")}</Badge>
        </div>
        {track && !track.idle && track.track ? (
          <div className="flex items-center gap-4">
            {track.track.artwork ? <img src={track.track.artwork} alt="" className="size-20 rounded-xl object-cover" /> : <div className="grid size-20 place-items-center rounded-xl bg-card"><Music2 /></div>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{track.track.title}</p>
              <p className="truncate text-sm text-muted">{track.track.artist}</p>
              <p className="truncate text-xs text-faint">{track.track.album}</p>
              <p className="mt-1 text-xs text-faint">{track.track.appName} · {track.device?.name}</p>
              {track.durationMs ? <p className="mt-1 text-xs tabular-nums text-faint">{format(track.progressMs ?? 0)} / {format(track.durationMs)}</p> : null}
            </div>
          </div>
        ) : <p className="rounded-xl bg-card p-4 text-sm text-muted">{ar ? "شغّل الموسيقى على جهاز مربوط، وستظهر هنا تلقائيًا." : "Start music on a paired device and it will appear here automatically."}</p>}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">{ar ? "ربط جهاز" : "Pair a device"}</h2>
          <p className="mt-1 text-sm text-muted">{ar ? "أنشئ رمزًا خاصًا بجهازك. الرمز يسمح له بإرسال بيانات الأغنية إلى حسابك فقط." : "Create a private token for a device. It can only send now-playing metadata to your account."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => pair("android")}><Smartphone className="size-4" /> {ar ? "ربط Android" : "Pair Android"}</Button>
          <Button disabled={busy} onClick={() => pair("windows")}><Monitor className="size-4" /> {ar ? "ربط Windows" : "Pair Windows"}</Button>
        </div>
        {pairing && <div className="space-y-2 rounded-xl border border-line bg-card p-3">
          <p className="text-sm font-medium">{ar ? "رمز الجهاز — انسخه واحفظه الآن" : "Device token — copy and save it now"}</p>
          <code className="block break-all text-xs">{pairing.token}</code>
          <Button size="sm" variant="glass" onClick={copyToken}><Copy className="size-4" /> {ar ? "نسخ الرمز" : "Copy token"}</Button>
          <p className="text-xs text-muted">{ar ? "لن يظهر الرمز مرة أخرى بعد مغادرة الصفحة. لا تشاركه مع أي شخص." : "This token is shown only once. Do not share it."}</p>
        </div>}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{ar ? "الأجهزة المرتبطة" : "Paired devices"}</h3>
          {devices.length ? devices.map((d) => <div key={d.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
            {d.platform === "android" ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.deviceName}</p><p className="text-xs text-muted">{d.platform} · {new Date(d.updatedAt).toLocaleString(ar ? "ar-EG" : "en-US")}</p></div>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(d.id)} aria-label={ar ? "إلغاء ربط الجهاز" : "Revoke device"}><Trash2 className="size-4" /></Button>
          </div>) : <p className="text-sm text-muted">{ar ? "لم يتم ربط أي جهاز بعد." : "No devices paired yet."}</p>}
        </div>
      </Card>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
      <p className="text-xs text-muted">{ar ? "ملاحظة: هذه واجهة الربط والخادم. يلزم تثبيت مكوّن OSSv2 الأصلي على Android أو Windows ومنحه صلاحية جلسات الوسائط حتى يرسل بيانات التشغيل." : "Note: this is the pairing UI and server. The OSSv2 native component must be installed on Android or Windows and granted media-session access before it can send playback metadata."}</p>
    </div>
  );
}
