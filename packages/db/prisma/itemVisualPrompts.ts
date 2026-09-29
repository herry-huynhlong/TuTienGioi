import { coreProfessionRecipes, type SeedProfessionRecipe } from "./professionSeedData";

export type ItemVisualPrompt = {
  itemCode: string;
  itemName: string;
  visualKey: string;
  category: string;
  prompt: string;
  negativePrompt: string;
  targetFile: string;
  fallbackKey: string;
  generated: boolean;
};

function visualFolder(category: string, icon: string, equipSlot?: string) {
  if (icon === "pill") return "pill";
  if (icon === "sword") return "weapon";
  if (icon === "armor" || icon === "boots") return "armor";
  if (icon === "ring" || icon === "talisman" || icon === "artifact") return "accessory";
  if (icon === "scroll" || icon === "paper") return "talisman";
  if (icon === "formation" || icon === "flag") return "formation";
  if (icon === "herb" || icon === "leaf" || icon === "root" || icon === "flower" || icon === "mushroom") return "herb";
  if (icon === "fruit") return "fruit";
  if (icon === "ore" || icon === "metal") return "ore";
  if (icon === "crystal" || icon === "gem" || icon === "core") return "crystal";
  if (icon === "hide" || icon === "fang" || icon === "bone" || icon === "blood" || icon === "scale" || icon === "shell") return "beast";
  if (category === "EQUIPMENT" && equipSlot === "WEAPON") return "weapon";
  if (category === "EQUIPMENT") return "armor";
  return "material";
}

function fallbackKey(folder: string, icon: string) {
  if (folder === "pill") return "default-pill";
  if (folder === "herb" || folder === "fruit") return "default-herb";
  if (folder === "ore") return "default-ore";
  if (folder === "crystal") return "default-crystal";
  if (folder === "weapon") return "default-weapon";
  if (folder === "armor") return "default-armor";
  if (folder === "talisman" || icon === "paper") return "default-talisman";
  if (folder === "formation") return "default-formation";
  if (folder === "accessory") return "default-artifact";
  return "default-material";
}

function subjectPrompt(name: string, category: string, icon: string, subType: string) {
  const base = "premium RPG inventory item icon, Chinese xianxia cultivation fantasy, semi-realistic, highly detailed, centered object, dark neutral background, subtle spiritual glow, no text, no watermark, no logo, no character, no UI frame";
  if (icon === "pill") return `highly detailed xianxia cultivation pill named ${name}, ancient Chinese alchemy elixir, distinctive shape and spiritual aura, ${base}`;
  if (icon === "sword") return `ancient Chinese xianxia fantasy sword named ${name}, forged spiritual weapon, intricate metal details, ${base}`;
  if (icon === "armor") return `xianxia cultivation armor named ${name}, protective spiritual battle armor, not a robe, ${base}`;
  if (icon === "boots") return `xianxia cultivation boots named ${name}, enchanted footwear with wind aura, ${base}`;
  if (icon === "ring") return `xianxia magical ring named ${name}, spiritual jewelry artifact, gemstone glow, ${base}`;
  if (icon === "talisman" || icon === "artifact") return `xianxia magical artifact named ${name}, ancient cultivation accessory, carved jade and metal details, ${base}`;
  if (icon === "scroll" || icon === "paper") return `ancient xianxia talisman paper named ${name}, mystical cultivation runes as abstract marks, glowing spiritual ink, no readable text, ${base}`;
  if (icon === "formation" || icon === "flag") return `miniature xianxia formation array artifact named ${name}, formation disk and small flags, glowing runic patterns, ${base}`;
  if (icon === "herb" || icon === "leaf" || icon === "root" || icon === "flower" || icon === "mushroom" || icon === "fruit") return `rare xianxia spiritual medicinal plant material named ${name}, ${subType}, detailed leaves roots petals or fruit, ancient cultivation herb, ${base}`;
  if (icon === "ore" || icon === "metal") return `xianxia mystical ore chunk named ${name}, ancient cultivation forging material, mineral veins and spiritual glow, ${base}`;
  if (icon === "crystal" || icon === "gem" || icon === "core") return `xianxia spiritual crystal material named ${name}, ancient cultivation essence stone, translucent glow, ${base}`;
  if (icon === "hide" || icon === "fang" || icon === "bone" || icon === "blood" || icon === "scale" || icon === "shell") return `xianxia beast material named ${name}, ancient monster crafting component, ${subType}, spiritual residue glow, ${base}`;
  return `ancient xianxia crafting material named ${name}, ${category}, ${subType}, ${base}`;
}

function outputEntries(recipe: SeedProfessionRecipe): ItemVisualPrompt {
  const folder = visualFolder(recipe.category, recipe.icon, recipe.equipSlot);
  const visualKey = `${folder}/${recipe.outputKey}`;
  return {
    itemCode: recipe.outputKey,
    itemName: recipe.outputName,
    visualKey,
    category: recipe.category,
    prompt: subjectPrompt(recipe.outputName, recipe.category, recipe.icon, recipe.subType),
    negativePrompt: "text, watermark, logo, UI frame, readable characters, modern objects, cartoon, chibi, blurry, low detail",
    targetFile: `apps/web/public/items/${visualKey}.webp`,
    fallbackKey: fallbackKey(folder, recipe.icon),
    generated: false
  };
}

function ingredientEntries(recipe: SeedProfessionRecipe) {
  return recipe.ingredients.map((ingredient) => {
    const icon = ingredient.icon ?? "material";
    const subType = ingredient.subType ?? "Nguyên Liệu";
    const folder = visualFolder("MATERIAL", icon);
    const visualKey = `${folder}/${ingredient.key}`;
    return {
      itemCode: ingredient.key,
      itemName: ingredient.name,
      visualKey,
      category: "MATERIAL",
      prompt: subjectPrompt(ingredient.name, "MATERIAL", icon, subType),
      negativePrompt: "text, watermark, logo, UI frame, readable characters, modern objects, cartoon, chibi, blurry, low detail",
      targetFile: `apps/web/public/items/${visualKey}.webp`,
      fallbackKey: fallbackKey(folder, icon),
      generated: false
    } satisfies ItemVisualPrompt;
  });
}

export function buildProfessionItemVisualPrompts() {
  const byCode = new Map<string, ItemVisualPrompt>();
  for (const recipe of coreProfessionRecipes) {
    byCode.set(recipe.outputKey, outputEntries(recipe));
    for (const entry of ingredientEntries(recipe)) {
      if (!byCode.has(entry.itemCode)) byCode.set(entry.itemCode, entry);
    }
  }
  return [...byCode.values()].sort((a, b) => a.visualKey.localeCompare(b.visualKey));
}

export const professionItemVisualPrompts = buildProfessionItemVisualPrompts();
