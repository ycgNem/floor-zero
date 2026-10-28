import { SKILL_NAMES } from '../data/ids';
import { ITEMS, type ItemId } from '../data/items';
import { RECIPES, type RecipeDef, type RecipeId } from '../data/recipes';
import type { Game } from '../game';

function inputs(recipe: RecipeDef): [ItemId, number][] {
  return Object.entries(recipe.inputs) as [ItemId, number][];
}

/** Why a recipe can't be made right now, or null if it can. */
export function recipeBlocker(game: Game, id: RecipeId): string | null {
  const recipe: RecipeDef = RECIPES[id];
  if (recipe.requires && !game.hasFlag(recipe.requires)) return 'Needs a discovery';
  if (game.progress.level(recipe.skill) < recipe.level) return `Needs ${SKILL_NAMES[recipe.skill]} ${recipe.level}`;
  for (const [item, count] of inputs(recipe)) {
    if (game.progress.count(item) < count) return `Needs ${count} ${ITEMS[item].name.toLowerCase()}`;
  }
  if ((recipe.cost ?? 0) > game.progress.money) return `Needs ${recipe.cost} bells`;
  const out = recipe.output;
  if ('equip' in out && game.state.player.equipment[out.equip] === out.item) return 'Already owned';
  return null;
}

export function inputsText(game: Game, id: RecipeId): string {
  const recipe: RecipeDef = RECIPES[id];
  const parts = inputs(recipe).map(([item, count]) => `${count} ${ITEMS[item].name.toLowerCase()} (${game.progress.count(item)})`);
  if (recipe.cost) parts.push(`${recipe.cost} bells`);
  return parts.join(' · ');
}

export function craft(game: Game, id: RecipeId): boolean {
  const blocker = recipeBlocker(game, id);
  if (blocker) {
    game.hud.toast(blocker, 'warn');
    return false;
  }
  const recipe: RecipeDef = RECIPES[id];
  for (const [item, count] of inputs(recipe)) game.progress.take(item, count);
  if (recipe.cost) game.progress.addMoney(-recipe.cost);
  const out = recipe.output;
  if ('equip' in out) {
    game.state.player.equipment[out.equip] = out.item;
    game.hud.toast(`${recipe.station === 'forge' ? 'Forged' : 'Made'}: ${ITEMS[out.item].name}.`, 'good');
  } else {
    game.progress.give(out.item, out.count);
  }
  game.progress.addXp(recipe.skill, recipe.xp);
  if (recipe.sets) game.setFlag(recipe.sets);
  return true;
}

/** How many times a recipe could be made from what you carry. */
export function maxCrafts(game: Game, id: RecipeId): number {
  const recipe: RecipeDef = RECIPES[id];
  let max = Infinity;
  for (const [item, count] of inputs(recipe)) max = Math.min(max, Math.floor(game.progress.count(item) / count));
  if (recipe.cost) max = Math.min(max, Math.floor(game.progress.money / recipe.cost));
  return Number.isFinite(max) ? max : 0;
}
