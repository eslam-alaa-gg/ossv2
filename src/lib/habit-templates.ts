// Client-safe copy of the predefined habit templates (mirrors src/lib/server/habits.ts).
export const PREDEFINED_HABITS_CLIENT = [
  { key: "water", name: "Drink Water", icon: "droplets", kind: "water", target: 2000, unit: "ml", description: "Stay hydrated through the day." },
  { key: "read", name: "Read Books", icon: "book-open", kind: "reading", target: 20, unit: "pages", description: "Read a little every day." },
  { key: "learn", name: "Learn Something New", icon: "lightbulb", kind: "learning", target: 1, unit: "entry", description: "Record one thing you learned." },
  { key: "exercise", name: "Exercise", icon: "dumbbell", kind: "standard", target: 1, unit: "", description: "Move your body." },
  { key: "walk", name: "Walk", icon: "footprints", kind: "standard", target: 1, unit: "", description: "Get outside for a walk." },
  { key: "stretch", name: "Stretch", icon: "move", kind: "standard", target: 1, unit: "", description: "A few minutes of stretching." },
  { key: "meditate", name: "Meditation", icon: "flower-2", kind: "standard", target: 1, unit: "", description: "A quiet moment of mindfulness." },
  { key: "sleep", name: "Sleep Routine", icon: "moon", kind: "standard", target: 1, unit: "", description: "Wind down and sleep on schedule." },
  { key: "skill", name: "Practice a Skill", icon: "palette", kind: "standard", target: 1, unit: "", description: "Deliberate practice of something you're building." },
  { key: "screen", name: "Reduce Screen Time", icon: "smartphone", kind: "standard", target: 1, unit: "", description: "Stay under your screen-time intention." },
] as const;

export const HABIT_ICONS = ["sparkles", "droplets", "book-open", "lightbulb", "dumbbell", "footprints", "move", "flower-2", "moon", "palette", "smartphone", "heart", "coffee", "apple", "music"] as const;
