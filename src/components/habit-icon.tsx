import { AlarmClock, Apple, Bed, Bike, BookOpen, CalendarCheck, ClipboardCheck, Coffee, Droplets, Dumbbell, Flower2, Footprints, GraduationCap, Headphones, Heart, HeartHandshake, Languages, Leaf, Lightbulb, ListChecks, Moon, Move, Music, NotebookPen, NotebookTabs, Palette, Pencil, Smartphone, Sparkles, Sprout, Sun, Timer, Wallet, Brain, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles, droplets: Droplets, "book-open": BookOpen, lightbulb: Lightbulb, dumbbell: Dumbbell, footprints: Footprints, move: Move,
  "flower-2": Flower2, moon: Moon, palette: Palette, smartphone: Smartphone, heart: Heart, coffee: Coffee, apple: Apple, music: Music, bike: Bike, "notebook-pen": NotebookPen, "calendar-check": CalendarCheck, "graduation-cap": GraduationCap, "notebook-tabs": NotebookTabs, languages: Languages, "clipboard-check": ClipboardCheck, "heart-handshake": HeartHandshake, sun: Sun, "alarm-clock": AlarmClock, brain: Brain, leaf: Leaf, "list-checks": ListChecks, pencil: Pencil, timer: Timer, wallet: Wallet, bed: Bed, headphones: Headphones, sprout: Sprout,
};
export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const I = MAP[name] ?? Sparkles;
  return <I className={className ?? "size-5"} />;
}
