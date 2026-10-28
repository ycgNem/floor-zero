import * as THREE from 'three';
import { createRng } from '../../core/rng';
import { noticeboard as noticeboardPanel } from '../../town/noticeboard';
import { NODE_PLACEMENTS } from '../../data/placements';
import type { AreaDef, Interactable, Spawn } from '../area';
import { restBench } from '../safe-room';
import { barrel, bench, cart, crate, lanternPost, noticeboard, pipe, rails, rubble, stalactites, supportFrame, wallLantern } from '../props';
import { liftCage } from '../structures';

/** Floor 1. The lift landing, the yard, the worker shelter, and the way down. */
export const entryYard: AreaDef = {
  id: 'entry-yard',
  name: 'The Entry Yard',
  floor: 1,
  fog: { color: 0x14171c, density: 0.03 },
  build({ game, kit }) {
    const rng = createRng(2201);
    const interactables: Interactable[] = [];

    // Lift alcove: the shaft rises into darkness above the cage.
    kit.room({ at: [0, 0, -0.1], size: [4.2, 24, 4.2], wall: 'rock', ceiling: null, openings: [{ side: 's', width: 3.6, height: 3.6 }] });
    liftCage(kit, [0, 0, -0.1], 0, 22);

    // Landing hall.
    kit.room({
      at: [0, 0, 9],
      size: [14, 6, 12],
      wall: 'rock',
      openings: [
        { side: 'n', width: 3.6, height: 3.6 },
        { side: 's', width: 6, height: 4.5 },
        { side: 'e', at: 2, width: 1.6, height: 2.4 },
      ],
    });
    for (const z of [5, 9, 13]) supportFrame(kit, [0, 0, z], 13.2, 6, 0);
    lanternPost(kit, [-5.5, 0, 6], { yaw: Math.PI / 2, shadow: true });
    lanternPost(kit, [5.5, 0, 12.5], { yaw: -Math.PI / 2 });
    noticeboard(kit, [-6.6, 0, 11], Math.PI / 2);
    crate(kit, [5.6, 0, 4.2], 0.9, 0.2);
    crate(kit, [6.2, 0, 5.1], 0.7, 0.8);
    barrel(kit, [-6.2, 0, 4]);

    // Worker shelter: the first safe room.
    kit.room({ at: [10.5, 0, 11], size: [5, 3.2, 6], wall: 'stone_wall', floor: 'wood', ceiling: 'wood_dark', openings: [{ side: 'w', width: 1.6, height: 2.4 }] });
    bench(kit, [10.5, 0, 13.4], Math.PI);
    kit.box({ at: [12.2, 0.45, 9.4], size: [1, 0.9, 1.6], mat: 'wood', bevel: 0.02 });
    wallLantern(kit, [12.85, 2.4, 11], -Math.PI / 2, 5, true);

    // The yard.
    kit.room({
      at: [0, 0, 26],
      size: [22, 8, 20],
      wall: 'rock',
      openings: [
        { side: 'n', width: 6, height: 4.5 },
        { side: 's', at: -4, width: 3.4, height: 3.6 },
        { side: 'w', at: 3, width: 2.6, height: 3 },
        { side: 'e', at: -5, width: 3, height: 3.4 },
      ],
    });
    for (const z of [19, 25, 31]) supportFrame(kit, [0, 0, z], 21, 8, 0);
    stalactites(kit, rng, [0, 8, 26], 9, 26);
    rails(kit, [3, 0, 1.5], [3, 0, 33]);
    cart(kit, [3, 0, 22], 0, 'ore_copper');
    cart(kit, [3, 0, 29.5], 0.05);
    rubble(kit, rng, [-9, 0, 34], 2.2, 10);
    rubble(kit, rng, [9.5, 0, 17.5], 1.6, 7);
    rubble(kit, rng, [-10, 0, 18], 1.4, 5);
    crate(kit, [8.6, 0, 34.2], 0.9, 0.4);
    barrel(kit, [9.6, 0, 33.6]);
    lanternPost(kit, [-8.5, 0, 21], { yaw: Math.PI / 2 });
    lanternPost(kit, [8.8, 0, 26], { yaw: -Math.PI / 2, shadow: true });
    lanternPost(kit, [-7, 0, 32.5], { yaw: Math.PI / 2 });

    // Iron alcove to the east.
    kit.room({ at: [14.5, 0, 21], size: [5, 3.8, 6], wall: 'rock', openings: [{ side: 'w', width: 3, height: 3.4 }] });
    wallLantern(kit, [16.85, 2.6, 21], -Math.PI / 2, 5);
    rubble(kit, rng, [13.2, 0, 23.2], 0.9, 4);

    // Storeroom behind the cracked wall.
    kit.room({ at: [-15, 0, 29], size: [6, 3.2, 5], wall: 'ancient', floor: 'ancient', ceiling: 'ancient', openings: [{ side: 'e', width: 2.6, height: 3 }] });
    crate(kit, [-17, 0, 27.6], 0.8, 0.1);
    crate(kit, [-16.8, 0, 30.6], 0.7, 0.5);

    // The passage south toward the Broken Galleries.
    kit.room({ at: [-4, 0, 42], size: [3.4, 3.6, 10], wall: 'rock', openings: [{ side: 'n', width: 3.4, height: 3.6 }] });
    supportFrame(kit, [-4, 0, 39.5], 3.2, 3.6, 0);
    supportFrame(kit, [-4, 0, 44], 3.2, 3.6, 0);
    wallLantern(kit, [-5.55, 2.5, 42], Math.PI / 2, 5);

    kit.add(new THREE.HemisphereLight(0x3e4a5e, 0x1e1712, 1.0));
    game.setSky(0x0b0d11, 0.034);

    // A test lever by the lift, for checking that flags survive a save.
    const lever = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), kit.materials.get('rust'));
    handle.position.y = 0.22;
    lever.add(handle, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), kit.materials.get('metal')));
    lever.position.set(2.6, 1.3, 3.05);
    kit.add(lever);
    const setLeverPose = (): void => {
      lever.rotation.z = game.hasFlag('test_lever') ? -0.7 : 0.7;
    };
    setLeverPose();

    interactables.push(
      {
        id: 'yard-lift',
        position: new THREE.Vector3(0, 1.2, -0.1),
        radius: 1.7,
        range: 3.5,
        mode: 'press',
        enabled: () => true,
        label: () => 'Ride the lift up to Bellwether',
        press: () => game.travel('lift-plaza', 'lift', 'lift'),
      },
      {
        id: 'yard-test-lever',
        position: lever.position,
        radius: 0.4,
        mode: 'press',
        enabled: () => true,
        label: () => (game.hasFlag('test_lever') ? 'Pull the lever back' : 'Pull the lever'),
        press: () => {
          game.toggleFlag('test_lever');
          setLeverPose();
        },
      },
      {
        id: 'yard-noticeboard',
        position: new THREE.Vector3(-6.6, 1.4, 11),
        radius: 1,
        mode: 'press',
        enabled: () => true,
        label: () => 'Read the noticeboard',
        press: () => game.panels.show(() => noticeboardPanel(game, 'Entry Yard')),
      },
      {
        id: 'yard-galleries-way',
        position: new THREE.Vector3(-4, 1.5, 46.5),
        radius: 1.6,
        mode: 'press',
        enabled: () => true,
        label: () => (game.hasFlag('license_granted') ? 'Go down to the Broken Galleries' : 'The Broken Galleries (needs a license)'),
        press: () => {
          if (!game.hasFlag('license_granted')) game.hud.toast('Not past the yard without a license. Mara’s rule.', 'warn');
          else void game.travel('broken-galleries', 'from-yard', 'walk');
        },
      },
      restBench(game, 'yard-shelter-rest', new THREE.Vector3(10.5, 0.6, 13.4)),
    );


    // Town Works: the freight hoist beside the lift, sending a pack up to storage on its own line.
    if (game.hasFlag('hoist_built')) {
      const hoist = [-3.9, 0, 3.6] as const;
      for (const dx of [-0.8, 0.8]) kit.box({ at: [hoist[0] + dx, 1.7, hoist[2]], size: [0.18, 3.4, 0.18], mat: 'wood_dark' });
      kit.box({ at: [hoist[0], 3.45, hoist[2]], size: [2, 0.2, 0.22], mat: 'wood_dark', collide: false });
      kit.box({ at: [hoist[0], 3.25, hoist[2]], size: [0.32, 0.32, 0.12], mat: 'metal', collide: false });
      pipe(kit, [hoist[0], 3.3, hoist[2]], [hoist[0], 6, hoist[2]], 0.02, 'canvas');
      pipe(kit, [hoist[0], 1.2, hoist[2]], [hoist[0], 3.2, hoist[2]], 0.02, 'canvas');
      crate(kit, [hoist[0], 0.25, hoist[2]], 0.75, 0.1);
      interactables.push({
        id: 'yard-hoist',
        position: new THREE.Vector3(hoist[0], 1, hoist[2]),
        radius: 0.9,
        mode: 'press',
        enabled: () => true,
        label: () => 'Send your pack up on the freight hoist',
        press: () => game.town.freight('on the hoist'),
      });
    }

    // An old quarry shaft, grated over. It drops straight to Lantern Pool, once someone rigs a ladder from below.
    const shaftAt = [7.6, 0, 34] as const;
    for (const [dx, dz, w, d] of [[0, -0.95, 2.3, 0.4], [0, 0.95, 2.3, 0.4], [-0.95, 0, 0.4, 1.5], [0.95, 0, 0.4, 1.5]] as const) {
      kit.box({ at: [shaftAt[0] + dx, 0.35, shaftAt[2] + dz], size: [w, 0.7, d], mat: 'stone_wall', bevel: 0.04 });
    }
    kit.box({ at: [shaftAt[0], 0.02, shaftAt[2]], size: [1.5, 0.04, 1.5], mat: 'water', collide: false, shadow: false });
    const grate = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.7), kit.materials.get('rust'));
      bar.position.set(-0.62 + i * 0.25, 0, 0);
      grate.add(bar);
    }
    const ladderOpen = game.hasFlag('pool_ladder_secured');
    // Closed it lies on the collar; open it leans against it, and the rope ladder's top hooks over the rim.
    if (ladderOpen) {
      grate.position.set(shaftAt[0] + 1.35, 0.75, shaftAt[2]);
      grate.rotation.z = 1.2;
      for (const side of [-0.22, 0.22]) kit.box({ at: [shaftAt[0] - 0.75, 0.6, shaftAt[2] + side], size: [0.12, 0.3, 0.04], mat: 'canvas', collide: false });
    } else grate.position.set(shaftAt[0], 0.73, shaftAt[2]);
    kit.add(grate);
    interactables.push({
      id: 'yard-quarry-shaft',
      position: new THREE.Vector3(shaftAt[0], 0.8, shaftAt[2]),
      radius: 0.9,
      mode: 'press',
      enabled: () => true,
      label: () => (game.hasFlag('pool_ladder_secured') ? 'Climb down the rope ladder to Lantern Pool' : 'An old shaft, grated over'),
      press: () => {
        if (game.hasFlag('pool_ladder_secured')) void game.travel('lantern-pool', 'from-ladder', 'walk');
        else game.hud.toast('The grate is rusted shut. Far below, you can hear water.', 'warn');
      },
    });

    game.gathering.spawn(kit, NODE_PLACEMENTS['entry-yard'], interactables);

    // The cracked wall: builders' stone behind quarry rubble. Needs an iron pick and Mining 12.
    let wallBreaking = -1;
    let wall: THREE.Group | null = null;
    let wallCollider: ReturnType<typeof kit.physics.addBox> | null = null;
    if (!game.hasFlag('cracked_wall_broken')) {
      wall = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 2.6), kit.materials.get('crack'));
      slab.castShadow = true;
      slab.receiveShadow = true;
      wall.add(slab);
      for (let i = 0; i < 6; i++) {
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.5 + rng() * 0.9), kit.materials.get('wood_dark'));
        crack.position.set(0, -1.2 + rng() * 2.4, -0.8 + rng() * 1.6);
        crack.rotation.x = (rng() - 0.5) * 1.6;
        wall.add(crack);
      }
      wall.position.set(-11.25, 1.5, 29);
      kit.add(wall);
      wallCollider = kit.physics.addBox(new THREE.Vector3(-11.25, 1.5, 29), new THREE.Vector3(0.5, 3, 2.6));
      kit.colliders.push(wallCollider);
    }
    const wallBlocker = (): string | null => {
      const pick = game.state.player.equipment.pickaxe;
      if (pick !== 'iron_pickaxe' && pick !== 'cobalt_pickaxe') return 'needs an iron pickaxe';
      if (game.progress.level('mining') < 12) return 'needs Mining 12';
      return null;
    };
    interactables.push({
      id: 'yard-cracked-wall',
      position: new THREE.Vector3(-11, 1.5, 29),
      radius: 1.3,
      mode: 'press',
      enabled: () => wall !== null && wallBreaking < 0,
      label: () => {
        const blocked = wallBlocker();
        return blocked ? `Cracked wall (${blocked})` : 'Break the cracked wall';
      },
      press: () => {
        if (!wall || wallBreaking >= 0) return;
        const blocked = wallBlocker();
        if (blocked) {
          game.hud.toast(`The cracked wall ${blocked}.`, 'warn');
          return;
        }
        wallBreaking = 0;
        game.heldOverride = { held: 'pickaxe', item: game.state.player.equipment.pickaxe };
      },
    });

    if (!game.hasFlag('storeroom_looted')) {
      interactables.push({
        id: 'yard-storeroom-crate',
        position: new THREE.Vector3(-17, 0.6, 27.6),
        radius: 0.7,
        mode: 'press',
        enabled: () => !game.hasFlag('storeroom_looted'),
        label: () => 'Search the old crate',
        press: () => {
          game.setFlag('storeroom_looted');
          if (!game.hasFlag('schematic_delivered')) game.progress.give('storeroom_schematic');
          game.progress.give('salvaged_spring');
          game.progress.addMoney(25);
          game.hud.announce('Discovery', 'Builders’ drawings');
        },
      });
    }

    const spawns = new Map<string, Spawn>([
      ['lift', { pos: new THREE.Vector3(0, 0, -0.1), yaw: Math.PI }],
      ['shelter', { pos: new THREE.Vector3(10.5, 0, 11), yaw: Math.PI / 2 }],
      ['from-galleries', { pos: new THREE.Vector3(-4, 0, 45), yaw: 0 }],
      ['from-ladder', { pos: new THREE.Vector3(6, 0, 34), yaw: 0 }],
    ]);

    const SWING = 1.25;
    return {
      spawns,
      interactables,
      update: (dt) => {
        if (wallBreaking < 0 || !wall) return;
        if (game.player.position.distanceTo(wall.position) > 3.8) {
          wallBreaking = -1;
          game.heldOverride = null;
          return;
        }
        const before = Math.floor(wallBreaking / SWING);
        wallBreaking += dt;
        const swings = Math.floor(wallBreaking / SWING);
        if (swings > before || wallBreaking === dt) game.viewmodel.swing(SWING, 'mine');
        if (swings > before) {
          game.events.emit('nodeStruck', { position: wall.position.clone(), skill: 'mining' });
          game.player.addShake(0.15);
          wall.position.x += 0.03;
        }
        if (swings >= 4) {
          game.events.emit('nodeYield', { position: wall.position.clone(), item: 'copper_ore' });
          wall.removeFromParent();
          wall = null;
          if (wallCollider) kit.physics.remove(wallCollider);
          wallCollider = null;
          wallBreaking = -1;
          game.heldOverride = null;
          game.setFlag('cracked_wall_broken');
          game.progress.addXp('mining', 120);
          game.player.addShake(0.5);
          game.hud.announce('Discovery', 'A sealed storeroom');
        }
      },
    };
  },
};
