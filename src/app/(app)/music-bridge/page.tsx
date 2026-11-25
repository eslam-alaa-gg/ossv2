import { Suspense } from "react";
import { MusicBridgePanel } from "@/components/music-bridge";
import { Skeleton } from "@/components/ui";

export default function MusicBridgePage() {
  return <Suspense fallback={<div className="mx-auto max-w-3xl p-6"><Skeleton className="h-96" /></div>}><MusicBridgePanel /></Suspense>;
}
