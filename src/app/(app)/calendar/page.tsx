"use client";
import { CalendarBoard } from "@/components/calendar-board";
import { useApp } from "@/components/providers";
import { PageHeader } from "@/components/ui";

export default function CalendarPage() {
  const { t } = useApp();
  return (
    <>
      <PageHeader title={t("Calendar")} subtitle={t("Tasks, deadlines, habits, challenges, focus sessions and milestones in one place")} />
      <CalendarBoard />
    </>
  );
}
