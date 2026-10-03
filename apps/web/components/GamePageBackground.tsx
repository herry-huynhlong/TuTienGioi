import type { CSSProperties, ReactNode } from "react";

export type GamePageBackgroundType =
  | "sect"
  | "training"
  | "cultivation"
  | "adventure"
  | "quests"
  | "market"
  | "auction"
  | "profession"
  | "inventory"
  | "social";

export const gamePageBackgrounds: Record<GamePageBackgroundType, string> = {
  sect: "/assets/backgrounds/sect.webp",
  training: "/assets/backgrounds/training.webp",
  cultivation: "/assets/backgrounds/cultivation.webp",
  adventure: "/assets/backgrounds/adventure.webp",
  quests: "/assets/backgrounds/quests.webp",
  market: "/assets/backgrounds/market.webp",
  auction: "/assets/backgrounds/auction.webp",
  profession: "/assets/backgrounds/profession.webp",
  inventory: "/assets/backgrounds/inventory.webp",
  social: "/assets/backgrounds/social.webp"
};

type BackgroundStyle = CSSProperties & {
  "--game-page-bg": string;
};

export function GamePageBackground({ type, children }: { type: GamePageBackgroundType; children: ReactNode }) {
  return (
    <div className={`game-page-bg game-page-bg-${type}`} style={{ "--game-page-bg": `url("${gamePageBackgrounds[type]}")` } as BackgroundStyle}>
      {children}
    </div>
  );
}
