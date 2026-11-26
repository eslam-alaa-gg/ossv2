import { redirect } from "next/navigation";

export default async function MusicBridgePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pair = params.pair === "android" ? "&pair=android" : "";
  redirect(`/music?tab=detection${pair}`);
}
