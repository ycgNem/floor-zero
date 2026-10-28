import * as THREE from 'three';
import { createRng, randRange, type Rng } from '../../core/rng';
import type { Collider } from '../../physics/physics';
import { NODE_PLACEMENTS } from '../../data/placements';
import type { AreaDef, Interactable, Spawn } from '../area';
import type { LevelKit, V3 } from '../level-kit';
import type { MaterialKey } from '../materials';
import { barrel, bench, crate, ladder, lanternPost, railing, rubble, stalactites, wallLantern } from '../props';
import { restBench } from '../safe-room';
import { glowworms, pool } from '../water';

/** Where the lake sits in the cavern. The shore is at y = 0. */
const LAKE = { x0: -13, x1: 13, z0: 13, z1: 38, water: -0.3, bed: -2.6 };
/** The walkway out to the stranded platform crosses the east shore here. */
const WALK = { z0: 29.2, z1: 30.8 };
const WALKWAY_COST = { planks: 6, iron: 2, level: 2, xp: 120 };

/** Clusters of glowing caps along the shore. */
function glowShrooms(kit: LevelKit, rng: Rng, at: V3, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.7;
    const h = randRange(rng, 0.08, 0.3);
    const x = at[0] + Math.cos(a) * r;
    const z = at[2] + Math.sin(a) * r;
    kit.geometry(new THREE.CylinderGeometry(0.012, 0.02, h, 5), 'canvas', [x, at[1] + h / 2, z], undefined, false);
    kit.geometry(new THREE.SphereGeometry(randRange(rng, 0.04, 0.11), 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'glow_blue', [x, at[1] + h, z], undefined, false);
  }
}

/** A big rock half sunk into the floor or a wall, with a real collider. */
function boulder(kit: LevelKit, rng: Rng, at: V3, size: number, mat: MaterialKey = 'rock'): void {
  const geo = new THREE.DodecahedronGeometry(size, 1);
  geo.scale(1, randRange(rng, 0.55, 0.85), randRange(rng, 0.8, 1.1));
  kit.solid(geo, mat, at, new THREE.Euler(0, rng() * Math.PI, randRange(rng, -0.2, 0.2)));
}

