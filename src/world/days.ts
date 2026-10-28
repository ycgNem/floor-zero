import { createRng } from '../core/rng';
import { PROJECTS, type ProjectId } from '../data/projects';
import type { Game } from '../game';
import { builtBy } from '../items/projects';
import { describeCondition } from '../story/conditions';
import { wait } from '../ui/dom';

/** What changed overnight, before the area is rebuilt around it. Returns announcements for the morning. */
function overnight(game: Game): string[] {
  const state = game.state;
  const news: string[] = [];
  // Funded Town Works go up overnight.
  for (const id of Object.keys(PROJECTS) as ProjectId[]) {
    const def = PROJECTS[id];
    if (!game.hasFlag(def.flag) && builtBy(state.projects[id], state.day)) {
      game.setFlag(def.flag);
      news.push(`Built overnight: ${def.name}`);
    }
  }
  // Tavi goes looking for where the Irregular went, a day after you've seen the Lower Cut.
  if (game.hasFlag('lower_cut_reached') && game.hasFlag('met_tavi') && !game.hasFlag('tavi_missing') && !game.hasFlag('tavi_rescued')) {
    game.setFlag('tavi_missing');
    news.push('Tavi didn’t come up last night');
  }
  return news;
}

/** Sleep until morning: a new day, refreshed nodes and market, full health, and whatever got built. */
export async function sleep(game: Game): Promise<void> {
  game.panels.close();
  game.player.frozen = true;
  await game.hud.fade(1, 1.1);
  const state = game.state;
  state.day += 1;
  state.evening = false;
  state.soldToday = {};
  state.objective = null;
  state.player.health = game.progress.maxHealth();
  game.rng = createRng(state.seed + state.day * 7919);
  const news = overnight(game);
  game.reloadArea();
  game.save();
  await wait(0.7);
  void game.hud.fade(0, 1.4);
  game.hud.showCaption(`Day ${state.day}`, 'Morning in Bellwether');
  game.events.emit('dayStarted', { day: state.day });
  game.player.frozen = false;
  await wait(1.6);
  for (const line of news) game.hud.toast(`${line}.`, 'good', 5);
  const today = game.conditions.map((c) => describeCondition(c).title);
  if (today.length > 0) game.hud.toast(`On the noticeboard: ${today.join(', ').toLowerCase()}.`, 'info', 5);
}
