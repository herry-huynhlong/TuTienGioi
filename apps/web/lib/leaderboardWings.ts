import type { LeaderboardTheme } from "@/components/LeaderboardRow";

export type LeaderboardWingConfig = {
  rank: 1 | 2 | 3;
  theme: "gold" | "ice" | "fire";
  webm: string;
  mp4: string;
  poster: string;
  label: string;
  preload: "auto" | "metadata" | "none";
};

export const LEADERBOARD_WINGS: Record<1 | 2 | 3, LeaderboardWingConfig> = {
  1: {
    rank: 1,
    theme: "gold",
    webm: "/leaderboard/wings/rank1-divine-wings.webm",
    mp4: "/leaderboard/wings/rank1-divine-wings.mp4",
    poster: "/leaderboard/wings/rank1-divine-wings-poster.webp",
    label: "Thiên Dực hạng 1",
    preload: "auto"
  },
  2: {
    rank: 2,
    theme: "ice",
    webm: "/leaderboard/wings/rank2-ice-wings.webm",
    mp4: "/leaderboard/wings/rank2-ice-wings.mp4",
    poster: "/leaderboard/wings/rank2-ice-wings-poster.webp",
    label: "Băng Nguyệt Dực hạng 2",
    preload: "metadata"
  },
  3: {
    rank: 3,
    theme: "fire",
    webm: "/leaderboard/wings/rank3-phoenix-wings.webm",
    mp4: "/leaderboard/wings/rank3-phoenix-wings.mp4",
    poster: "/leaderboard/wings/rank3-phoenix-wings-poster.webp",
    label: "Phượng Hỏa Dực hạng 3",
    preload: "metadata"
  }
};

export function getLeaderboardWing(rank: number, theme: LeaderboardTheme) {
  if (rank === 1 || rank === 2 || rank === 3) return LEADERBOARD_WINGS[rank];
  return null;
}
