import { describe, expect, it } from "vitest";
import { calculateWealthScore, getLeaderboardRankVisual, isLeaderboardType } from "../src/index.js";

describe("leaderboard rank visuals", () => {
  it("maps top 1-5 to descending special tiers", () => {
    expect(getLeaderboardRankVisual(1).tier).toBe(1);
    expect(getLeaderboardRankVisual(1).effectLevel).toBeGreaterThan(getLeaderboardRankVisual(2).effectLevel);
    expect(getLeaderboardRankVisual(2).tier).toBe(2);
    expect(getLeaderboardRankVisual(3).tier).toBe(3);
    expect(getLeaderboardRankVisual(4).tier).toBe(4);
    expect(getLeaderboardRankVisual(5).tier).toBe(5);
  });

  it("falls back to normal for rank 6, zero, null, and invalid ranks", () => {
    expect(getLeaderboardRankVisual(6).tier).toBe("normal");
    expect(getLeaderboardRankVisual(0).tier).toBe("normal");
    expect(getLeaderboardRankVisual(null).tier).toBe("normal");
    expect(getLeaderboardRankVisual(undefined).tier).toBe("normal");
  });

  it("validates leaderboard categories and calculates wealth from server-owned currency", () => {
    expect(isLeaderboardType("cultivation")).toBe(true);
    expect(isLeaderboardType("wealth")).toBe(true);
    expect(isLeaderboardType("sect")).toBe(true);
    expect(isLeaderboardType("realm-name")).toBe(false);
    expect(calculateWealthScore({ linhThach: 1_000n, tienNgoc: 5n })).toBe(1_500n);
  });
});
