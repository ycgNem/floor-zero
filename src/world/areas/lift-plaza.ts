import * as THREE from 'three';
import { createRng, randRange } from '../../core/rng';
import { noticeboard as noticeboardPanel } from '../../town/noticeboard';
import { worksBoard } from '../../town/works';
import type { Game } from '../../game';
import type { PanelSpec } from '../../ui/panels';
import { skyDome } from '../../render/sky';
import type { AreaDef, Interactable, Spawn } from '../area';
import { buildHome } from '../home';
import type { MaterialKey } from '../materials';
import { barrel, cart, crate, faceCenter, lanternPost, noticeboard, offset, pipe, polar, railing, wallLantern } from '../props';
import { headframe, liftCage, marketStall } from '../structures';
import { hangingLine, paving, plantedTree, ringWall, stackedTown, townhouse } from '../town-ring';

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
  home: 275,
  works: 300,
} as const;

/** Mara's lift: the Entry Yard, and once the Pump Station runs, the station five floors down. */
function liftPanel(game: Game): PanelSpec {
  const go = (area: 'entry-yard' | 'pump-station'): void => {
    game.panels.close();
    void game.travel(area, 'lift', 'lift');
  };
  return {
    name: 'The main lift',
    role: 'Mara',
    text: 'Cable runs all the way to the station now. First time in my life I’ve had to ask anyone which floor.',
    options: [
      { label: 'Floor 1: the Entry Yard', onClick: () => go('entry-yard') },
      { label: 'Floor 5: the Pump Station', onClick: () => go('pump-station') },
      { label: 'Not yet', onClick: () => game.panels.close() },
    ],
  };
}

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
  // The shaft breathes cold mist that never quite reaches the plaza.
  air: { scatter: 0.004, mist: { color: 0x16222e, density: 0.1, floor: -16, falloff: 0.22 } },
  grade: 'town',
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

    // The builders' ring, and the town crowded up it: lit windows on every terrace come evening.
    ringWall(kit);
    stackedTown(kit, rng, evening ? 0.72 : 0.12, [TOWN_SPOTS.home]);
    paving(kit, SHAFT_R + 0.7, WALL_R);

    // Town buildings at plaza level.
    const shop = (angle: number, width: number, floors: number, wall: MaterialKey, roof: 'gable' | 'gable-front', awning = false): void => {
      const at = polar(angle, FRONT_R);
      const yaw = faceCenter(angle);
      townhouse(kit, { at, yaw, width, depth: 6, floors, wall, roof, lit: evening ? 0.85 : 0.2, rng, collide: true, chimney: true, shutters: true });
      wallLantern(kit, offset(at, yaw, width / 2 - 0.6, 2.6, 0.12), yaw, 6);
      if (awning) {
        kit.box({ at: offset(at, yaw, 0, 2.75, 0.9), size: [width * 0.8, 0.06, 1.9], mat: 'canvas', rotY: yaw, rotX: 0.28, collide: false });
        for (const side of [-1, 1]) kit.box({ at: offset(at, yaw, side * width * 0.38, 1.25, 1.75), size: [0.1, 2.5, 0.1], mat: 'wood_dark', rotY: yaw });
      }
    };
    shop(TOWN_SPOTS.survey, 9, 2, 'stone_wall', 'gable');
    shop(TOWN_SPOTS.forge, 8, 2, 'brick', 'gable-front');
    shop(TOWN_SPOTS.inn, 12, 3, 'plaster', 'gable');
    shop(TOWN_SPOTS.kitchen, 8, 2, 'plaster', 'gable-front', true);

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

    // Town Works: what's been built shows up in the plaza.
    const kitchenYaw = faceCenter(TOWN_SPOTS.kitchen);
    const kitchenFront = polar(TOWN_SPOTS.kitchen, FRONT_R);
    let ovenLight: THREE.PointLight | null = null;
    if (game.hasFlag('kitchen_expanded')) {
      // Pell's second hearth: a brick bread oven under its own little roof.
      kit.box({ at: offset(kitchenFront, kitchenYaw, 5.1, 0.7, -0.6), size: [1.8, 1.4, 2], mat: 'brick', rotY: kitchenYaw, bevel: 0.05 });
      kit.box({ at: offset(kitchenFront, kitchenYaw, 5.1, 0.55, 0.42), size: [0.7, 0.5, 0.06], mat: 'lamp', rotY: kitchenYaw, collide: false, shadow: false });
      kit.box({ at: offset(kitchenFront, kitchenYaw, 5.4, 2.4, -1.1), size: [0.5, 2, 0.5], mat: 'brick', rotY: kitchenYaw, collide: false });
      kit.box({ at: offset(kitchenFront, kitchenYaw, 5.1, 1.6, -0.6), size: [2.2, 0.1, 2.4], mat: 'roof', rotY: kitchenYaw, rotX: 0.15, collide: false });
      ovenLight = kit.pointLight({ at: offset(kitchenFront, kitchenYaw, 5.1, 0.6, 1.2), color: 0xff8a3a, intensity: 6, distance: 6, bulb: false });
    }
    if (game.hasFlag('forge_bellows')) {
      // Oren's great bellows, worked by a counterweighted lever, and a taller stack.
      kit.box({ at: offset(forgeFront, forgeYaw, -3.4, 0.55, 1.2), size: [1.2, 0.5, 1.9], mat: 'wood_dark', rotY: forgeYaw, rotX: -0.12, bevel: 0.04 });
      kit.box({ at: offset(forgeFront, forgeYaw, -3.4, 0.95, 1.1), size: [1.0, 0.3, 1.6], mat: 'canvas', rotY: forgeYaw, rotX: -0.25, collide: false });
      kit.box({ at: offset(forgeFront, forgeYaw, -3.4, 1.9, 0.4), size: [0.12, 2.2, 0.12], mat: 'wood_dark', rotY: forgeYaw, collide: false });
      kit.box({ at: offset(forgeFront, forgeYaw, -3.4, 2.9, 1.0), size: [0.12, 0.12, 2.0], mat: 'wood_dark', rotY: forgeYaw, rotX: 0.2, collide: false });
      kit.box({ at: offset(forgeFront, forgeYaw, 2.4, 13, -4), size: [1.1, 3, 1.1], mat: 'brick', rotY: forgeYaw, collide: false });
    }
    if (game.hasFlag('hoist_built')) {
      // The freight hoist's derrick at the shaft lip, with its line running down to the yard.
      const foot = polar(326, 8.2);
      const tip = polar(330, 5.6, 4.6);
      for (const side of [-0.7, 0.7]) pipe(kit, offset(foot, faceCenter(326), side, 0, 0), tip, 0.09, 'wood_dark');
      pipe(kit, polar(326, 9.6), tip, 0.06, 'wood_dark');
      pipe(kit, tip, [tip[0], -12, tip[2]], 0.02, 'canvas');
      kit.box({ at: [tip[0], 4.4, tip[2]], size: [0.4, 0.4, 0.2], mat: 'metal', rotY: faceCenter(330), collide: false });
      kit.box({ at: [tip[0], 2.2, tip[2]], size: [0.7, 0.6, 0.7], mat: 'wood', rotY: faceCenter(330), collide: false, bevel: 0.02 });
    }

    // The old lamplighter's house, yours once you've saved up.
    const home = buildHome(game, kit, interactables, polar(TOWN_SPOTS.home, FRONT_R), faceCenter(TOWN_SPOTS.home));

    // The Town Works board, beside the market.
    noticeboard(kit, polar(TOWN_SPOTS.works, 12.5), faceCenter(TOWN_SPOTS.works));
    interactables.push({
      id: 'plaza-works',
      position: new THREE.Vector3(...polar(TOWN_SPOTS.works, 12.5, 1.4)),
      radius: 1,
      mode: 'press',
      enabled: () => true,
      label: () => 'Read the Town Works board',
      press: () => game.panels.show(() => worksBoard(game)),
    });
    for (const [angle, radius] of [[100, 23], [125, 23.5], [190, 23], [258, 23.5], [96, 22.3], [128, 24.4], [196, 24.2], [262, 22.6], [57, 23.8], [33, 24]] as const) {
      if (rng() > 0.5) crate(kit, polar(angle, radius), 0.8, rng() * 3);
      else barrel(kit, polar(angle, radius));
    }
    cart(kit, polar(150, 23.2), faceCenter(150) + 1.3, 'ore_copper');
    cart(kit, polar(18, 22.5), faceCenter(18) - 1.2);
    for (const a of [90, 160, 205, 262]) plantedTree(kit, polar(a, 17.5), rng);
    // Lamps strung from the shaft's posts out to the inn and the kitchen, where people gather.
    for (const [post, to] of [[145, 172], [215, 188], [215, 238], [250, 252]] as const) {
      hangingLine(kit, polar(post, 11.5, 2.85), polar(to, FRONT_R - 0.2, 4.6), 0.55, 9, 'bulb', rng);
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

    // The main lift and its headframe, with the winding house its cables run back to.
    const cage: [number, number, number] = [0, 0, -(SHAFT_R - 1.75)];
    liftCage(kit, cage, Math.PI, 14);
    const wheel = headframe(kit, cage, 0, 1.75);
    townhouse(kit, { at: [0, 0, -16.8], yaw: 0, width: 6.4, depth: 4.5, floors: 1, wall: 'stone_wall', roof: 'gable', lit: evening ? 1 : 0.4, rng, collide: true, chimney: true });
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
    // The shaft's cold glow. Only a touch of it lights the mist, or the shaft would be a pillar of light.
    kit.pointLight({ at: [0, -14, 0], color: 0x5fa8ff, intensity: 1600, distance: 45, bulb: false }).userData.air = 0.03;

    kit.add(skyDome(evening
      ? { zenith: new THREE.Color(0.0035, 0.006, 0.018), horizon: new THREE.Color(0.018, 0.022, 0.04), glow: new THREE.Color(0.05, 0.028, 0.012), glowDir: new THREE.Vector3(0, 0.1, 1) }
      : { zenith: new THREE.Color(0.12, 0.26, 0.62), horizon: new THREE.Color(0.55, 0.62, 0.72), glow: new THREE.Color(0.9, 0.6, 0.32), glowDir: sun.position }));
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
      label: () => (game.hasFlag('sluicekeeper_defeated') ? 'Ride the lift down' : 'Ride the lift down to the Entry Yard'),
      press: () => {
        if (game.hasFlag('sluicekeeper_defeated')) game.panels.show(() => liftPanel(game));
        else void game.travel('entry-yard', 'lift', 'lift');
      },
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
        forgeLight.intensity = (game.hasFlag('forge_bellows') ? 16 : 12) + Math.sin(time * 11) * 2 + Math.sin(time * 23) * 1.5;
        if (ovenLight) ovenLight.intensity = 5 + Math.sin(time * 7) * 0.8 + Math.sin(time * 17) * 0.6;
        home.frame(time);
        wheel.rotation.x += dt * 0.05;
      },
    };
  },
};
