export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  language: string;
  timezone: string;
  dailyGoal: number;
  emailVerified: boolean;
  isDemo: boolean;
  onboarded: boolean;
  avatarVersion: number | null;
  createdAt: string;
};
