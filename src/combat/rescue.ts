import { ITEMS } from '../data/items';
import type { Game } from '../game';
import { halveStacks } from '../items/inventory';
import { wait } from '../ui/dom';

const MARA_LINES = [
  'You’re awake. Good. My crew found you on Floor {floor} and dragged you to the lift.',
  'Again. The crew’s started a betting pool on you. Floor {floor}, this time.',
  'You know the lift goes both ways, yes? You’re allowed to ride it up on purpose.',
];

/** Defeat: the lift crew hauls you out. Keep your gear and skills; lose half your haul and a fee. */
export async function rescue(game: Game): Promise<void> {
  const g = game;
  g.player.frozen = true;
  g.gathering.stop();
  g.events.emit('playerDefeated', {});
  await g.hud.fade(1, 1.4);
  const floor = g.area?.def.floor ?? 1;
  const lost = halveStacks(g.state.player.pack);
  const fee = Math.min(g.state.player.money, 10 + 5 * floor);
  g.state.player.money -= fee;
  g.state.player.health = g.progress.maxHealth();
  g.state.evening = true;
  g.loadArea('lift-plaza', 'start');
  g.save();
  await wait(0.9);
  void g.hud.fade(0, 1.4);
  g.player.frozen = false;
  g.player.invulnerable = 1.5;
  const rescues = (g.state.depleted['rescue-count'] ?? 0) + 1;
  g.state.depleted['rescue-count'] = rescues;
  const line = (MARA_LINES[Math.min(rescues - 1, MARA_LINES.length - 1)] ?? '').replace('{floor}', String(floor));
  const lostText = lost.length > 0 ? lost.map(({ item, count }) => `${count} ${ITEMS[item].name.toLowerCase()}`).join(', ') : 'nothing, somehow';
  g.panels.show(() => ({
    name: 'Mara',
    role: 'Liftkeeper',
    text: `${line} That’s ${fee} bells for the haul up.\n\nSome of what you carried didn’t make it: ${lostText}.`,
    options: [{ label: 'Leave', onClick: () => g.panels.close() }],
  }));
}
