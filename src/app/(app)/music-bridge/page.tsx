import { Suspense } from "react";
import { MusicBridgePanel } from "@/components/music-bridge";

export default function MusicBridgePage() {
  return <Suspense fallback={<div className="mx-auto max-w-3xl p-6"><div className="h-96 animate-pulse rounded-2xl bg-card" /></div>}><MusicBridgePanel /></Suspense>;
}
