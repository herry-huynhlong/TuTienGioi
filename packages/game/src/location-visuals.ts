export type LocationVisualInput = {
  kind?: string | null;
  biome?: string | null;
  visualKey?: string | null;
  backgroundImage?: string | null;
  imagePosition?: string | null;
};

export const locationVisualFallbacks: Record<string, string> = {
  city: "/locations/city/xianxia-city.webp",
  cultivation_city: "/locations/city/xianxia-city.webp",
  district: "/locations/city/xianxia-city.webp",
  market: "/locations/city/xianxia-city.webp",
  gate: "/locations/city/xianxia-city.webp",
  forest: "/locations/forest/cultivation-forest.webp",
  bamboo_forest: "/locations/forest/bamboo-forest.webp",
  forest_edge: "/locations/forest/forest-edge.webp",
  monster_forest: "/locations/forest/monster-forest.webp",
  mountain: "/locations/mountain/immortal-mountain.webp",
  sect: "/locations/sect/cultivation-sect.webp",
  village: "/locations/village/ancient-village.webp",
  cave: "/locations/cave/cultivation-cave.webp",
  ruins: "/locations/ruins/ancient-ruins.webp",
  wilderness: "/locations/wilderness/cultivation-wilderness.webp",
  road: "/locations/forest/forest-edge.webp",
  wilds: "/locations/forest/monster-forest.webp",
  sect_land: "/locations/sect/cultivation-sect.webp",
  valley: "/locations/mountain/immortal-mountain.webp",
  river: "/locations/forest/cultivation-forest.webp",
  harbor: "/locations/city/xianxia-city.webp",
  outpost: "/locations/village/ancient-village.webp",
  ruin: "/locations/ruins/ancient-ruins.webp",
  city_hub: "/locations/city/xianxia-city.webp"
};

export function resolveLocationBackground(location?: LocationVisualInput | null) {
  if (!location) return locationVisualFallbacks.wilderness;
  if (location.backgroundImage) return location.backgroundImage;
  if (location.visualKey) return `/locations/${location.visualKey}.webp`;
  const biome = location.biome ?? location.kind ?? "wilderness";
  return locationVisualFallbacks[biome] ?? locationVisualFallbacks[location.kind ?? ""] ?? locationVisualFallbacks.wilderness;
}

export function resolveLocationImagePosition(location?: LocationVisualInput | null) {
  return location?.imagePosition || "center center";
}
