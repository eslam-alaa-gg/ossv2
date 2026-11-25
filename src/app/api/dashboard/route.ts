import { handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { dashboardData } from "@/lib/server/overview";

export const dynamic = "force-dynamic";
export const GET = handle(async () => dashboardData(await requireUser()));
