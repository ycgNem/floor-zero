import * as THREE from 'three';
import type { FlagId } from '../data/ids';
import { HOUSE_PRICE } from '../data/projects';
import type { Game } from '../game';
import { taperedTube } from '../render/shapes';
import { wait } from '../ui/dom';
import type { PanelSpec } from '../ui/panels';
import type { Interactable } from './area';
import { sleep } from './days';
import type { LevelKit, V3 } from './level-kit';
import { offset, wallLantern } from './props';

/** The house is 7 m wide and 6.5 m deep; its front faces local +Z, toward the shaft. */
const W = 7;
const D = 6.5;
const H = 3.2;
const T = 0.3;

interface Trophy {
  name: string;
  line: string;
  /** How it sits on the shelf. */
  look: 'plaque' | 'seal' | 'fish' | 'horn' | 'lens' | 'ore';
  earned(game: Game): boolean;
}

const flag = (f: FlagId) => (game: Game): boolean => game.hasFlag(f);

/** What ends up on your shelf, in shelf order. */
const TROPHIES: readonly Trophy[] = [
  { name: 'Your delver’s license', line: 'Rank I, in Iona’s neat hand, slightly singed.', look: 'plaque', earned: flag('license_granted') },
  { name: 'Builders’ drawings', line: 'The boltcaster sheet from the storeroom, framed. Iona kept the original.', look: 'plaque', earned: flag('schematic_delivered') },
  { name: 'A white cavefish', line: 'Your first from the deep pool, pressed and mounted. Pell wanted it for soup.', look: 'fish', earned: (g) => (g.state.counters['caught:white_cavefish'] ?? 0) > 0 },
  { name: 'The Hollowhorn’s horn', line: 'Longer than your arm, and still warm on cold nights.', look: 'horn', earned: flag('hollowhorn_slain') },
  { name: 'The Sluicekeeper’s lens', line: 'It still glows when the pumps run, five floors down.', look: 'lens', earned: flag('sluicekeeper_defeated') },
  { name: 'The first cobalt', line: 'A thumb of blue ore from the seam nobody could cut.', look: 'ore', earned: flag('cobalt_pick_forged') },
  { name: 'The Rank II seal', line: 'Stamped in core-wax at the Survey Office. Mara pretended not to watch.', look: 'seal', earned: flag('rank_two') },
  { name: 'A note from Tavi', line: '“For the next time you come and get me. There won’t be one. T.”', look: 'plaque', earned: flag('tavi_rescued') },
];

function trophyPanel(game: Game): PanelSpec {
  const earned = TROPHIES.filter((t) => t.earned(game));
  return {
    name: 'Your shelf',
    role: 'The lamplighter’s house',
    rows: [
      ...earned.map((t) => ({ title: t.name, detail: t.line })),
      ...(earned.length < TROPHIES.length ? [{ title: `${TROPHIES.length - earned.length} spaces still empty`, dim: true }] : []),
    ],
    options: [{ label: 'Done', onClick: () => game.panels.close() }],
  };
}

/** Hollis sells you the house: the money goes, the door opens, and the plaza is rebuilt around it. */
export async function buyHouse(game: Game): Promise<void> {
  if (game.hasFlag('house_bought') || game.progress.money < HOUSE_PRICE) return;
  game.panels.close();
  game.progress.addMoney(-HOUSE_PRICE);
  game.player.frozen = true;
  await game.hud.fade(1, 0.8);
  game.setFlag('house_bought');
  game.reloadArea();
  game.save();
  await wait(0.3);
  void game.hud.fade(0, 1);
  game.player.frozen = false;
  game.hud.announce('A place of your own', 'The lamplighter’s house');
  game.hud.toast('Your own bed, your own storage, a hearth, and a shelf for whatever you’re proud of.', 'good', 5);
}

/**
 * The old lamplighter's house on the plaza ring. Locked and for sale until you buy it; then a
 * bed that ends the day, a chest onto your storage, a hearth to cook at, and a trophy shelf.
 * `at` is the centre of the front wall at ground level.
 */
