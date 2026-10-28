import * as THREE from 'three';
import { createRng, randRange } from '../../core/rng';
import { noticeboard as noticeboardPanel } from '../../town/noticeboard';
import type { AreaDef, Interactable, Spawn } from '../area';
import type { MaterialKey } from '../materials';
import { barrel, building, crate, faceCenter, lanternPost, noticeboard, offset, polar, railing, wallLantern } from '../props';
import { headframe, liftCage, marketStall } from '../structures';

export const SHAFT_R = 7;
const WALL_R = 37;
const FRONT_R = 26;

/** Where each town service stands, as polar angles around the shaft. */
export const TOWN_SPOTS = {
  survey: 45,
  forge: 112,
  inn: 180,
  kitchen: 245,
  market: 312,
} as const;

/** Position in front of a town building, where its keeper stands. */
export function keeperSpot(angle: number): THREE.Vector3 {
  const p = polar(angle, FRONT_R - 1.6);
  return new THREE.Vector3(p[0], 0, p[2]);
}

export const liftPlaza: AreaDef = {
  id: 'lift-plaza',
  name: 'Bellwether',
  floor: 0,
  fog: { color: 0x0f1522, density: 0.011 },
  build({ game, kit }) {
    const rng = createRng(1107);
    const evening = game.state.evening;
    const interactables: Interactable[] = [];

    // The plaza: a ring of cobbles around the shaft, with a stone lip at the edge.
    const ring = new THREE.Shape();
    ring.absarc(0, 0, WALL_R, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, SHAFT_R, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    kit.solid(new THREE.ExtrudeGeometry(ring, { depth: 1, bevelEnabled: false, curveSegments: 72 }), 'cobble', [0, 0, 0], new THREE.Euler(Math.PI / 2, 0, 0));
    const lip = new THREE.Shape();
    lip.absarc(0, 0, SHAFT_R + 0.7, 0, Math.PI * 2, false);
    const lipHole = new THREE.Path();
    lipHole.absarc(0, 0, SHAFT_R, 0, Math.PI * 2, true);
    lip.holes.push(lipHole);
    kit.geometry(new THREE.ExtrudeGeometry(lip, { depth: 0.22, bevelEnabled: false, curveSegments: 72 }), 'stone_wall', [0, 0, 0], new THREE.Euler(-Math.PI / 2, 0, 0));

    // The shaft walls, falling away into the dark.
    const shaftSegments = 28;
    for (let i = 0; i < shaftSegments; i++) {
      const a = (i / shaftSegments) * 360;
      kit.box({ at: polar(a, SHAFT_R + 0.6, -30), size: [(2 * Math.PI * (SHAFT_R + 0.6)) / shaftSegments + 0.12, 60, 1.2], mat: 'rock', rotY: faceCenter(a), collide: false, shadow: false });
    }
    for (const depth of [-6, -14, -23]) {
      for (let i = 0; i < 10; i++) {
        const a = i * 36 + randRange(rng, -8, 8);
        kit.box({ at: polar(a, SHAFT_R - 0.1, depth), size: [1.2, 0.3, 0.6], mat: 'wood_dark', rotY: faceCenter(a), collide: false, shadow: false });
      }
    }

    // The ancient ring wall, with ledges and houses stacked up it.
    const wallSegments = 56;
    for (let i = 0; i < wallSegments; i++) {
      const a = (i / wallSegments) * 360;
      const width = (2 * Math.PI * (WALL_R + 1.5)) / wallSegments + 0.15;
      kit.box({ at: polar(a, WALL_R + 1.5, 21), size: [width, 42, 3], mat: 'ancient', rotY: faceCenter(a), shadow: false });
      for (const ledge of [10, 19, 28]) {
        kit.box({ at: polar(a, WALL_R - 1.8, ledge), size: [width, 0.8, 3.6], mat: 'stone_wall', rotY: faceCenter(a), collide: false, shadow: false });
      }
    }
    for (const ledge of [10, 19, 28]) {
      for (let a = rng() * 30; a < 360; a += randRange(rng, 16, 30)) {
        const wall: MaterialKey = rng() > 0.6 ? 'brick' : rng() > 0.5 ? 'stone_wall' : 'plaster';
        building(kit, {
          at: polar(a, WALL_R - 3.4, ledge + 0.4),
          yaw: faceCenter(a),
          width: randRange(rng, 3.5, 6.5),
          depth: 3,
          height: randRange(rng, 3.5, 5.5),
          wall,
          windows: rng() > 0.4 ? 2 : 1,
          door: rng() > 0.5,
          collide: false,
        });
      }
    }

    // Town buildings at plaza level.
    const shop = (angle: number, width: number, height: number, wall: MaterialKey, windows: number, awning = false): void => {
      building(kit, { at: polar(angle, FRONT_R), yaw: faceCenter(angle), width, depth: 6, height, wall, windows, awning });
      wallLantern(kit, offset(polar(angle, FRONT_R), faceCenter(angle), width / 2 - 0.6, 2.6, 0.12), faceCenter(angle), 6);
    };
    shop(TOWN_SPOTS.survey, 9, 7, 'stone_wall', 3);
    shop(TOWN_SPOTS.forge, 8, 6, 'brick', 2);
    shop(TOWN_SPOTS.inn, 12, 8, 'plaster', 4);
    shop(TOWN_SPOTS.kitchen, 8, 6, 'plaster', 2, true);

    const forgeYaw = faceCenter(TOWN_SPOTS.forge);
    const forgeFront = polar(TOWN_SPOTS.forge, FRONT_R);
    kit.box({ at: offset(forgeFront, forgeYaw, 2.4, 9.5, -4), size: [1.3, 4, 1.3], mat: 'brick' });
    kit.box({ at: offset(forgeFront, forgeYaw, -2.2, 1, 0.06), size: [1.6, 1.2, 0.1], mat: 'lamp', rotY: forgeYaw, collide: false });
    kit.box({ at: offset(forgeFront, forgeYaw, 1.2, 0.45, 1.6), size: [0.9, 0.5, 0.4], mat: 'metal', rotY: forgeYaw, bevel: 0.03 });
    kit.box({ at: offset(forgeFront, forgeYaw, 1.2, 0.2, 1.6), size: [0.4, 0.4, 0.3], mat: 'wood_dark', rotY: forgeYaw, collide: false });
    const forgeLight = kit.pointLight({ at: offset(forgeFront, forgeYaw, -2.2, 1.2, 1.2), color: 0xff7a2e, intensity: 14, distance: 9, bulb: false });

    const innYaw = faceCenter(TOWN_SPOTS.inn);
    const innFront = polar(TOWN_SPOTS.inn, FRONT_R);
    kit.box({ at: offset(innFront, innYaw, -3.6, 3.4, 0.7), size: [0.08, 0.08, 1.3], mat: 'metal', rotY: innYaw, collide: false });
    kit.box({ at: offset(innFront, innYaw, -3.6, 2.85, 1.25), size: [1.2, 0.8, 0.08], mat: 'wood', rotY: innYaw, collide: false });

    for (let i = 0; i < 3; i++) {
      const a = TOWN_SPOTS.market - 14 + i * 14;
      marketStall(kit, polar(a, 22), faceCenter(a));
    }
    for (const [angle, radius] of [[100, 23], [125, 23.5], [190, 23], [258, 23.5]] as const) {
      if (rng() > 0.5) crate(kit, polar(angle, radius), 0.8, rng() * 3);
      else barrel(kit, polar(angle, radius));
    }

    // Lamps around the shaft.
    for (const a of [32, 68, 145, 215, 250, 325]) lanternPost(kit, polar(a, 11.5), { yaw: faceCenter(a), intensity: evening ? 10 : 4 });
    noticeboard(kit, polar(20, 10.5), faceCenter(20));

    // The floor markers: one lamp for every floor of the Old Works. Nobody alive has seen them lit.
    const markersLit = game.hasFlag('floor_markers_lit');
    const markerAt = polar(340, 9.4);
    kit.box({ at: [markerAt[0], 1.8, markerAt[2]], size: [0.5, 3.6, 0.5], mat: 'stone_wall', rotY: faceCenter(340), bevel: 0.04 });
    for (let floor = 0; floor < 6; floor++) {
      kit.cylinder({ at: offset([markerAt[0], 0.6 + floor * 0.52, markerAt[2]], faceCenter(340), 0, 0, 0.27), radius: 0.17, height: 0.06, mat: markersLit ? 'core' : 'metal', segments: 16, collide: false });
    }
    if (markersLit) kit.pointLight({ at: offset([markerAt[0], 2, markerAt[2]], faceCenter(340), 0, 0, 0.8), color: 0x9ef3ff, intensity: 4, distance: 7, bulb: false });

    // After the deep lift's first descent, the plaza keeps its festival lights strung up.
    if (game.hasFlag('deep_lift_ceremony')) {
      const posts = [32, 68, 145, 215, 250, 325];
      for (let i = 0; i < posts.length; i++) {
        const from = polar(posts[i] as number, 11.5, 2.75);
        const to = polar(posts[(i + 1) % posts.length] as number, 11.5, 2.75);
        for (let k = 1; k < 14; k++) {
          const t = k / 14;
          kit.geometry(new THREE.SphereGeometry(0.06, 8, 6), k % 3 === 0 ? 'core' : 'lamp', [from[0] + (to[0] - from[0]) * t, 2.75 - Math.sin(t * Math.PI) * 0.7, from[2] + (to[2] - from[2]) * t], undefined, false);
        }
      }
    }

    // The bridge across the shaft.
    kit.box({ at: [0, -0.2, 0], size: [2 * SHAFT_R + 1.6, 0.4, 2.8], mat: 'wood' });
    for (const z of [-1.2, 1.2]) kit.box({ at: [0, -0.6, z], size: [2 * SHAFT_R + 2, 0.4, 0.3], mat: 'wood_dark', collide: false });
    for (const z of [-1.4, 1.4]) railing(kit, [-SHAFT_R - 0.6, 0, z], [SHAFT_R + 0.6, 0, z]);

    // Railings around the shaft, with gaps for the lift and the bridge.
    for (const [from, to] of [[15, 78], [102, 258], [282, 345]] as const) {
      const steps = Math.ceil((to - from) / 12);
      for (let i = 0; i < steps; i++) {
        railing(kit, polar(from + ((to - from) * i) / steps, SHAFT_R + 0.3), polar(from + ((to - from) * (i + 1)) / steps, SHAFT_R + 0.3), 'metal');
      }
    }

    // The main lift and its headframe.
    const cage: [number, number, number] = [0, 0, -(SHAFT_R - 1.75)];
    liftCage(kit, cage, Math.PI, 14);
    const wheel = headframe(kit, cage, 0, 1.75);
    kit.pointLight({ at: [0, 3.3, cage[2]], color: 0xffc58a, intensity: 8, distance: 10, shadow: true });

    // Light and sky.
    kit.add(new THREE.HemisphereLight(evening ? 0x3a4a66 : 0x9db4d4, evening ? 0x1a1410 : 0x3a3026, evening ? 0.55 : 1.2));
    const sun = new THREE.DirectionalLight(evening ? 0x9fb4ff : 0xffe2b8, evening ? 0.5 : 2.4);
    sun.position.set(evening ? -25 : 28, 50, evening ? 18 : -12);
    sun.castShadow = true;
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    kit.add(sun);
    kit.add(sun.target);
    kit.pointLight({ at: [0, -14, 0], color: 0x5fa8ff, intensity: 1600, distance: 45, bulb: false });

    if (evening) {
      const stars = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) {
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(randRange(rng, 0.25, 1));
        stars.set([Math.sin(phi) * Math.cos(theta) * 160, Math.cos(phi) * 160, Math.sin(phi) * Math.sin(theta) * 160], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
      kit.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false })));
    }
    game.setSky(evening ? 0x0b1020 : 0x8fa6c4, evening ? 0.011 : 0.006);

    interactables.push({
      id: 'plaza-lift',
      position: new THREE.Vector3(cage[0], 1.2, cage[2]),
      radius: 1.7,
      range: 3.5,
      mode: 'press',
      enabled: () => true,
      label: () => 'Ride the lift down to the Entry Yard',
      press: () => game.travel('entry-yard', 'lift', 'lift'),
    });
    interactables.push({
      id: 'plaza-noticeboard',
      position: new THREE.Vector3(...polar(20, 10.5, 1.4)),
      radius: 1,
      mode: 'press',
      enabled: () => true,
      label: () => 'Read the noticeboard',
      press: () => game.panels.show(() => noticeboardPanel(game, 'Lift Plaza')),
    });

    const town = game.town;
    town.spawn(kit, 'mara', new THREE.Vector3(-2.6, 0, -9.6), Math.PI, interactables);
    town.spawn(kit, 'iona', keeperSpot(TOWN_SPOTS.survey), faceCenter(TOWN_SPOTS.survey), interactables);
    town.spawn(kit, 'oren', keeperSpot(TOWN_SPOTS.forge), faceCenter(TOWN_SPOTS.forge), interactables);
    town.spawn(kit, 'hollis', keeperSpot(TOWN_SPOTS.inn), faceCenter(TOWN_SPOTS.inn), interactables);
    town.spawn(kit, 'pell', keeperSpot(TOWN_SPOTS.kitchen), faceCenter(TOWN_SPOTS.kitchen), interactables);
    const bramSpot = polar(TOWN_SPOTS.market, 22.9);
    town.spawn(kit, 'bram', new THREE.Vector3(bramSpot[0], 0, bramSpot[2]), faceCenter(TOWN_SPOTS.market), interactables);

    const spawns = new Map<string, Spawn>([
      ['start', { pos: new THREE.Vector3(0, 0, 21), yaw: 0 }],
      ['lift', { pos: new THREE.Vector3(cage[0], 0, cage[2]), yaw: 0 }],
    ]);

    return {
      spawns,
      interactables,
      frame: (dt, time) => {
        forgeLight.intensity = 12 + Math.sin(time * 11) * 2 + Math.sin(time * 23) * 1.5;
        wheel.rotation.x += dt * 0.05;
      },
    };
  },
};
