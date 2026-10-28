import * as THREE from 'three';
import { createRng } from '../../core/rng';
import { Sluicekeeper } from '../../combat/enemies/sluicekeeper';
import { ITEMS, type ItemId } from '../../data/items';
import { insideOut } from '../../render/shapes';
import type { AreaDef, Interactable, Spawn } from '../area';
import type { V3 } from '../level-kit';
import { pipe, rubble, stalactites, wallLantern } from '../props';
import { Surges } from '../surges';
import { pool } from '../water';

/** The pump hall's sunken basin, where the Sluicekeeper stands. */
const BASIN = { x: 0, z: 38, r: 11, floor: -1.2, shallow: -1.1, flooded: -0.35 };
const CELLS: readonly { id: string; at: V3; item: ItemId; count: number }[] = [
  { id: 'ps-cell-1', at: [-27.4, 0, 35], item: 'dim_core', count: 5 },
  { id: 'ps-cell-2', at: [-27.4, 0, 38], item: 'dim_core', count: 5 },
  { id: 'ps-cell-3', at: [-27.4, 0, 41], item: 'bright_core', count: 2 },
];

/** Floor 5. Surge channels, three repairs, and the Sluicekeeper in its flooded basin. */
export const pumpStation: AreaDef = {
  id: 'pump-station',
  name: 'The Pump Station',
  floor: 5,
  fog: { color: 0x12161a, density: 0.028 },
  build({ game, kit }) {
    const rng = createRng(6607);
    const interactables: Interactable[] = [];
    const has = (flag: Parameters<typeof game.hasFlag>[0]): boolean => game.hasFlag(flag);
    const repaired = (): boolean => has('pump_power_restored') && has('pump_intake_cleared') && has('pump_sequence_known');
    const owned: THREE.Material[] = [];

    // The stair down from the Lower Cut.
    kit.room({ at: [0, 0, -4], size: [3.4, 3.8, 6], wall: 'stone_wall', floor: 'stone_floor', openings: [{ side: 's', width: 3.4, height: 3.8 }] });
    kit.stairs({ from: [0, 0, -3.2], to: [0, 1.2, -6], width: 3.2, mat: 'stone_floor' });
    kit.box({ at: [0, 0.6, -6.5], size: [3.4, 1.2, 1], mat: 'stone_floor' });

    // The sluice gallery: three surge channels to cross.
    kit.room({ at: [0, 0, 9], size: [20, 7, 18], wall: 'stone_wall', floor: null, openings: [{ side: 'n', width: 3.4, height: 3.8 }, { side: 's', width: 4, height: 4.5 }] });
    const channels = [4.5, 9, 13.5];
    const strips: [number, number][] = [[-0.5, 3.2], [5.8, 7.7], [10.3, 12.2], [14.8, 18.5]];
    for (const [z0, z1] of strips) kit.box({ at: [0, -0.25, (z0 + z1) / 2], size: [21, 0.5, z1 - z0], mat: 'ancient' });
    for (const z of channels) kit.box({ at: [0, -0.6, z], size: [21, 0.5, 2.6], mat: 'stone_floor' });
    const surges = new Surges(
      game,
      kit,
      channels.map((z, i) => ({ id: `ps-channel-${i + 1}`, z, x0: -10, x1: 10, width: 2.6, period: [7.5, 6.5, 8.5][i] ?? 7, offset: [0, 2.4, 4.6][i] ?? 0, valve: [-9.75, 1.2, z - 2] as V3 })),
      -0.35,
      () => !has('sluicekeeper_defeated'),
      interactables,
    );
    pipe(kit, [-9.6, 5.8, 0.5], [-9.6, 5.8, 17.5], 0.25);
    pipe(kit, [9.6, 5.2, 0.5], [9.6, 5.2, 17.5], 0.18);

    // The pump hall, with its sunken basin.
    kit.room({
      at: [0, 0, 38],
      size: [36, 12, 38],
      wall: 'stone_wall',
      floor: null,
      openings: [
        { side: 'n', width: 4, height: 4.5 },
        { side: 'w', width: 3, height: 3.5 },
        { side: 'e', width: 3, height: 3.5 },
        { side: 's', width: 2.4, height: 3 },
      ],
    });
    const hall = new THREE.Shape();
    hall.moveTo(-18.5, -18.5);
    hall.lineTo(18.5, -18.5);
    hall.lineTo(18.5, -57.5);
    hall.lineTo(-18.5, -57.5);
    hall.closePath();
    const hole = new THREE.Path();
    hole.absarc(BASIN.x, -BASIN.z, BASIN.r, 0, Math.PI * 2, true);
    hall.holes.push(hole);
    kit.solid(new THREE.ExtrudeGeometry(hall, { depth: 0.5, bevelEnabled: false, curveSegments: 48 }), 'ancient', [0, -0.5, 0], new THREE.Euler(-Math.PI / 2, 0, 0));
    kit.solid(insideOut(new THREE.CylinderGeometry(BASIN.r, BASIN.r, 1.2, 64, 1, true)), 'stone_wall', [BASIN.x, -0.6, BASIN.z]);
    kit.box({ at: [BASIN.x, BASIN.floor - 0.25, BASIN.z], size: [23, 0.5, 23], mat: 'stone_floor' });
    kit.cylinder({ at: [BASIN.x, -0.6, BASIN.z], radius: 2.6, height: 1.2, mat: 'ancient', segments: 32 });
    kit.box({ at: [BASIN.x, -0.15, BASIN.z], size: [2.2, 0.3, 22.2], mat: 'metal' });
    kit.box({ at: [BASIN.x, -0.15, BASIN.z], size: [22.2, 0.3, 2.2], mat: 'metal' });
    for (const deg of [20, 160, 200, 340]) {
      const a = (deg * Math.PI) / 180;
      const at = (r: number, y: number): V3 => [BASIN.x + Math.sin(a) * r, y, BASIN.z + Math.cos(a) * r];
      kit.stairs({ from: at(BASIN.r, 0), to: at(8.4, BASIN.floor), width: 1.8, mat: 'stone_floor' });
    }
    for (const deg of [45, 135, 225, 315]) {
      const a = (deg * Math.PI) / 180;
      kit.cylinder({ at: [BASIN.x + Math.sin(a) * 7.2, 5.4, BASIN.z + Math.cos(a) * 7.2], radius: 0.8, height: 13.2, mat: 'ancient', segments: 16 });
    }
    const basin = pool(kit, { center: [BASIN.x, BASIN.shallow, BASIN.z], size: [22, 22], eels: 0, motes: 0 });
    for (const x of [-16, 16]) pipe(kit, [x, 8, 20], [x, 8, 56], 0.35);
    stalactites(kit, rng, [0, 12, 38], 14, 18);
    rubble(kit, rng, [-15.5, 0, 54], 1.4, 8);
    rubble(kit, rng, [15, 0, 22], 1.2, 7);

    // Lights: dim red emergency lamps until the cells are fed, then the work lamps.
    const work: { light: THREE.PointLight; full: number }[] = [];
    const workLight = (at: V3, full: number, distance: number): void => {
      const light = kit.pointLight({ at, color: 0xffd8a8, intensity: 0, distance, bulb: false });
      kit.box({ at: [at[0], at[1] + 0.3, at[2]], size: [0.8, 0.25, 0.5], mat: 'metal', collide: false });
      work.push({ light, full });
    };
    for (const [x, z] of [[-13, 25], [13, 25], [-13, 51], [13, 51]] as const) workLight([x, 9, z], 22, 30);
    workLight([0, 6, 5], 12, 18);
    workLight([0, 6, 14], 12, 18);
    workLight([-24, 4.8, 38], 10, 14);
    for (const at of [[-9.5, 2.5, 2], [9.5, 2.5, 16], [-17.5, 3, 30], [17.5, 3, 46]] as const) kit.pointLight({ at, color: 0xff3a2a, intensity: 2.2, distance: 9 });
    const setPower = (on: boolean): void => {
      for (const w of work) w.light.intensity = on ? w.full : 0;
    };
    setPower(has('pump_power_restored'));

    // The generator wing: three cells to feed with cores.
    kit.room({ at: [-24, 0, 38], size: [10, 6, 10], wall: 'stone_wall', floor: 'ancient', openings: [{ side: 'e', width: 3, height: 3.5 }] });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false });
    owned.push(glass);
    for (const cell of CELLS) {
      const [x, , z] = cell.at;
      kit.cylinder({ at: [x, 0.3, z], radius: 0.6, height: 0.6, mat: 'metal', segments: 16 });
      kit.cylinder({ at: [x, 2.6, z], radius: 0.65, height: 0.3, mat: 'metal', segments: 16, collide: false });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.7, 20, 1, true), glass);
      tube.position.set(x, 1.45, z);
      kit.add(tube);
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x0a1a20, emissive: 0x9ef3ff, emissiveIntensity: 0 });
      owned.push(coreMat);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), coreMat);
      core.position.set(x, 1.4, z);
      kit.add(core);
      const fed = (): boolean => game.state.counters[cell.id] === 1;
      if (fed()) coreMat.emissiveIntensity = 3;
      interactables.push({
        id: cell.id,
        position: new THREE.Vector3(x + 0.4, 1.3, z),
        radius: 0.8,
        mode: 'press',
        enabled: () => true,
        label: () => (fed() ? 'Power cell (charged)' : `Feed the power cell (${cell.count} ${ITEMS[cell.item].name.toLowerCase()}s)`),
        press: () => {
          if (fed()) return;
          if (game.progress.count(cell.item) < cell.count) {
            game.hud.toast(`It needs ${cell.count} ${ITEMS[cell.item].name.toLowerCase()}s. Every core spent here is one you don't sell.`, 'warn');
            return;
          }
          game.progress.take(cell.item, cell.count);
          game.state.counters[cell.id] = 1;
          coreMat.emissiveIntensity = 3;
          game.effects.burst(core.position.clone(), { count: 20, color: 0x9ef3ff, speed: 2, size: 0.05, life: 0.7, emissive: true });
          if (CELLS.every((c) => game.state.counters[c.id] === 1)) {
            game.setFlag('pump_power_restored');
            setPower(true);
            game.hud.announce('Power restored', 'The Pump Station wakes');
          }
          game.save();
        },
      });
    }
    wallLantern(kit, [-19.15, 2.4, 35], Math.PI / 2, 3);

    // The intake wing, choked by a Sinkmaw brood. Cobalt shows in the rock once it's clear.
    kit.room({ at: [24, 0, 38], size: [10, 6, 10], wall: 'stone_wall', floor: 'dirt', openings: [{ side: 'w', width: 3, height: 3.5 }] });
    for (let i = 0; i < 9; i++) kit.box({ at: [28.7, 2.4, 34.4 + i * 0.9], size: [0.12, 4.8, 0.12], mat: 'rust', collide: false });
    kit.box({ at: [28.85, 2.4, 38], size: [0.2, 4.8, 9], mat: 'stone_wall' });
    if (!has('pump_intake_cleared')) {
      game.combat.spawn(kit, [
        { id: 'ps-brood', type: 'brood_nest', at: [26.4, 0, 38] },
        { id: 'ps-sinkmaw-1', type: 'sinkmaw', at: [22, 0, 35.5] },
        { id: 'ps-sinkmaw-2', type: 'sinkmaw', at: [23, 0, 41] },
        { id: 'ps-sinkmaw-3', type: 'sinkmaw', at: [27, 0, 41.5] },
      ]);
    }
    const offKilled = game.events.on('enemyKilled', ({ type }) => {
      if (type !== 'brood_nest' || has('pump_intake_cleared')) return;
      game.setFlag('pump_intake_cleared');
      game.hud.announce('Intake cleared', 'The pumps can draw again');
      game.save();
    });

    // The control room: the plate in the old script, a maintenance locker, and the main controls.
    kit.room({ at: [0, 0, 62], size: [12, 5, 8], wall: 'stone_wall', floor: 'ancient', ceiling: 'ancient', openings: [{ side: 'n', width: 2.4, height: 3 }] });
    kit.box({ at: [0, 0.5, 65.3], size: [3.4, 1, 0.8], mat: 'metal' });
    kit.box({ at: [0, 1.3, 65.6], size: [3.4, 0.6, 0.2], mat: 'rust', collide: false });
    for (const x of [-1.1, 0, 1.1]) {
      kit.cylinder({ at: [x, 1.35, 65.48], radius: 0.18, height: 0.04, mat: 'canvas', segments: 16, collide: false });
      kit.box({ at: [x + 0.4, 1.05, 65.0], size: [0.05, 0.4, 0.05], mat: 'hazard', rotX: -0.4, collide: false });
    }
    wallLantern(kit, [5.85, 2.8, 62], -Math.PI / 2, 5);
    kit.box({ at: [-4.4, 0.45, 62.5], size: [1.4, 0.9, 0.8], mat: 'wood', bevel: 0.02 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.22), kit.materials.get('interact'));
    plate.position.set(-4.4, 0.92, 62.5);
    plate.rotation.y = 0.3;
    plate.visible = !has('pump_plate_found');
    kit.add(plate);
    kit.box({ at: [4.9, 1.1, 60.7], size: [0.9, 2.2, 0.7], mat: 'rust' });
    const lockerDoor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.66), kit.materials.get('metal'));
    lockerDoor.position.set(4.42, 1.1, 60.7);
    if (has('pick_head_found')) lockerDoor.rotation.y = -1.2;
    kit.add(lockerDoor);

    // The Sluicekeeper, standing in its basin.
    let flooding = false;
    const keeper = new Sluicekeeper(game.combat, 'ps-sluicekeeper', new THREE.Vector3(BASIN.x, 0, BASIN.z), Math.PI);
    if (has('sluicekeeper_defeated')) {
      keeper.retire();
      kit.add(keeper.group);
    } else {
      keeper.onFlood = () => {
        flooding = true;
        game.hud.subtitle('[water roaring into the basin]', 3);
      };
      keeper.onShutdown = () => {
        flooding = false;
        game.setFlag('sluicekeeper_defeated');
        game.setFlag('floor_markers_lit');
        game.progress.give('pressure_valve');
        game.hud.announce('The Sluicekeeper', 'Shut down');
        game.hud.toast('The pumps settle into a steady beat. Far above, lights are coming on.', 'good', 6);
        game.save();
      };
      game.combat.adopt(keeper, kit.root);
    }

    interactables.push(
      {
        id: 'ps-plate',
        position: new THREE.Vector3(-4.4, 1, 62.5),
        radius: 0.6,
        mode: 'press',
        enabled: () => !has('pump_plate_found'),
        label: () => 'Take the brass control plate',
        press: () => {
          if (!game.progress.hasSpace('control_plate')) {
            game.hud.toast('Your pack is full.', 'warn');
            return;
          }
          game.progress.give('control_plate');
          game.setFlag('pump_plate_found');
          plate.visible = false;
          game.hud.toast('Covered in the old script. Iona could read this.', 'info', 4);
        },
      },
      {
        id: 'ps-locker',
        position: new THREE.Vector3(4.6, 1.2, 60.7),
        radius: 0.7,
        mode: 'press',
        enabled: () => !has('pick_head_found'),
        label: () => (repaired() ? 'Open the maintenance locker' : 'Maintenance locker (sealed until the station is repaired)'),
        press: () => {
          if (!repaired()) {
            game.hud.toast('The lock is driven by the station. It won’t open until the station runs.', 'warn');
            return;
          }
          game.progress.give('tempered_pick_head');
          game.setFlag('pick_head_found');
          lockerDoor.rotation.y = -1.2;
          game.hud.announce('Discovery', 'A tempered pick head');
          game.save();
        },
      },
      {
        id: 'ps-controls',
        position: new THREE.Vector3(0, 1.2, 64.7),
        radius: 1.2,
        mode: 'press',
        enabled: () => !has('sluicekeeper_defeated'),
        label: () => (repaired() ? 'Engage the main controls' : 'Main controls (the station isn’t ready)'),
        press: () => {
          if (!repaired()) {
            const missing = [!has('pump_power_restored') && 'power in the cells', !has('pump_intake_cleared') && 'a clear intake', !has('pump_sequence_known') && 'the operating sequence'].filter(Boolean);
            game.hud.toast(`The station still needs ${missing.join(', ')}.`, 'warn', 4);
            return;
          }
          if (keeper.state !== 'dormant') return;
          keeper.wake();
          game.player.addShake(0.4);
          game.hud.subtitle('[something enormous grinding awake in the hall]', 3);
        },
      },
      {
        id: 'ps-to-cut',
        position: new THREE.Vector3(0, 2.6, -6.6),
        radius: 1.3,
        mode: 'press',
        enabled: () => true,
        label: () => 'Climb back up to the Lower Cut',
        press: () => void game.travel('lower-cut', 'from-pump', 'walk'),
      },
    );

    game.gathering.spawn(kit, [
      { id: 'ps-cobalt-1', type: 'cobalt_seam', at: [27.4, 0, 34.6] },
      { id: 'ps-cobalt-2', type: 'cobalt_seam', at: [27.4, 0, 41.6] },
      { id: 'ps-iron-1', type: 'iron_seam', at: [-16.6, 0, 22] },
    ], interactables);
    if (!has('sluicekeeper_defeated')) {
      game.combat.spawn(kit, [
        { id: 'ps-lampwarden-1', type: 'lampwarden', at: [-25, 0, 36.5], yaw: Math.PI / 2 },
        { id: 'ps-scuttler-1', type: 'scuttler', at: [-23, 0, 40] },
        { id: 'ps-scuttler-2', type: 'scuttler', at: [-26, 0, 41] },
      ]);
    }

    kit.add(new THREE.HemisphereLight(0x3e4a55, 0x100f0f, 0.95));

    const spawns = new Map<string, Spawn>([['from-cut', { pos: new THREE.Vector3(0, 0, -2.4), yaw: Math.PI }]]);

    return {
      spawns,
      interactables,
      update: (dt) => {
        surges.update(dt);
        // The basin floods in the second phase and drains once it's over; wading through it is slow.
        const level = basin.surface.position.y;
        const target = flooding ? BASIN.flooded : BASIN.shallow;
        basin.surface.position.y = level + Math.sign(target - level) * Math.min(Math.abs(target - level), dt * 0.3);
        const p = game.player.position;
        const wading = basin.surface.position.y > -0.7 && p.y < -0.5 && Math.hypot(p.x - BASIN.x, p.z - BASIN.z) < BASIN.r;
        game.combat.moveScale = wading ? 0.6 : 1;
      },
      frame: (dt, time) => {
        surges.frame(dt, time);
        basin.frame(dt, time);
      },
      dispose: () => {
        offKilled();
        surges.dispose();
        basin.dispose();
        for (const m of owned) m.dispose();
      },
    };
  },
};
