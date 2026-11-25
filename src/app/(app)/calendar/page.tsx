"use client";
import { CalendarBoard } from "@/components/calendar-board";
import { PageHeader } from "@/components/ui";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Tasks, deadlines, habits, challenges, focus sessions and milestones in one place" />
      <CalendarBoard />
    </>
  );
}
