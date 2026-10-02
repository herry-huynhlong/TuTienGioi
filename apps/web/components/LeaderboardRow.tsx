import type { CSSProperties, ReactNode } from "react";
import { getLeaderboardCinematic } from "@/lib/leaderboardCinematics";
import type { RankVisual } from "@/lib/leaderboardWings";
import { CinematicBackground } from "./CinematicBackground";
import { SectEmblem } from "./SectEmblem";
import { WingedAvatar } from "./WingedAvatar";

export type LeaderboardTheme = "gold" | "frost" | "ember" | "jade" | "violet" | "normal";
export type LeaderboardKind = "cultivation" | "wealth" | "sect";

export type LeaderboardEntry = {
  rank: number;
  avatar: ReactNode;
  name: string;
  realm: string;
  cultivation: string;
  sect: { type: "sect"; name: string; iconKey?: string | null } | { type: "independent" };
  fame: string;
  metricLabel?: string | undefined;
  metricValue?: string | undefined;
  title?: string | null | undefined;
  theme: LeaderboardTheme;
  rankVisual?: RankVisual | null;
  kind?: LeaderboardKind | undefined;
  memberCount?: number | undefined;
  leaderName?: string | undefined;
  background?: string | null | undefined;
};

export function LeaderboardHeroCard(props: LeaderboardEntry) {
  if (props.kind === "sect") return <LeaderboardSectHeroCard {...props} />;
  const metricLabel = props.metricLabel ?? "Tu vi";
  const metricValue = props.metricValue ?? props.cultivation;
  return (
    <article className="lb-hero-card" data-theme={props.theme} data-rank={props.rank}>
      <BackgroundLayer />
      <EnvironmentLayer />
      <CinematicSceneLayer theme={props.theme} rank={props.rank} />
      <ParticleLayer theme={props.theme} count={props.rank === 1 ? 18 : 14} />
      <BorderFXLayer />

      <div className="lb-hero-character-layer">
        <RankMedallion rank={props.rank} hero />
        <CharacterPortrait avatar={props.avatar} rankVisual={props.rankVisual} hero />
        <div className="lb-hero-nameplate">
          <strong>{props.name}</strong>
          <span>{props.title || "Tán tu"}</span>
        </div>
      </div>

      <div className="lb-hero-content-layer">
        <div className="lb-hero-realm">
          <span>Cảnh giới</span>
          <strong>{props.realm}</strong>
        </div>
      </div>

      <div className="lb-hero-stat-layer">
        {props.kind === "wealth" ? <MetricStat label={metricLabel} value={metricValue} hero /> : null}
        <SectCrest sect={props.sect} hero />
        <div className="lb-fame-seal">
          <span>Danh vọng</span>
          <strong>{props.fame}</strong>
        </div>
      </div>

      <ForegroundLayer />
    </article>
  );
}

export function LeaderboardCompactCard(props: LeaderboardEntry) {
  if (props.kind === "sect") return <LeaderboardSectCompactCard {...props} />;
  const metricLabel = props.kind === "wealth" ? props.metricLabel ?? "Tài bảo" : "Cảnh giới";
  const metricValue = props.kind === "wealth" ? props.metricValue ?? props.cultivation : props.realm;
  return (
    <article className="lb-compact-card" data-theme={props.theme}>
      <BackgroundLayer compact />
      <ParticleLayer theme={props.theme} count={5} compact />

      <div className="lb-compact-main">
        <RankMedallion rank={props.rank} />
        <CharacterPortrait avatar={props.avatar} rankVisual={props.rankVisual} />
        <div className="lb-compact-identity">
          <strong>{props.name}</strong>
          <span>{props.title || "Tán tu"}</span>
        </div>
      </div>

      <div className="lb-compact-meta">
        <div>
          <span>{metricLabel}</span>
          <strong>{metricValue}</strong>
        </div>
        <div>
          <span>{props.sect.type === "sect" ? "Tông môn" : ""}</span>
          <strong>{props.sect.type === "sect" ? props.sect.name : "Tán tu"}</strong>
        </div>
        <div>
          <span>Danh vọng</span>
          <strong>{props.fame}</strong>
        </div>
      </div>
    </article>
  );
}

function LeaderboardSectHeroCard(props: LeaderboardEntry) {
  return (
    <article className="lb-hero-card lb-sect-hero-card" data-theme={props.theme} data-rank={props.rank} style={props.background ? { "--sect-bg": `url("${props.background}")` } as CSSProperties : undefined}>
      <BackgroundLayer />
      <EnvironmentLayer />
      <ParticleLayer theme={props.theme} count={props.rank === 1 ? 18 : 14} />
      <BorderFXLayer />

      <div className="lb-sect-hero-emblem">
        <RankMedallion rank={props.rank} hero />
        <SectCrest sect={props.sect} hero />
      </div>

      <div className="lb-hero-content-layer">
        <div className="lb-hero-nameplate">
          <strong>{props.name}</strong>
          <span>{props.realm}</span>
        </div>
      </div>

      <div className="lb-hero-stat-layer">
        <MetricStat label="Uy danh" value={props.fame} hero />
        <div className="lb-fame-seal">
          <span>Tông chủ</span>
          <strong>{props.leaderName ?? "Chưa rõ"}</strong>
        </div>
        <div className="lb-fame-seal">
          <span>Thành viên</span>
          <strong>{props.memberCount?.toLocaleString("vi-VN") ?? "0"}</strong>
        </div>
      </div>

      <ForegroundLayer />
    </article>
  );
}

