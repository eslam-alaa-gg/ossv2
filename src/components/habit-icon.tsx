import { Apple, BookOpen, Coffee, Droplets, Dumbbell, Flower2, Footprints, Heart, Lightbulb, Moon, Move, Music, Palette, Smartphone, Sparkles, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles, droplets: Droplets, "book-open": BookOpen, lightbulb: Lightbulb, dumbbell: Dumbbell, footprints: Footprints, move: Move,
  "flower-2": Flower2, moon: Moon, palette: Palette, smartphone: Smartphone, heart: Heart, coffee: Coffee, apple: Apple, music: Music,
};
export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const I = MAP[name] ?? Sparkles;
  return <I className={className ?? "size-5"} />;
}
