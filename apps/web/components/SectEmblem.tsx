import { sectIconAssetPath } from "@ttg/game";

type SectEmblemProps = {
  iconKey?: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
};

export function SectEmblem({ iconKey, size = "md", label = "Biểu tượng tông môn", className = "" }: SectEmblemProps) {
  return (
    <span className={`sect-emblem sect-emblem-${size} ${className}`} aria-label={label}>
      <img src={sectIconAssetPath(iconKey)} alt="" className="sect-emblem-img" loading="lazy" />
    </span>
  );
}
