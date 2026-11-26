import { redirect } from "next/navigation";

export default function MusicBridgePage() {
  redirect("/music?tab=detection");
}