function LeaderboardSectCompactCard(props: LeaderboardEntry) {
  return (
    <article className="lb-compact-card lb-sect-compact-card" data-theme={props.theme}>
      <BackgroundLayer compact />
      <ParticleLayer theme={props.theme} count={5} compact />
      <div className="lb-compact-main">
        <RankMedallion rank={props.rank} />
        <SectCrest sect={props.sect} />
        <div className="lb-compact-identity">
          <strong>{props.name}</strong>
          <span>{props.realm}</span>
        </div>
      </div>
      <div className="lb-compact-meta">
        <div>
          <span>Uy danh</span>
          <strong>{props.fame}</strong>
        </div>
        <div>
          <span>Tông chủ</span>
          <strong>{props.leaderName ?? "Chưa rõ"}</strong>
        </div>
        <div>
          <span>Thành viên</span>
          <strong>{props.memberCount?.toLocaleString("vi-VN") ?? "0"}</strong>
        </div>
      </div>
    </article>
  );
}

function BackgroundLayer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "lb-background-layer lb-background-layer-compact" : "lb-background-layer"} aria-hidden>
      <span className="lb-bg-vignette" />
      <span className="lb-bg-depth lb-bg-depth-a" />
      <span className="lb-bg-depth lb-bg-depth-b" />
    </div>
  );
}

function EnvironmentLayer() {
  return (
    <div className="lb-environment-layer" aria-hidden>
      <span className="lb-cloud lb-cloud-a" />
      <span className="lb-cloud lb-cloud-b" />
      <span className="lb-aura-river lb-aura-river-a" />
      <span className="lb-aura-river lb-aura-river-b" />
      <span className="lb-aura-river lb-aura-river-c" />
      <span className="lb-sanctum" />
    </div>
  );
}

function CinematicSceneLayer({ theme, rank }: { theme: LeaderboardTheme; rank: number }) {
  const cinematic = getLeaderboardCinematic(rank, theme);

  return (
    <div className="lb-cinematic-layer" data-theme={cinematic.theme} aria-hidden>
      <CinematicBackground
        webm={cinematic.webm}
        mp4={cinematic.mp4}
        poster={cinematic.poster}
        label={cinematic.label}
        missingLabel={`MISSING: ${cinematic.webm}`}
        preload={cinematic.preload}
      />
      <span className="lb-cinematic-fallback" />
      <span className="lb-cinematic-depth lb-cinematic-depth-a" />
      <span className="lb-cinematic-depth lb-cinematic-depth-b" />
    </div>
  );
}

function ParticleLayer({ theme, count, compact = false }: { theme: LeaderboardTheme; count: number; compact?: boolean }) {
  return (
    <div className={compact ? "lb-particle-layer lb-particle-layer-compact" : "lb-particle-layer"} data-theme={theme} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} style={{ "--particle-index": index } as CSSProperties} />
      ))}
    </div>
  );
}

function ForegroundLayer() {
  return (
    <div className="lb-foreground-layer" aria-hidden>
      <span className="lb-light-sweep" />
    </div>
  );
}

function BorderFXLayer() {
  return (
    <div className="lb-border-fx-layer" aria-hidden>
      <span className="lb-corner lb-corner-tl" />
      <span className="lb-corner lb-corner-tr" />
      <span className="lb-corner lb-corner-bl" />
      <span className="lb-corner lb-corner-br" />
    </div>
  );
}

function CharacterPortrait({ avatar, rankVisual, hero = false }: { avatar: ReactNode; rankVisual?: RankVisual | null | undefined; hero?: boolean }) {
  const portrait = (
    <div className={hero ? "lb-character-portrait lb-character-portrait-hero" : "lb-character-portrait"}>
      <span className="lb-portrait-halo" aria-hidden />
      <div className="lb-portrait-frame">{avatar}</div>
    </div>
  );

  if (!rankVisual) return portrait;

  return (
    <WingedAvatar avatar={portrait} rankVisual={rankVisual} size={hero ? "xl" : "md"} animated={hero} className="lb-winged-avatar" />
  );
}

function RankMedallion({ rank, hero = false }: { rank: number; hero?: boolean }) {
  return (
    <div className={hero ? "lb-rank-medallion lb-rank-medallion-hero" : "lb-rank-medallion"} aria-label={`Hạng ${rank}`}>
      <span className="lb-rank-ring" aria-hidden />
      <strong>{rank}</strong>
    </div>
  );
}

function MetricStat({ label, value, hero = false }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className={hero ? "lb-cultivation-stat lb-cultivation-stat-hero" : "lb-cultivation-stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectCrest({ sect, hero = false }: { sect: LeaderboardEntry["sect"]; hero?: boolean }) {
  const isSect = sect.type === "sect";
  return (
    <div className={hero ? "lb-sect-crest lb-sect-crest-hero" : "lb-sect-crest"} data-sect-type={sect.type}>
      <span>{isSect ? "Tông môn" : ""}</span>
      {isSect ? (
        <SectEmblem iconKey={sect.iconKey} size={hero ? "lg" : "sm"} />
      ) : (
        <SectEmblem type="independent" size={hero ? "lg" : "sm"} />
      )}
      <strong>{isSect ? sect.name : "Tán tu"}</strong>
    </div>
  );
}