/** Floor 3. A still lake under a high ceiling: fishing, a safe hut, Tavi, and the first shortcut. */
export const lanternPool: AreaDef = {
  id: 'lantern-pool',
  name: 'Lantern Pool',
  floor: 3,
  fog: { color: 0x0f1f24, density: 0.026 },
  dust: { color: 0xa8e6ff, opacity: 0.6 },
  // Cold mist lying on the water.
  air: { scatter: 0.005, mist: { color: 0x0d282c, density: 0.05, floor: -0.3, falloff: 1.1 } },
  grade: 'pool',
  build({ game, kit }) {
    const rng = createRng(4411);
    const interactables: Interactable[] = [];

    // The cavern. Its floor is laid by hand around the lake.
    kit.room({
      at: [0, 0, 22],
      size: [40, 14, 44],
      wall: 'rock',
      floor: null,
      openings: [
        { side: 'n', at: -12, width: 3, height: 3.5 },
        { side: 'n', at: 8, width: 1.6, height: 2.4 },
        { side: 's', at: 4, width: 3.4, height: 3.8 },
        { side: 'w', at: -16, width: 2, height: 3 },
      ],
    });
    const shore = (x0: number, x1: number, z0: number, z1: number): void =>
      kit.box({ at: [(x0 + x1) / 2, -0.25, (z0 + z1) / 2], size: [x1 - x0, 0.5, z1 - z0], mat: 'dirt' });
    shore(-20.5, 20.5, -0.5, LAKE.z0);
    shore(-20.5, 20.5, LAKE.z1, 44.5);
    shore(-20.5, LAKE.x0, LAKE.z0, LAKE.z1);
    shore(LAKE.x1, 20.5, LAKE.z0, LAKE.z1);

    // The basin: a rock bed and steep banks under the shore.
    const lakeW = LAKE.x1 - LAKE.x0;
    const lakeD = LAKE.z1 - LAKE.z0;
    const lakeX = (LAKE.x0 + LAKE.x1) / 2;
    const lakeZ = (LAKE.z0 + LAKE.z1) / 2;
    kit.box({ at: [lakeX, LAKE.bed - 0.25, lakeZ], size: [lakeW, 0.5, lakeD], mat: 'rock' });
    const bankH = -0.5 - LAKE.bed;
    const bankY = LAKE.bed + bankH / 2;
    kit.box({ at: [lakeX, bankY, LAKE.z0 - 0.25], size: [lakeW + 1, bankH, 0.5], mat: 'rock' });
    kit.box({ at: [lakeX, bankY, LAKE.z1 + 0.25], size: [lakeW + 1, bankH, 0.5], mat: 'rock' });
    kit.box({ at: [LAKE.x0 - 0.25, bankY, lakeZ], size: [0.5, bankH, lakeD], mat: 'rock' });
    kit.box({ at: [LAKE.x1 + 0.25, bankY, lakeZ], size: [0.5, bankH, lakeD], mat: 'rock' });

    // Broken curb stones along the water's edge, and an invisible rail so nobody walks in.
    const curb = (from: number, to: number, fixed: number, axis: 'x' | 'z', skip?: { a: number; b: number }): void => {
      let p = from;
      while (p < to - 0.3) {
        const len = Math.min(randRange(rng, 0.9, 1.8), to - p);
        const mid = p + len / 2;
        if (!skip || mid < skip.a - 0.4 || mid > skip.b + 0.4) {
          const h = randRange(rng, 0.16, 0.3);
          const at: V3 = axis === 'x' ? [mid, h / 2, fixed] : [fixed, h / 2, mid];
          const size: V3 = axis === 'x' ? [len - 0.06, h, 0.42] : [0.42, h, len - 0.06];
          kit.box({ at, size, mat: 'stone_wall', rotY: randRange(rng, -0.04, 0.04), bevel: 0.04, collide: false });
        }
        p += len;
      }
    };
    curb(LAKE.x0 - 0.4, LAKE.x1 + 0.4, LAKE.z0 - 0.2, 'x');
    curb(LAKE.x0 - 0.4, LAKE.x1 + 0.4, LAKE.z1 + 0.2, 'x');
    curb(LAKE.z0, LAKE.z1, LAKE.x0 - 0.2, 'z');
    curb(LAKE.z0, LAKE.z1, LAKE.x1 + 0.2, 'z', { a: WALK.z0, b: WALK.z1 });
    kit.blocker([lakeX, 0.5, LAKE.z0 - 0.2], [lakeW + 0.8, 1, 0.4]);
    kit.blocker([lakeX, 0.5, LAKE.z1 + 0.2], [lakeW + 0.8, 1, 0.4]);
    kit.blocker([LAKE.x0 - 0.2, 0.5, lakeZ], [0.4, 1, lakeD]);
    kit.blocker([LAKE.x1 + 0.2, 0.5, (LAKE.z0 + WALK.z0) / 2], [0.4, 1, WALK.z0 - LAKE.z0]);
    kit.blocker([LAKE.x1 + 0.2, 0.5, (WALK.z1 + LAKE.z1) / 2], [0.4, 1, LAKE.z1 - WALK.z1]);

    const water = pool(kit, { center: [lakeX, LAKE.water, lakeZ], size: [lakeW, lakeD], eels: 7, motes: 48 });
    kit.pointLight({ at: [lakeX, -1.8, lakeZ], color: 0x3fd0c8, intensity: 40, distance: 32, bulb: false });
    const worms = glowworms(kit, [-19, 1, 19, 43], 13.9, 1400);
    for (const [x, z, s] of [[-8, 30, 1.1], [-3, 19, 0.7], [10.5, 35.5, 0.9], [-11, 36, 1.3], [0.5, 35, 0.6], [-1, 25, 0.5]] as const) {
      kit.geometry(new THREE.DodecahedronGeometry(s, 1), 'rock', [x, LAKE.water - s * 0.45, z], new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
    }

    // The stranded maintenance platform.
    kit.box({ at: [6, -0.1, 30], size: [6, 0.2, 6], mat: 'wood' });
    for (const [x, z] of [[3.4, 27.4], [8.6, 27.4], [3.4, 32.6], [8.6, 32.6]] as const) {
      kit.cylinder({ at: [x, (LAKE.bed - 0.2) / 2, z], radius: 0.18, height: -0.2 - LAKE.bed, mat: 'rust', segments: 10 });
    }
    railing(kit, [3.1, 0, 27.1], [8.9, 0, 27.1]);
    railing(kit, [3.1, 0, 32.9], [8.9, 0, 32.9]);
    railing(kit, [3.1, 0, 27.1], [3.1, 0, 32.9]);
    railing(kit, [8.9, 0, 27.1], [8.9, 0, WALK.z0]);
    railing(kit, [8.9, 0, WALK.z1], [8.9, 0, 32.9]);
    lanternPost(kit, [8.3, 0, 32.3], { yaw: -Math.PI * 0.75, intensity: 6, shadow: true });
    crate(kit, [3.8, 0, 32.1], 0.7, 0.3);
    kit.cylinder({ at: [4.3, 0.45, 28.1], radius: 0.36, height: 0.9, mat: 'rust', segments: 14 });
    kit.box({ at: [4.3, 0.95, 28.1], size: [0.9, 0.1, 0.12], mat: 'metal', collide: false });

    // The walkway out to it, with its middle rotted through until someone repairs it.
    const deck = (x0: number, x1: number): void => kit.box({ at: [(x0 + x1) / 2, -0.075, 30], size: [x1 - x0, 0.15, WALK.z1 - WALK.z0], mat: 'wood' });
    deck(9, 10.2);
    deck(12.2, 13.4);
    for (const x of [9.6, 12.8]) {
      for (const z of [WALK.z0 + 0.1, WALK.z1 - 0.1]) kit.cylinder({ at: [x, (LAKE.bed - 0.15) / 2, z], radius: 0.08, height: -0.15 - LAKE.bed, mat: 'wood_dark', segments: 8, collide: false });
    }
    kit.blocker([11, 0.5, WALK.z0 - 0.1], [4.4, 1, 0.2]);
    kit.blocker([11, 0.5, WALK.z1 + 0.1], [4.4, 1, 0.2]);
    const gap = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, WALK.z1 - WALK.z0), kit.materials.get('wood'));
      plank.position.set(10.3 + i * 0.22, -0.03, 30);
      plank.castShadow = true;
      plank.receiveShadow = true;
      gap.add(plank);
    }
    kit.add(gap);
    const broken = new THREE.Group();
    for (const [x, tilt] of [[10.35, 0.5], [12.05, -0.6]] as const) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 1.5), kit.materials.get('wood'));
      plank.position.set(x, -0.25, 30);
      plank.rotation.set(0.2, 0, tilt);
      broken.add(plank);
    }
    kit.add(broken);
    let gapBlocker: Collider | null = null;
    const setWalkway = (repaired: boolean): void => {
      gap.visible = repaired;
      broken.visible = !repaired;
      if (repaired) {
        if (gapBlocker) kit.removeCollider(gapBlocker);
        gapBlocker = null;
        kit.blocker([11.2, -0.075, 30], [2, 0.15, WALK.z1 - WALK.z0]);
      } else gapBlocker = kit.blocker([12.1, 0.5, 30], [0.2, 1, WALK.z1 - WALK.z0]);
    };
    setWalkway(game.hasFlag('pool_walkway_repaired'));
    interactables.push({
      id: 'lp-walkway',
      position: new THREE.Vector3(11.2, 0.2, 30),
      radius: 1.1,
      mode: 'press',
      enabled: () => !game.hasFlag('pool_walkway_repaired'),
      label: () => `Repair the walkway (${WALKWAY_COST.planks} planks, ${WALKWAY_COST.iron} iron ore, Smithing ${WALKWAY_COST.level})`,
      press: () => {
        const p = game.progress;
        if (p.level('smithing') < WALKWAY_COST.level) {
          game.hud.toast(`You need Smithing ${WALKWAY_COST.level} to make a sound job of it.`, 'warn');
          return;
        }
        if (p.count('planks') < WALKWAY_COST.planks || p.count('iron_ore') < WALKWAY_COST.iron) {
          game.hud.toast(`You need ${WALKWAY_COST.planks} planks and ${WALKWAY_COST.iron} iron ore for nails and brackets. Bram sells planks.`, 'warn');
          return;
        }
        p.take('planks', WALKWAY_COST.planks);
        p.take('iron_ore', WALKWAY_COST.iron);
        p.addXp('smithing', WALKWAY_COST.xp);
        game.setFlag('pool_walkway_repaired');
        setWalkway(true);
        game.effects.burst(new THREE.Vector3(11.2, 0.1, 30), { count: 18, color: 0xc8a070, speed: 2, size: 0.05, life: 0.6 });
        game.hud.announce('Route repaired', 'The platform walkway');
        game.save();
      },
    });

    // The old maintenance hut on the north shore: a safe room. Tavi has been living out of it.
    kit.room({ at: [8, 0, -3.5], size: [6, 3.2, 5], wall: 'wood_dark', floor: 'wood', ceiling: 'wood_dark', openings: [{ side: 's', width: 1.6, height: 2.4 }] });
    bench(kit, [6.4, 0, -5.5], 0);
    interactables.push(restBench(game, 'lp-hut-rest', new THREE.Vector3(6.4, 0.6, -5.5)));
    kit.box({ at: [9.7, 0.4, -4.9], size: [1.2, 0.8, 0.8], mat: 'wood', bevel: 0.02 });
    crate(kit, [10.4, 0, -1.9], 0.7, 0.4);
    barrel(kit, [5.6, 0, -1.8]);
    wallLantern(kit, [10.85, 2.3, -3.5], -Math.PI / 2, 5);
    if (game.hasFlag('tavi_missing') && !game.hasFlag('tavi_rescued')) {
      // Tavi's gone after the Irregular's trail. They left a note on the table.
      kit.box({ at: [9.55, 0.81, -4.8], size: [0.24, 0.01, 0.3], mat: 'canvas', rotY: 0.3, collide: false, shadow: false });
      interactables.push({
        id: 'lp-tavi-note',
        position: new THREE.Vector3(9.55, 0.85, -4.8),
        radius: 0.5,
        mode: 'press',
        enabled: () => true,
        label: () => 'Read the note on the table',
        press: () => {
          game.state.counters['tavi-note-read'] = 1;
          game.panels.show(() => ({
            name: 'A note, in pencil',
            role: 'Tavi',
            text: 'Gone after the horned thing. Its tracks go down past the Cut and into that black tunnel on the west side. Nobody’s been in there with a light that works.\n\nBack by supper. Don’t tell Mara.\n\nT.',
            options: [{ label: 'Put it down', onClick: () => game.panels.close() }],
          }));
        },
      });
    } else {
      game.town.spawn(kit, 'tavi', new THREE.Vector3(9.4, 0, -3.6), -0.4, interactables);
    }

    // The tunnel back up to the galleries.
    kit.room({ at: [-12, 0, -4], size: [3, 3.5, 6], wall: 'rock', floor: 'rock', openings: [{ side: 's', width: 3, height: 3.5 }] });
    kit.stairs({ from: [-12, 0, -3.2], to: [-12, 1.2, -6], width: 2.8, mat: 'rock' });
    kit.box({ at: [-12, 0.6, -6.5], size: [3, 1.2, 1], mat: 'rock' });
    wallLantern(kit, [-10.65, 2.6, -2.5], -Math.PI / 2, 4);

    // The way down to the Lower Cut.
    kit.room({ at: [4, 0, 47], size: [3.4, 3.8, 4], wall: 'rock', floor: 'rock', openings: [{ side: 'n', width: 3.4, height: 3.8 }] });

    // The ladder shaft up to the Entry Yard. The bottom rungs rusted away long ago.
    kit.room({ at: [-22, 0, 6], size: [2, 22, 2], wall: 'rock', floor: 'rock', openings: [{ side: 'e', width: 2, height: 3 }] });
    ladder(kit, [-22.85, 7.2, 6], 14.6, Math.PI / 2);
    rubble(kit, rng, [-22.2, 0, 5.6], 0.6, 5, 'rust');
    kit.pointLight({ at: [-22, 19, 6], color: 0xffc080, intensity: 3, distance: 11, bulb: false });
    const ropeLadder = new THREE.Group();
    const rope = kit.materials.get('canvas');
    for (const side of [-0.22, 0.22]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 7.4, 6), rope);
      line.position.set(-22.75, 3.7, 6 + side);
      ropeLadder.add(line);
    }
    for (let y = 0.35; y < 7.2; y += 0.34) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.46), kit.materials.get('wood'));
      rung.position.set(-22.75, y, 6);
      ropeLadder.add(rung);
    }
    ropeLadder.visible = game.hasFlag('pool_ladder_secured');
    kit.add(ropeLadder);
    interactables.push({
      id: 'lp-ladder',
      position: new THREE.Vector3(-22.5, 1.5, 6),
      radius: 0.9,
      mode: 'press',
      enabled: () => true,
      label: () => {
        if (game.hasFlag('pool_ladder_secured')) return 'Climb the rope ladder up to the Entry Yard';
        return game.progress.count('rope') > 0 ? 'Tie a rope ladder to the old rungs' : 'Old ladder shaft (the bottom rungs are gone)';
      },
      press: () => {
        if (game.hasFlag('pool_ladder_secured')) {
          void game.travel('entry-yard', 'from-ladder', 'walk');
          return;
        }
        if (game.progress.count('rope') <= 0) {
          game.hud.toast('The rungs start well above your head. With some rope you could rig a way up.', 'warn');
          return;
        }
        game.progress.take('rope', 1);
        game.setFlag('pool_ladder_secured');
        ropeLadder.visible = true;
        game.hud.announce('Shortcut opened', 'Rope ladder to the Entry Yard');
        game.save();
      },
    });

    interactables.push(
      {
        id: 'lp-to-galleries',
        position: new THREE.Vector3(-12, 2.6, -6.6),
        radius: 1.2,
        mode: 'press',
        enabled: () => true,
        label: () => 'Climb back up to the Broken Galleries',
        press: () => void game.travel('broken-galleries', 'from-pool', 'walk'),
      },
      {
        id: 'lp-to-lower-cut',
        position: new THREE.Vector3(4, 1.5, 48.6),
        radius: 1.3,
        mode: 'press',
        enabled: () => true,
        label: () => 'Follow the water down to the Lower Cut',
        press: () => void game.travel('lower-cut', 'from-pool', 'walk'),
      },
    );

    // Shore dressing: lanterns, glowing caps, boulders against the walls, the ceiling's teeth.
    lanternPost(kit, [-8, 0, 10.8], { intensity: 8, shadow: true });
    lanternPost(kit, [2.5, 0, 10.8], { intensity: 7 });
    lanternPost(kit, [-16.4, 0, 26], { yaw: Math.PI / 2, intensity: 7 });
    lanternPost(kit, [16.4, 0, 21], { yaw: -Math.PI / 2, intensity: 7 });
    lanternPost(kit, [-4, 0, 40.4], { yaw: Math.PI, intensity: 7 });
    for (const at of [[-15.8, 0, 19.5], [-14.6, 0, 31], [15.2, 0, 15.5], [14.6, 0, 34], [-6.5, 0, 11.6], [7.5, 0, 39.6], [-18.6, 0, 40]] as const) {
      glowShrooms(kit, rng, at, 9);
    }
    for (const [x, z, s] of [[-19.2, 12, 2.2], [-19.4, 36, 2.6], [19.3, 8, 2.4], [19.2, 30, 2.0], [-9, 43.6, 1.8], [14, 43.5, 2.2], [-2, 0.4, 1.6], [16, 0.6, 1.8]] as const) {
      boulder(kit, rng, [x, 0, z], s);
    }
    rubble(kit, rng, [18, 0, 42], 1.4, 8);
    rubble(kit, rng, [-17.5, 0, 2.5], 1.2, 7);
    stalactites(kit, rng, [0, 14, 22], 17, 44);

    game.gathering.spawn(kit, NODE_PLACEMENTS['lantern-pool'], interactables);

    game.fishing.spawn(kit, [
      { id: 'lp-shallows-1', type: 'shallows', at: [-6, LAKE.water, 15.4] },
      { id: 'lp-shallows-2', type: 'shallows', at: [-10.6, LAKE.water, 24] },
      { id: 'lp-eel-run', type: 'eel_run', at: [10.6, LAKE.water, 19] },
      { id: 'lp-deep-pool', type: 'deep_pool', at: [5.5, LAKE.water, 24.8] },
    ], interactables);

    game.combat.spawn(kit, [
      { id: 'lp-scuttler-1', type: 'scuttler', at: [-5, 0, 41.5] },
      { id: 'lp-scuttler-2', type: 'scuttler', at: [-12, 0, 40.5] },
    ]);

    kit.add(new THREE.HemisphereLight(0x2e6070, 0x101214, 1.3));

    const spawns = new Map<string, Spawn>([
      ['from-galleries', { pos: new THREE.Vector3(-12, 0, -2.4), yaw: Math.PI }],
      ['from-ladder', { pos: new THREE.Vector3(-21.4, 0, 6), yaw: -Math.PI / 2 }],
      ['hut', { pos: new THREE.Vector3(8, 0, -2.4), yaw: Math.PI }],
      ['from-lower-cut', { pos: new THREE.Vector3(4, 0, 46.5), yaw: 0 }],
    ]);

    return {
      spawns,
      interactables,
      frame: (dt, time) => water.frame(dt, time),
      dispose: () => {
        water.dispose();
        (worms.userData.ownedMaterial as THREE.Material).dispose();
      },
    };
  },
};
