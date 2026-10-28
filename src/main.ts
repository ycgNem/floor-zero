import './style.css';
import './ui/ui.css';
import './ui/menus.css';
import { installDebug } from './debug/debug-panel';
import { Game } from './game';
import { Physics } from './physics/physics';

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  const ui = document.querySelector<HTMLElement>('#ui');
  if (!canvas || !ui) throw new Error('Missing #game canvas or #ui overlay');
  const physics = await Physics.create();
  const game = new Game(canvas, ui, physics);
  installDebug(game);
  await Promise.all([game.materials.preload(Math.min(8, game.renderer.gl.capabilities.getMaxAnisotropy())), game.viewmodel.preload()]);
  game.start();
}

void boot();
