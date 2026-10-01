import type { LeaderboardTheme } from "@/components/LeaderboardRow";

export type LeaderboardCinematicConfig = {
  rank: 1 | 2 | 3;
  theme: "gold" | "ice" | "fire";
  webm: string;
  mp4: string;
  poster: string;
  label: string;
  preload: "auto" | "metadata" | "none";
};

export const LEADERBOARD_CINEMATICS: Record<1 | 2 | 3, LeaderboardCinematicConfig> = {
  1: {
    rank: 1,
    theme: "gold",
    webm: "/leaderboard/cinematics/rank1-golden-dragon.webm",
    mp4: "/leaderboard/cinematics/rank1-golden-dragon.mp4",
    poster: "/leaderboard/posters/rank1-golden-dragon-poster.webp",
    label: "Cinematic Kim Long hạng 1",
    preload: "auto"
  },
  2: {
    rank: 2,
    theme: "ice",
    webm: "/leaderboard/cinematics/rank2-ice-moon-dragon.webm",
    mp4: "/leaderboard/cinematics/rank2-ice-moon-dragon.mp4",
    poster: "/leaderboard/posters/rank2-ice-moon-dragon-poster.webp",
    label: "Cinematic Băng Long hạng 2",
    preload: "metadata"
  },
  3: {
    rank: 3,
    theme: "fire",
    webm: "/leaderboard/cinematics/rank3-fire-phoenix.webm",
    mp4: "/leaderboard/cinematics/rank3-fire-phoenix.mp4",
    poster: "/leaderboard/posters/rank3-fire-phoenix-poster.webp",
    label: "Cinematic Hỏa Phượng hạng 3",
    preload: "metadata"
  }
};

export function getLeaderboardCinematic(rank: number, theme: LeaderboardTheme) {
  if (rank === 1 || rank === 2 || rank === 3) return LEADERBOARD_CINEMATICS[rank];
  return {
    rank,
    theme,
    webm: `/leaderboard/cinematics/rank${rank}-ambient.webm`,
    mp4: `/leaderboard/cinematics/rank${rank}-ambient.mp4`,
    poster: `/leaderboard/posters/rank${rank}-ambient-poster.webp`,
    label: `Cinematic hạng ${rank}`,
    preload: "none" as const
  };
}
