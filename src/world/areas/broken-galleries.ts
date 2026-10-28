import * as THREE from 'three';
import { createRng } from '../../core/rng';
import type { Collider } from '../../physics/physics';
import type { AreaDef, Interactable, Spawn } from '../area';
import { barrel, cart, crate, lanternPost, pipe, rails, rubble, stalactites, supportFrame, wallLantern } from '../props';
import { irregularEvent } from '../../story/irregular';

/** Floor 2. Branching galleries, the first real fights, the collapse, and the freight gate. */
export const brokenGalleries: AreaDef = {
  id: 'broken-galleries',
  name: 'The Broken Galleries',
  floor: 2,
  fog: { color: 0x12151a, density: 0.036 },
  build({ game, kit }) {
    const rng = createRng(3307);
    const interactables: Interactable[] = [];

    // Gallery mouth, where the passage from the yard comes in.
    kit.room({ at: [0, 0, 0], size: [10, 5, 8], wall: 'rock', openings: [{ side: 'n', width: 2.6, height: 3 }, { side: 's', width: 4, height: 4 }] });
    kit.room({ at: [0, 0, -7], size: [2.6, 4, 4], wall: 'rock', openings: [{ side: 's', width: 2.6, height: 3 }] });
    kit.stairs({ from: [0, 0, -5.4], to: [0, 1.6, -8.4], width: 2.4, mat: 'stone_floor' });
    kit.box({ at: [0, 0.8, -8.75], size: [2.6, 1.6, 0.7], mat: 'stone_floor' });
    wallLantern(kit, [1.15, 3, -6.4], -Math.PI / 2, 4);
    supportFrame(kit, [0, 0, -1.5], 9.4, 5);
    lanternPost(kit, [3.6, 0, 1.5], { yaw: -Math.PI / 2, intensity: 7 });
    crate(kit, [-3.8, 0, -2.6], 0.8, 0.3);
    barrel(kit, [-4.1, 0, -1.4]);

    // The main gallery.
    kit.room({
      at: [0, 0, 17],
      size: [7, 6, 24],
      wall: 'rock',
      openings: [
        { side: 'n', width: 4, height: 4 },
        { side: 'w', at: -5, width: 3, height: 3.4 },
        { side: 'e', at: 4, width: 3.4, height: 3.8 },
        { side: 's', width: 5, height: 5 },
      ],
    });
    for (const z of [7, 11.5, 16, 20.5, 25]) supportFrame(kit, [0, 0, z], 6.6, 6);
    rails(kit, [1.6, 0, 5.2], [1.6, 0, 28.8]);
    cart(kit, [1.6, 0, 18], 0.04, 'ore_iron');
    stalactites(kit, rng, [0, 6, 17], 3, 14);
    rubble(kit, rng, [-2.6, 0, 9], 0.9, 6);
    rubble(kit, rng, [2.7, 0, 24], 1, 6);
    wallLantern(kit, [-3.35, 2.6, 14], Math.PI / 2, 5, true);
    pipe(kit, [3.2, 4.8, 5.5], [3.2, 4.8, 28.5], 0.14);

    // West cavern: glowcaps, a broken construct, a nest of scuttlers.
    kit.room({ at: [-9.5, 0, 12], size: [10, 5, 10], wall: 'rock', floor: 'dirt', openings: [{ side: 'e', width: 3, height: 3.4 }] });
    stalactites(kit, rng, [-9.5, 5, 12], 4, 16);
    rubble(kit, rng, [-12.5, 0, 15], 1.5, 9);
    const construct = new THREE.Group();
    const rust = kit.materials.get('rust');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 10), rust);
    body.rotation.z = 1.2;
    body.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), kit.materials.get('metal'));
    head.position.set(0.7, 0.3, 0.1);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), kit.materials.get('core'));
    eye.position.set(0.95, 0.35, 0.1);
    construct.add(body, head, eye);
    construct.position.set(-12.6, 0, 9);
    construct.rotation.y = 0.6;
    construct.traverse((o) => (o.castShadow = true));
    kit.add(construct);
    kit.pointLight({ at: [-9.5, 1.2, 12], color: 0x5fb0ff, intensity: 4, distance: 9, bulb: false });

    // East chamber: pillars to bait a Slagback into.
    kit.room({ at: [10.5, 0, 21], size: [12, 6, 12], wall: 'rock', openings: [{ side: 'w', width: 3.4, height: 3.8 }] });
    for (const [x, z] of [[8, 17.5], [13.2, 24.2], [12.8, 17.8], [7.6, 25]] as const) {
      kit.cylinder({ at: [x, 3, z], radius: 0.55, height: 6, mat: 'stone_wall', segments: 12 });
      kit.cylinder({ at: [x, 0.25, z], radius: 0.75, height: 0.5, mat: 'stone_wall', segments: 12 });
    }
    lanternPost(kit, [15.6, 0, 21], { yaw: -Math.PI / 2, intensity: 8, shadow: true });
    rubble(kit, rng, [15, 0, 15.8], 1.2, 6);

    // The collapse chamber: the freight gate west, the rockfall south.
    kit.room({
      at: [0, 0, 35],
      size: [14, 7, 10],
      wall: 'rock',
      openings: [{ side: 'n', width: 5, height: 5 }, { side: 's', width: 4, height: 4 }, { side: 'w', width: 3.2, height: 3.4 }],
    });
    supportFrame(kit, [0, 0, 32], 13.4, 7);
    stalactites(kit, rng, [0, 7, 35], 5, 14);
    wallLantern(kit, [6.85, 3, 36], -Math.PI / 2, 6);

    // The freight gate, bolted from the far side.
    const gateOpen = game.hasFlag('freight_gate_open');
    for (let i = 0; i < 7; i++) {
      const z = 33.6 + i * 0.47;
      // Open, the bars are wound up into the header.
      kit.box(gateOpen ? { at: [-7.25, 3.25, z], size: [0.12, 0.3, 0.08], mat: 'rust', collide: false } : { at: [-7.25, 1.7, z], size: [0.12, 3.4, 0.08], mat: 'rust', collide: false });
    }
    kit.box({ at: [-7.25, 3.5, 35], size: [0.3, 0.3, 3.6], mat: 'metal', collide: false });
    kit.room({ at: [-10.5, 0, 35], size: [5, 3.6, 3.2], wall: 'rock', ceiling: 'rock', openings: [{ side: 'e', width: 3.2, height: 3.4 }] });
    if (!gateOpen) kit.blocker([-7.25, 1.7, 35], [0.3, 3.4, 3.2]);
    interactables.push({
      id: 'bg-freight-gate',
      position: new THREE.Vector3(-7.2, 1.5, 35),
      radius: 1.4,
      mode: 'press',
      enabled: () => true,
      label: () => (game.hasFlag('freight_gate_open') ? 'Take the freight tunnel down to the Lower Cut' : 'Freight gate (bolted from the other side)'),
      press: () => {
        if (game.hasFlag('freight_gate_open')) void game.travel('lower-cut', 'freight-gate', 'walk');
        else game.hud.toast('The bolts are on the far side. Someone would have to open it from below.', 'warn');
      },
    });

    // The tunnel down toward Lantern Pool, sealed by a rockfall until the Hollowhorn bursts through it.
    kit.room({ at: [0, -2.4, 44], size: [4, 6.4, 6], wall: 'rock', floor: 'rock', openings: [{ side: 'n', width: 4, height: 6.4 }, { side: 's', width: 2.4, height: 2.8 }] });
    kit.ramp({ from: [0, 0, 40.5], to: [0, -2.4, 47], width: 4, mat: 'dirt' });
    kit.room({ at: [0, -2.4, 49], size: [2.4, 2.8, 2], wall: 'rock', floor: 'rock', openings: [{ side: 'n', width: 2.4, height: 2.8 }] });
    kit.pointLight({ at: [0, -1, 48.8], color: 0x6fb8ff, intensity: 2.5, distance: 7, bulb: false });

    const fall = new THREE.Group();
    kit.add(fall);
    let rockfall: Collider | null = null;
    if (!game.hasFlag('galleries_route_open')) {
      for (let i = 0; i < 9; i++) {
        const s = 0.6 + rng() * 0.9;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), kit.materials.get('rock'));
        rock.position.set(-1.6 + rng() * 3.2, s * 0.6 + rng() * 2.2, 40.2 + rng() * 0.6);
        rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        rock.castShadow = true;
        rock.userData.size = s;
        fall.add(rock);
      }
      rockfall = kit.blocker([0, 2, 40.25], [4.2, 4, 0.6]);
    } else {
      rubble(kit, rng, [-2.9, 0, 38.2], 1, 7);
      rubble(kit, rng, [3, 0, 38], 1, 7);
    }
    interactables.push(
      {
        id: 'bg-rockfall',
        position: new THREE.Vector3(0, 1.6, 40),
        radius: 1.8,
        mode: 'press',
        enabled: () => !game.hasFlag('galleries_route_open'),
        label: () => 'Rockfall (impassable)',
        press: () => game.hud.toast('Fresh rockfall. Something on the other side is grinding against it.', 'warn'),
      },
      {
        id: 'bg-to-pool',
        position: new THREE.Vector3(0, -1, 49.4),
        radius: 1.2,
        mode: 'press',
        enabled: () => game.hasFlag('galleries_route_open'),
        label: () => 'Follow the tunnel down to Lantern Pool',
        press: () => void game.travel('lantern-pool', 'from-galleries', 'walk'),
      },
    );

    interactables.push(
      {
        id: 'bg-back-to-yard',
        position: new THREE.Vector3(0, 2.8, -8.7),
        radius: 1.4,
        mode: 'press',
        enabled: () => true,
        label: () => 'Climb back up to the Entry Yard',
        press: () => void game.travel('entry-yard', 'from-galleries', 'walk'),
      },
      {
        id: 'bg-construct',
        position: new THREE.Vector3(-12.6, 0.5, 9),
        radius: 0.9,
        mode: 'press',
        enabled: () => true,
        label: () => (game.state.depleted['bg-construct'] === game.state.day ? 'Broken construct (stripped for today)' : 'Salvage the broken construct'),
        press: () => {
          if (game.state.depleted['bg-construct'] === game.state.day) {
            game.hud.toast('Nothing more worth taking today.', 'warn');
            return;
          }
          game.state.depleted['bg-construct'] = game.state.day;
          game.progress.give('salvaged_spring');
          game.effects.burst(new THREE.Vector3(-12.6, 0.6, 9), { count: 10, color: 0xb8bcc4, speed: 2, size: 0.04 });
        },
      },
    );

    game.gathering.spawn(kit, [
      { id: 'bg-copper-1', type: 'copper_seam', at: [-2.6, 0, 6.2] },
      { id: 'bg-copper-2', type: 'copper_seam', at: [2.6, 0, 12.5] },
      { id: 'bg-copper-3', type: 'copper_seam', at: [-2.5, 0, 22.5] },
      { id: 'bg-iron-1', type: 'iron_seam', at: [15.6, 0, 26] },
      { id: 'bg-iron-2', type: 'iron_seam', at: [9.8, 0, 26] },
      { id: 'bg-iron-3', type: 'iron_seam', at: [-13.2, 0, 15.8], scale: 0.9 },
      { id: 'bg-glowcap-1', type: 'glowcap_patch', at: [-7, 0, 15.5] },
      { id: 'bg-glowcap-2', type: 'glowcap_patch', at: [-13.4, 0, 12] },
      { id: 'bg-lampmoss-1', type: 'lampmoss_patch', at: [-6.6, 0, 8] },
    ], interactables);

    game.combat.spawn(kit, [
      { id: 'bg-scuttler-1', type: 'scuttler', at: [-1, 0, 14] },
      { id: 'bg-scuttler-2', type: 'scuttler', at: [1.2, 0, 15.5] },
      { id: 'bg-scuttler-3', type: 'scuttler', at: [0, 0, 17] },
      { id: 'bg-bellcap-1', type: 'bellcap', at: [0, 0, 27] },
      { id: 'bg-scuttler-4', type: 'scuttler', at: [-10, 0, 10] },
      { id: 'bg-scuttler-5', type: 'scuttler', at: [-11, 0, 13] },
      { id: 'bg-slagback-1', type: 'slagback', at: [12, 0, 21], yaw: -Math.PI / 2 },
      { id: 'bg-bellcap-2', type: 'bellcap', at: [5, 0, 38] },
    ]);

    kit.add(new THREE.HemisphereLight(0x3a4658, 0x16110d, 0.9));
    game.setSky(0x090b0e, 0.04);

    const spawns = new Map<string, Spawn>([
      ['from-yard', { pos: new THREE.Vector3(0, 0, -2), yaw: Math.PI }],
      ['from-pool', { pos: new THREE.Vector3(0, -2.4, 48.6), yaw: 0 }],
      ['freight-gate', { pos: new THREE.Vector3(-5.5, 0, 35), yaw: -Math.PI / 2 }],
    ]);

    const irregular = irregularEvent(game, kit, fall, rockfall);
    return {
      spawns,
      interactables,
      update: (dt) => irregular.update(dt),
      frame: (dt, time) => irregular.frame(dt, time),
      dispose: () => irregular.dispose(),
    };
  },
};
