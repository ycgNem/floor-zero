import { createRng } from '../core/rng';
import type { Game } from '../game';
import { wait } from '../ui/dom';

/** Sleep until morning: a new day, refreshed nodes and market, full health. */
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
  game.reloadArea();
  game.save();
  await wait(0.7);
  void game.hud.fade(0, 1.4);
  game.hud.showCaption(`Day ${state.day}`, 'Morning in Bellwether');
  game.events.emit('dayStarted', { day: state.day });
  game.player.frozen = false;
}
