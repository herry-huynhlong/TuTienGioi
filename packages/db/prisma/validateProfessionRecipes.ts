import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { coreProfessionRecipes } from "./professionSeedData";
import { professionItemVisualPrompts } from "./itemVisualPrompts";

const validRanks = new Set(["APPRENTICE", "ADEPT", "EXPERT", "MASTER", "GRANDMASTER"]);
const validProfessions = new Set(["alchemy", "forging", "talisman", "formation"]);
const validStations = new Set(["ALCHEMY_FURNACE", "FORGE", "TALISMAN_TABLE", "FORMATION_ALTAR"]);
const repoRoot = resolve(process.cwd(), "../..");
const itemKeys = new Set<string>();
const errors: string[] = [];

for (const recipe of coreProfessionRecipes) {
  if (!validProfessions.has(recipe.profession)) errors.push(`${recipe.key}: invalid profession ${recipe.profession}`);
  if (!validRanks.has(recipe.rank)) errors.push(`${recipe.key}: invalid rank ${recipe.rank}`);
  if (!validStations.has(recipe.station)) errors.push(`${recipe.key}: invalid station ${recipe.station}`);
  if (!recipe.outputKey) errors.push(`${recipe.key}: missing outputKey`);
  if (recipe.minutes <= 0) errors.push(`${recipe.key}: craft minutes must be > 0`);
  if (recipe.exp < 0) errors.push(`${recipe.key}: exp must be >= 0`);
  if (recipe.fee < 0) errors.push(`${recipe.key}: fee must be >= 0`);
  if (!recipe.ingredients.length) errors.push(`${recipe.key}: missing ingredients`);
  itemKeys.add(recipe.outputKey);
  for (const ingredient of recipe.ingredients) {
    itemKeys.add(ingredient.key);
    if (!ingredient.key) errors.push(`${recipe.key}: ingredient missing key`);
    if (!ingredient.name) errors.push(`${recipe.key}:${ingredient.key}: ingredient missing name`);
    if (!Number.isInteger(ingredient.qty) || ingredient.qty <= 0) errors.push(`${recipe.key}:${ingredient.key}: quantity must be > 0`);
  }
}

const promptByCode = new Map(professionItemVisualPrompts.map((entry) => [entry.itemCode, entry]));
for (const key of itemKeys) {
  const prompt = promptByCode.get(key);
  if (!prompt) {
    errors.push(`${key}: missing visual prompt`);
    continue;
  }
  if (!prompt.visualKey || prompt.visualKey.includes("//")) errors.push(`${key}: invalid visualKey`);
  const fallbackPath = resolve(repoRoot, "apps/web/public/items", `${prompt.fallbackKey}.webp`);
  if (!existsSync(fallbackPath)) errors.push(`${key}: fallback asset missing ${prompt.fallbackKey}.webp`);
}

const duplicateRecipeKeys = coreProfessionRecipes.map((recipe) => recipe.key).filter((key, index, arr) => arr.indexOf(key) !== index);
if (duplicateRecipeKeys.length) errors.push(`duplicate recipe keys: ${duplicateRecipeKeys.join(", ")}`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  recipes: coreProfessionRecipes.length,
  itemKeys: itemKeys.size,
  prompts: professionItemVisualPrompts.length,
  outputs: new Set(coreProfessionRecipes.map((recipe) => recipe.outputKey)).size,
  ingredients: new Set(coreProfessionRecipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.key))).size
}, null, 2));
