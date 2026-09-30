import { resolveCharacterVisual } from "@ttg/game";

type VisualCharacter = {
  id?: string | null;
  name?: string | null;
  appearanceKey?: string | null;
  avatar?: string | null;
};

type CharacterVisualProps = {
  character: VisualCharacter;
  mode?: "avatar" | "portrait" | "fullBody";
  size?: number;
  className?: string;
  priority?: boolean;
};

export function CharacterVisual({ character, mode = "avatar", size = 48, className = "", priority = false }: CharacterVisualProps) {
  const visual = resolveCharacterVisual(character);
  const appearance = visual.appearance;
  const src = mode === "fullBody" ? visual.image : visual.avatar;
  const objectPosition = appearance ? `${appearance.focalPoint.x}% ${appearance.focalPoint.y}%` : "50% 20%";
  const style = mode === "avatar" ? { width: size, height: size, objectPosition } : { objectPosition };
  if (!src) {
    return (
      <div className={`character-visual character-visual-${mode} character-visual-fallback ${className}`} style={style}>
        {visual.initials}
      </div>
    );
  }
  return (
    <div className={`character-visual character-visual-${mode} ${className}`} style={mode === "avatar" ? { width: size, height: size } : undefined}>
      <img src={src} alt={character.name ? `Ngoại hình ${character.name}` : "Ngoại hình nhân vật"} style={style} loading={priority ? "eager" : "lazy"} />
    </div>
  );
}