export function buildHome(game: Game, kit: LevelKit, interactables: Interactable[], at: V3, yaw: number): { frame(time: number): void } {
  const owned = game.hasFlag('house_bought');
  const p = (dx: number, dy: number, dz: number): V3 => offset(at, yaw, dx, dy, dz);
  const box = (dx: number, dy: number, dz: number, size: V3, mat: Parameters<LevelKit['box']>[0]['mat'], collide = true): void =>
    kit.box({ at: p(dx, dy, dz), size, mat, rotY: yaw, collide });

  // Shell: plaster walls on a stone footing, a timber floor, a door, and a window onto the plaza.
  box(0, -0.03, -D / 2, [W, 0.1, D], 'wood');
  box(0, H + 0.1, -D / 2, [W, 0.2, D], 'wood_dark', false);
  box(-W / 2 + T / 2, H / 2, -D / 2, [T, H, D], 'plaster');
  box(W / 2 - T / 2, H / 2, -D / 2, [T, H, D], 'plaster');
  box(0, H / 2, -D + T / 2, [W, H, T], 'plaster');
  const front = (x0: number, x1: number, y0: number, y1: number): void => box((x0 + x1) / 2, (y0 + y1) / 2, -T / 2, [x1 - x0, y1 - y0, T], 'plaster');
  front(-W / 2, -0.7, 0, H);
  front(-0.7, 0.7, 2.3, H);
  front(0.7, 1.5, 0, H);
  front(1.5, 2.8, 0, 1.0);
  front(1.5, 2.8, 2.1, H);
  front(2.8, W / 2, 0, H);
  box(2.15, 1.55, -T / 2, [1.3, 1.1, 0.04], 'window', false);
  box(2.15, 0.95, 0.05, [1.5, 0.08, 0.2], 'wood_dark', false);
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) box(x, H / 2, 0.02, [0.22, H + 0.2, 0.22], 'wood_dark', false);
  box(0, H * 0.55, 0.04, [W, 0.16, 0.1], 'wood_dark', false);
  box(0, 0.25, 0.02, [W + 0.1, 0.5, 0.12], 'stone_wall', false);
  box(0, 2.42, 0.06, [1.7, 0.16, 0.16], 'wood_dark', false);
  // A gable roof like the shops'.
  const shape = new THREE.Shape();
  const eave = D / 2 + 0.45;
  shape.moveTo(-eave, 0);
  shape.lineTo(eave, 0);
  shape.lineTo(0, 2.2);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: W + 0.6, bevelEnabled: false });
  roof.translate(0, 0, -(W + 0.6) / 2);
  kit.geometry(roof, 'roof', p(0, H + 0.2, -D / 2), new THREE.Euler(0, yaw + Math.PI / 2, 0));
  box(2.3, H + 2.2, -D + 0.9, [0.8, 2.6, 0.8], 'brick', false);

  // The door: shut and locked while it's for sale, standing open once it's yours.
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.28, 0.07), kit.materials.get('wood_dark'));
  const hinge = new THREE.Group();
  hinge.position.set(...p(-0.68, 1.14, -0.08));
  hinge.rotation.y = yaw + (owned ? -1.9 : 0);
  door.position.x = 0.68;
  door.castShadow = true;
  hinge.add(door);
  kit.add(hinge);
  if (!owned) {
    kit.blocker(p(0, 1.15, -0.15), [1.4, 2.3, 0.2], yaw);
    // A board hung on the door: for sale.
    box(0.25, 1.55, 0.02, [0.62, 0.36, 0.03], 'canvas', false);
    interactables.push({
      id: 'home-door',
      position: new THREE.Vector3(...p(0, 1.3, 0.1)),
      radius: 0.8,
      mode: 'press',
      enabled: () => true,
      label: () => 'The old lamplighter’s house (for sale: ask Hollis at the inn)',
      press: () => game.hud.toast(`Locked. A board on the door: “For sale, ${HOUSE_PRICE} bells. Ask at the Counterweight.”`, 'warn', 4),
    });
    return { frame: () => {} };
  }

  // Inside: a bed against the west wall, a chest at its foot, a table, a hearth, a rug, and the shelf.
  box(-2.55, 0.2, -4.75, [1.15, 0.36, 2.1], 'wood_dark');
  box(-2.55, 0.45, -4.72, [1.04, 0.16, 1.96], 'canvas', false);
  box(-2.55, 0.55, -4.35, [1.06, 0.06, 1.2], 'roof', false);
  box(-2.55, 0.62, -5.5, [0.7, 0.12, 0.34], 'canvas', false);
  box(-2.55, 0.62, -5.84, [1.15, 0.85, 0.08], 'wood_dark', false);
  box(-2.55, 0.3, -3.25, [0.95, 0.56, 0.56], 'wood');
  for (const dx of [-0.36, 0.36]) box(-2.55 + dx, 0.3, -3.25, [0.06, 0.6, 0.6], 'metal', false);
  box(1.05, 0.76, -2.9, [1.4, 0.06, 0.85], 'wood');
  for (const [dx, dz] of [[-0.6, -0.33], [0.6, -0.33], [-0.6, 0.33], [0.6, 0.33]] as const) box(1.05 + dx, 0.37, -2.9 + dz, [0.07, 0.74, 0.07], 'wood_dark', false);
  box(1.05, 0.45, -1.95, [0.45, 0.06, 0.45], 'wood', false);
  box(1.05, 0.72, -1.74, [0.45, 0.55, 0.05], 'wood', false);
  box(0, 0.035, -3.4, [2.4, 0.012, 1.7], 'canvas', false);
  // Hearth and chimney breast in the back corner.
  box(2.45, 0.6, -5.85, [1.5, 1.2, 0.9], 'stone_wall');
  box(2.45, 2.2, -6.0, [1.1, 2.0, 0.6], 'brick', false);
  box(2.45, 0.42, -5.42, [0.75, 0.5, 0.06], 'lamp', false);
  box(2.45, 1.24, -5.75, [1.7, 0.1, 1.0], 'wood_dark', false);
  const fire = kit.pointLight({ at: p(2.45, 0.7, -5.0), color: 0xff8a3a, intensity: 5, distance: 7, bulb: false });
  wallLantern(kit, p(-W / 2 + T + 0.06, 2.3, -1.6), yaw + Math.PI / 2, 4);

  // The trophy shelf on the back wall: two boards, filled in as you earn things.
  for (const y of [1.25, 1.85]) box(-0.2, y, -D + T + 0.16, [2.6, 0.05, 0.3], 'wood_dark', false);
  const slots: [number, number][] = [[-1.2, 1.28], [-0.55, 1.28], [0.15, 1.28], [0.85, 1.28], [-1.2, 1.88], [-0.45, 1.88], [0.3, 1.88], [0.85, 1.88]];
  TROPHIES.forEach((trophy, i) => {
    const slot = slots[i];
    if (!slot || !trophy.earned(game)) return;
    const [sx, sy] = slot;
    const z = -D + T + 0.14;
    switch (trophy.look) {
      case 'horn': {
        box(sx, sy + 0.28, z - 0.08, [0.36, 0.5, 0.04], 'wood_dark', false);
        kit.geometry(taperedTube([[0, 0, 0], [0.1, 0.15, 0.08], [0.06, 0.38, 0.14], [-0.08, 0.5, 0.1]], 0.055, 0.006, 12, 8), 'canvas', p(sx, sy + 0.12, z), new THREE.Euler(0, yaw, 0), false);
        break;
      }
      case 'lens':
        kit.geometry(new THREE.TorusGeometry(0.11, 0.025, 8, 20), 'metal', p(sx, sy + 0.16, z), new THREE.Euler(0, yaw, 0), false);
        kit.geometry(new THREE.SphereGeometry(0.09, 14, 10), 'core', p(sx, sy + 0.16, z), undefined, false);
        break;
      case 'ore':
        kit.geometry(new THREE.OctahedronGeometry(0.09, 0), 'ore_cobalt', p(sx, sy + 0.08, z), new THREE.Euler(0.3, 0.6, 0.2), false);
        kit.geometry(new THREE.OctahedronGeometry(0.06, 0), 'ore_cobalt', p(sx + 0.08, sy + 0.05, z + 0.04), new THREE.Euler(0.8, 0.1, 0.4), false);
        break;
      case 'fish': {
        box(sx, sy + 0.2, z - 0.08, [0.46, 0.3, 0.04], 'wood_dark', false);
        const fish = new THREE.SphereGeometry(0.1, 12, 8);
        fish.scale(2, 0.7, 0.35);
        kit.geometry(fish, 'canvas', p(sx, sy + 0.2, z - 0.03), new THREE.Euler(0, yaw, 0), false);
        break;
      }
      case 'plaque':
      case 'seal':
        // A frame with something pale in it, leaning on the wall. The seal glows like a core.
        box(sx, sy + 0.17, z - 0.05, [0.34, 0.3, 0.03], 'wood_dark', false);
        box(sx, sy + 0.17, z - 0.03, [0.26, 0.22, 0.01], trophy.look === 'seal' ? 'core' : 'canvas', false);
        break;
    }
  });

  interactables.push(
    {
      id: 'home-bed',
      position: new THREE.Vector3(...p(-2.55, 0.7, -4.6)),
      radius: 0.9,
      mode: 'press',
      enabled: () => true,
      label: () => 'Sleep in your own bed until morning',
      press: () => void sleep(game),
    },
    {
      id: 'home-chest',
      position: new THREE.Vector3(...p(-2.55, 0.6, -3.25)),
      radius: 0.6,
      mode: 'press',
      enabled: () => true,
      label: () => 'Open your storage',
      press: () => game.panels.show(() => game.town.bank()),
    },
    {
      id: 'home-hearth',
      position: new THREE.Vector3(...p(2.45, 0.7, -5.3)),
      radius: 0.8,
      mode: 'press',
      enabled: () => true,
      label: () => 'Cook at your hearth',
      press: () => game.panels.show(() => game.town.crafting('kitchen')),
    },
    {
      id: 'home-shelf',
      position: new THREE.Vector3(...p(-0.2, 1.6, -D + 0.6)),
      radius: 1,
      mode: 'press',
      enabled: () => true,
      label: () => 'Look over your shelf',
      press: () => game.panels.show(() => trophyPanel(game)),
    },
  );

  return {
    frame: (time) => {
      fire.intensity = 4.4 + Math.sin(time * 9) * 0.8 + Math.sin(time * 21) * 0.5;
    },
  };
}
