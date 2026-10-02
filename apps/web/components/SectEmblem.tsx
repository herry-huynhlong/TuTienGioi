import { sectIconAssetPath } from "@ttg/game";

type SectEmblemProps = {
  iconKey?: string | null | undefined;
  type?: "sect" | "independent";
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
};

export function SectEmblem({ iconKey, type = "sect", size = "md", label, className = "" }: SectEmblemProps) {
  const image = type === "independent" ? "/sects/icons/tan-tu.webp" : sectIconAssetPath(iconKey);
  const accessibleLabel = label ?? (type === "independent" ? "Biểu tượng Tán Tu" : "Biểu tượng tông môn");
  return (
    <span className={`sect-emblem sect-emblem-${size} ${className}`} aria-label={accessibleLabel}>
      <img src={image} alt="" className="sect-emblem-img" loading="lazy" />
    </span>
  );
}
