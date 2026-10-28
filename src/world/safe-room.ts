import type * as THREE from 'three';
import type { Game } from '../game';
import type { Interactable } from './area';

/** A bench in a safe room. A short rest heals you fully and saves. Safe rooms never bank anything. */
export function restBench(game: Game, id: string, position: THREE.Vector3): Interactable {
  let resting = false;
  const rest = async (): Promise<void> => {
    if (resting) return;
    if (game.state.player.health >= game.progress.maxHealth()) {
      game.hud.toast('You’re not hurt. Nothing to rest off.');
      return;
    }
    resting = true;
    game.player.frozen = true;
    await game.hud.fade(1, 0.5);
    game.progress.heal(game.progress.maxHealth());
    game.save();
    await game.hud.fade(0, 0.6);
    game.player.frozen = false;
    resting = false;
    game.hud.toast('You rest a while. Fully healed.', 'good');
  };
  return {
    id,
    position,
    radius: 0.9,
    mode: 'press',
    enabled: () => true,
    label: () => 'Rest on the bench',
    press: () => void rest(),
  };
}
