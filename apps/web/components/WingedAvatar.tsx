import type { ReactNode } from "react";
import type { RankVisual } from "@/lib/leaderboardWings";
import { getWingForRankVisual } from "@/lib/leaderboardWings";
import { CinematicBackground } from "./CinematicBackground";

type WingedAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

type WingedAvatarProps = {
  avatar: ReactNode;
  rankVisual?: RankVisual | null;
  size?: WingedAvatarSize;
  animated?: boolean;
  className?: string;
};

export function WingedAvatar({ avatar, rankVisual, size = "md", animated = true, className = "" }: WingedAvatarProps) {
  const wing = getWingForRankVisual(rankVisual);
  const classNames = ["winged-avatar", `winged-avatar-${size}`, wing ? "winged-avatar-active" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classNames} data-wing-type={wing?.wingType ?? "none"} data-wing-tier={rankVisual?.tier ?? "none"}>
      {wing ? (
        <div className="winged-avatar-video" aria-hidden>
          {animated ? (
            <CinematicBackground
              webm={wing.webm}
              mp4={wing.mp4}
              poster={wing.poster}
              label={wing.label}
              missingLabel={`MISSING: ${wing.webm}`}
              preload={wing.preload}
            />
          ) : (
            <img className="winged-avatar-poster" src={wing.poster} alt="" loading="lazy" decoding="async" />
          )}
        </div>
      ) : null}
      <div className="winged-avatar-aura" aria-hidden />
      <div className="winged-avatar-core">{avatar}</div>
    </div>
  );
}
