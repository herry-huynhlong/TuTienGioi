export type LeaderboardRankTier = 1 | 2 | 3 | 4 | 5 | "normal";

export type LeaderboardRankVisual = {
  tier: LeaderboardRankTier;
  className: string;
  avatarClass: string;
  nameClass: string;
  rankClass: string;
  effectLevel: number;
  label: string | null;
  avatarSize: number;
};

const topRankVisuals: Record<number, LeaderboardRankVisual> = {
  1: { tier: 1, className: "leaderboard-row-tier-1", avatarClass: "leaderboard-avatar-tier-1", nameClass: "leaderboard-name-tier-1", rankClass: "leaderboard-rank-tier-1", effectLevel: 5, label: "Thiên Kiêu Đệ Nhất", avatarSize: 54 },
  2: { tier: 2, className: "leaderboard-row-tier-2", avatarClass: "leaderboard-avatar-tier-2", nameClass: "leaderboard-name-tier-2", rankClass: "leaderboard-rank-tier-2", effectLevel: 4, label: "Song Tuyệt", avatarSize: 48 },
  3: { tier: 3, className: "leaderboard-row-tier-3", avatarClass: "leaderboard-avatar-tier-3", nameClass: "leaderboard-name-tier-3", rankClass: "leaderboard-rank-tier-3", effectLevel: 3, label: "Tam Kiệt", avatarSize: 44 },
  4: { tier: 4, className: "leaderboard-row-tier-4", avatarClass: "leaderboard-avatar-tier-4", nameClass: "leaderboard-name-tier-4", rankClass: "leaderboard-rank-tier-4", effectLevel: 2, label: "Tứ Kiệt", avatarSize: 42 },
  5: { tier: 5, className: "leaderboard-row-tier-5", avatarClass: "leaderboard-avatar-tier-5", nameClass: "leaderboard-name-tier-5", rankClass: "leaderboard-rank-tier-5", effectLevel: 1, label: "Ngũ Kiệt", avatarSize: 40 }
};

const normalRankVisual: LeaderboardRankVisual = {
  tier: "normal",
  className: "leaderboard-row-normal",
  avatarClass: "leaderboard-avatar-normal",
  nameClass: "leaderboard-name-normal",
  rankClass: "leaderboard-rank-normal",
  effectLevel: 0,
  label: null,
  avatarSize: 36
};

export function getLeaderboardRankVisual(rank: number | null | undefined): LeaderboardRankVisual {
  if (!Number.isInteger(rank) || !rank || rank < 1) return normalRankVisual;
  return topRankVisuals[rank] ?? normalRankVisual;
}
