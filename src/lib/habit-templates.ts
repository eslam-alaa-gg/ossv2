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
  { key: "yoga", name: "Yoga", icon: "flower-2", kind: "standard", target: 1, unit: "", description: "Take a mindful movement break." },
  { key: "cycle", name: "Cycling", icon: "bike", kind: "standard", target: 1, unit: "", description: "Go for a bike ride." },
  { key: "journal", name: "Write in Journal", icon: "notebook-pen", kind: "standard", target: 1, unit: "", description: "Write a short journal entry." },
  { key: "plan", name: "Plan the Day", icon: "calendar-check", kind: "standard", target: 1, unit: "", description: "Choose a few priorities for today." },
  { key: "study", name: "Study Session", icon: "graduation-cap", kind: "standard", target: 1, unit: "", description: "Complete a focused study session." },
  { key: "review", name: "Review Notes", icon: "notebook-tabs", kind: "standard", target: 1, unit: "", description: "Review your notes." },
  { key: "language", name: "Practice a Language", icon: "languages", kind: "standard", target: 1, unit: "", description: "Practise a language skill." },
  { key: "tidy", name: "Tidy Workspace", icon: "clipboard-check", kind: "standard", target: 1, unit: "", description: "Reset your desk or study space." },
  { key: "gratitude", name: "Gratitude Journal", icon: "heart-handshake", kind: "standard", target: 1, unit: "", description: "Write down something you appreciate." },
] as const;

export const HABIT_ICONS = ["sparkles", "droplets", "book-open", "lightbulb", "dumbbell", "footprints", "move", "flower-2", "moon", "palette", "smartphone", "heart", "coffee", "apple", "music", "bike", "notebook-pen", "calendar-check", "graduation-cap", "notebook-tabs", "languages", "clipboard-check", "heart-handshake", "sun", "alarm-clock", "brain", "leaf", "list-checks", "pencil", "timer", "wallet", "bed", "headphones", "sprout"] as const;
