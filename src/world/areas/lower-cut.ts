import * as THREE from 'three';
import { createRng, randRange } from '../../core/rng';
import type { AreaDef, Interactable, Spawn } from '../area';
import { cart, lanternPost, rails, rubble, stalactites, supportFrame, wallLantern } from '../props';
import { pool } from '../water';

/** The pitch-dark tunnel to the lair, as a box on the floor plan: [x0, z0, x1, z1]. */
const DARK = [-19.5, 24, -8.6, 28] as const;
const HUNTER_EVERY = 2.4;

/** Floor 4. A long quarry cut with a stream, the first cobalt you can't mine, a dark tunnel, and the Irregular's lair. */
export const lowerCut: AreaDef = {
  id: 'lower-cut',
  name: 'The Lower Cut',
  floor: 4,
  fog: { color: 0x16130f, density: 0.032 },
  build({ game, kit }) {
    const rng = createRng(5501);
    const interactables: Interactable[] = [];
    game.setFlag('lower_cut_reached');

    // The way back up to Lantern Pool.
    kit.room({ at: [0, 0, -4], size: [3.4, 3.8, 6], wall: 'rock', floor: 'rock', openings: [{ side: 's', width: 3.4, height: 3.8 }] });
    kit.stairs({ from: [0, 0, -3.2], to: [0, 1.2, -6], width: 3.2, mat: 'rock' });
    kit.box({ at: [0, 0.6, -6.5], size: [3.4, 1.2, 1], mat: 'rock' });

    // The cut itself, with the stream from the pool running down its east side.
    kit.room({
      at: [0, 0, 22],
      size: [16, 12, 44],
      wall: 'rock',
      floor: null,
      openings: [
        { side: 'n', width: 3.4, height: 3.8 },
        { side: 'w', at: -16, width: 2.6, height: 3.4 },
        { side: 'w', at: 4, width: 2.6, height: 3.2 },
        { side: 's', width: 4, height: 4.5 },
      ],
    });
    kit.box({ at: [-2, -0.25, 22], size: [13, 0.5, 45], mat: 'dirt' });
    kit.box({ at: [6.5, -1.05, 22], size: [4, 0.5, 45], mat: 'rock' });
    kit.box({ at: [4.4, -0.65, 22], size: [0.2, 0.3, 44], mat: 'rock' });
    kit.blocker([4.6, 0.5, 22], [0.3, 1, 44]);
    const stream = pool(kit, { center: [6.25, -0.4, 22], size: [3.5, 44], eels: 0, motes: 0 });
    for (let z = 0.5; z < 43.5; z += randRange(rng, 1, 1.8)) {
      const h = randRange(rng, 0.15, 0.3);
      kit.box({ at: [4.65, h / 2, z], size: [0.4, h, randRange(rng, 0.8, 1.5)], mat: 'stone_wall', rotY: randRange(rng, -0.05, 0.05), bevel: 0.04, collide: false });
    }
    for (const z of [8, 18, 30, 40]) supportFrame(kit, [-2, 0, z], 11.6, 12);
    rails(kit, [-4, 0, 1], [-4, 0, 43]);
    cart(kit, [-4, 0, 12], 0.05, 'ore_iron');
    lanternPost(kit, [3.6, 0, 10], { yaw: -Math.PI / 2, intensity: 8, shadow: true });
    lanternPost(kit, [-6.6, 0, 34], { yaw: Math.PI / 2, intensity: 7 });
    lanternPost(kit, [3.6, 0, 40], { yaw: -Math.PI / 2, intensity: 7 });
    wallLantern(kit, [-7.85, 2.6, 21.6], Math.PI / 2, 5);
    stalactites(kit, rng, [-1, 12, 22], 7, 30);
    rubble(kit, rng, [-6.2, 0, 26.5], 1.2, 7);
    rubble(kit, rng, [2.5, 0, 16], 1, 6);
    rubble(kit, rng, [-6, 0, 2.5], 1.2, 7);

    // The first cobalt anyone has seen in years, glowing in the west wall.
    kit.pointLight({ at: [-6.4, 1.3, 18], color: 0x3a6aff, intensity: 5, distance: 7, bulb: false });

    // The freight tunnel up to the Broken Galleries. Its gate is bolted on this side.
    kit.room({ at: [-13.5, 0, 6], size: [9, 4, 3.2], wall: 'rock', floor: 'rock', openings: [{ side: 'e', width: 2.6, height: 3.4 }] });
    const gateOpen = game.hasFlag('freight_gate_open');
    for (let i = 0; i < 6; i++) {
      kit.box(gateOpen ? { at: [-17.7, 3.3, 4.75 + i * 0.5], size: [0.12, 0.3, 0.08], mat: 'rust', collide: false } : { at: [-17.7, 1.6, 4.75 + i * 0.5], size: [0.12, 3.2, 0.08], mat: 'rust', collide: false });
    }
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 3), kit.materials.get('metal'));
    bolt.position.set(-17.55, gateOpen ? 3.1 : 1.4, 6);
    kit.add(bolt);
    interactables.push({
      id: 'lc-freight-bolts',
      position: new THREE.Vector3(-17.4, 1.4, 6),
      radius: 1.1,
      mode: 'press',
      enabled: () => true,
      label: () => (game.hasFlag('freight_gate_open') ? 'Take the freight tunnel up to the Broken Galleries' : 'Draw the bolts on the freight gate'),
      press: () => {
        if (game.hasFlag('freight_gate_open')) {
          void game.travel('broken-galleries', 'freight-gate', 'walk');
          return;
        }
        game.setFlag('freight_gate_open');
        bolt.position.y = 3.1;
        game.hud.announce('Shortcut opened', 'The freight gate to the Broken Galleries');
        game.save();
      },
    });

    // The dark tunnel. Something lives in it that hates light.
    kit.room({ at: [-14, 0, 26], size: [10, 3.6, 3], wall: 'rock', floor: 'rock', openings: [{ side: 'e', width: 2.6, height: 3.2 }, { side: 'w', width: 2.6, height: 3.2 }] });
    rubble(kit, rng, [-12, 0, 25], 0.6, 4);

    // The Hollowhorn's lair: bones, scorched fissures, and two rock pillars it can be baited into.
    kit.room({ at: [-30, 0, 26], size: [20, 9, 20], wall: 'rock', floor: 'dirt', openings: [{ side: 'e', width: 2.6, height: 3.2 }] });
    for (const [x, z] of [[-34, 20.5], [-26, 31.5]] as const) kit.cylinder({ at: [x, 4.5, z], radius: 1.2, height: 9, mat: 'rock', segments: 10 });
    const fissure = new THREE.MeshStandardMaterial({ color: 0x1a0500, emissive: 0xff4a18, emissiveIntensity: 1.6 });
    for (let i = 0; i < 9; i++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(randRange(rng, 1.5, 4), 0.02, randRange(rng, 0.06, 0.14)), fissure);
      crack.position.set(randRange(rng, -38, -22), 0.012, randRange(rng, 18, 34));
      crack.rotation.y = rng() * Math.PI;
      kit.add(crack);
    }
    for (let i = 0; i < 7; i++) {
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, randRange(rng, 0.6, 1.4), 6), kit.materials.get('canvas'));
      bone.position.set(randRange(rng, -38, -24), 0.08, randRange(rng, 18, 34));
      bone.rotation.set(Math.PI / 2, rng() * Math.PI, randRange(rng, -0.3, 0.3));
      bone.castShadow = true;
      kit.add(bone);
    }
    rubble(kit, rng, [-38, 0, 18], 1.6, 9);
    rubble(kit, rng, [-37.5, 0, 34], 1.4, 8);
    kit.pointLight({ at: [-30, 3, 26], color: 0xff5a28, intensity: 6, distance: 18, bulb: false });

    // The guarded corridor down to the Pump Station, and the landing beyond it.
    kit.room({ at: [0, 0, 50], size: [8, 5, 10], wall: 'rock', floor: 'rock', openings: [{ side: 'n', width: 4, height: 4.5 }, { side: 's', width: 2.4, height: 3 }] });
    for (const [x, z] of [[-1.8, 47.6], [1.7, 49.8], [-1.4, 52.2]] as const) kit.cylinder({ at: [x, 2.5, z], radius: 0.45, height: 5, mat: 'stone_wall', segments: 10 });
    wallLantern(kit, [3.85, 2.8, 47], -Math.PI / 2, 4);
    kit.room({ at: [0, 0, 58], size: [3.4, 3.8, 4], wall: 'rock', floor: 'rock', openings: [{ side: 'n', width: 2.4, height: 3 }] });

    interactables.push(
      {
        id: 'lc-to-pool',
        position: new THREE.Vector3(0, 2.6, -6.6),
        radius: 1.3,
        mode: 'press',
        enabled: () => true,
        label: () => 'Climb back up to Lantern Pool',
        press: () => void game.travel('lantern-pool', 'from-lower-cut', 'walk'),
      },
      {
        id: 'lc-to-pump',
        position: new THREE.Vector3(0, 1.5, 59.5),
        radius: 1.2,
        mode: 'press',
        enabled: () => true,
        label: () => 'Descend to the Pump Station',
        press: () => void game.travel('pump-station', 'from-cut', 'walk'),
      },
    );

    game.gathering.spawn(kit, [
      { id: 'lc-cobalt-1', type: 'cobalt_seam', at: [-7.1, 0, 18] },
      { id: 'lc-iron-1', type: 'iron_seam', at: [-6.6, 0, 8.5] },
      { id: 'lc-iron-2', type: 'iron_seam', at: [-6.8, 0, 31] },
      { id: 'lc-iron-3', type: 'iron_seam', at: [2.8, 0, 37] },
      { id: 'lc-copper-1', type: 'copper_seam', at: [3, 0, 4] },
      { id: 'lc-lampmoss-1', type: 'lampmoss_patch', at: [-5.5, 0, 41.5] },
      { id: 'lc-lampmoss-2', type: 'lampmoss_patch', at: [2.4, 0, 2.2] },
      { id: 'lc-lampmoss-3', type: 'lampmoss_patch', at: [-36, 0, 30] },
    ], interactables);

    game.combat.spawn(kit, [
      { id: 'lc-sinkmaw-1', type: 'sinkmaw', at: [-2, 0, 14] },
      { id: 'lc-sinkmaw-2', type: 'sinkmaw', at: [1.5, 0, 22] },
      { id: 'lc-slagback-1', type: 'slagback', at: [-1, 0, 30], yaw: Math.PI },
      { id: 'lc-lampwarden-1', type: 'lampwarden', at: [-3, 0, 36], yaw: Math.PI },
      { id: 'lc-sentry-1', type: 'rivet_sentry', at: [0, 0, 54], yaw: Math.PI },
    ]);
    if (!game.hasFlag('hollowhorn_slain')) game.combat.spawn(kit, [{ id: 'lc-hollowhorn', type: 'hollowhorn', at: [-33, 0, 26], yaw: Math.PI / 2 }]);
    const offKilled = game.events.on('enemyKilled', ({ type }) => {
      if (type !== 'hollowhorn' || game.hasFlag('hollowhorn_slain')) return;
      game.setFlag('hollowhorn_slain');
      game.hud.announce('Feat recorded', 'The Irregular, hunted down');
      game.hud.toast('Iona will want to hear about this.', 'good', 5);
      game.save();
    });

    kit.add(new THREE.HemisphereLight(0x4a423b, 0x120f0c, 1.05));

    // Without a bright lantern, whatever hunts the dark tunnel takes bites out of you.
    let hunter = HUNTER_EVERY;
    const inDark = (): boolean => {
      const p = game.player.position;
      return p.x > DARK[0] && p.x < DARK[2] && p.z > DARK[1] && p.z < DARK[3];
    };

    const spawns = new Map<string, Spawn>([
      ['from-pool', { pos: new THREE.Vector3(0, 0, -2.4), yaw: Math.PI }],
      ['from-pump', { pos: new THREE.Vector3(0, 0, 57.4), yaw: 0 }],
      ['freight-gate', { pos: new THREE.Vector3(-10, 0, 6), yaw: -Math.PI / 2 }],
    ]);

    return {
      spawns,
      interactables,
      update: (dt) => {
        if (!inDark()) {
          hunter = HUNTER_EVERY;
          return;
        }
        if (game.state.player.equipment.lantern) {
          if (!game.hasFlag('dark_tunnel_lit')) {
            game.setFlag('dark_tunnel_lit');
            game.hud.toast('The bright lantern pushes the dark back. Something skitters away from the light.', 'good', 4.5);
          }
          return;
        }
        hunter -= dt;
        if (hunter <= 0) {
          hunter = HUNTER_EVERY;
          game.combat.damagePlayer(9, game.player.position.clone().add(new THREE.Vector3(0, 1, -1)));
          game.hud.toast('Something bites you from the dark. You need more light than this.', 'warn');
        }
      },
      frame: (dt, time) => stream.frame(dt, time * 5),
      dispose: () => {
        offKilled();
        stream.dispose();
        fissure.dispose();
      },
    };
  },
};
