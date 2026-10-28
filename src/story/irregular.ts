import * as THREE from 'three';
import { clamp, damp, wrapAngle } from '../core/math';
import { animateHollowhorn, buildHollowhorn, type HollowhornPose, type HollowhornRig } from '../combat/enemies/hollowhorn-model';
import type { Game } from '../game';
import type { Collider } from '../physics/physics';
import type { LevelKit } from '../world/level-kit';

// The Broken Galleries, as far as the chase cares. +z runs south, toward the collapse.
const TRIGGER_Z = 30.8;
const ROCKFALL = new THREE.Vector3(0, 1.6, 40.2);
const EMERGE_FROM = new THREE.Vector3(0, 0, 42.4);
const EMERGE_TO = new THREE.Vector3(0, 0, 37.2);
const MOUTH_Z = 3.5;
/** The tunnel floor ramps down from here, so the beast sinks out of sight as it leaves. */
const RAMP = { z0: 40.5, z1: 47, drop: 2.4 };
const FRAME_ZS = [7, 11.5, 16, 20.5, 25];
const SIDE_DOORS = [
  { side: -1, z: 12, minZ: 7, maxZ: 17 },
  { side: 1, z: 21, minZ: 15, maxZ: 27 },
];

const RUMBLE_TIME = 2.6;
const TURN_RATE = 2.4;
const HORN_REACH = 2.3;
const HIT_DAMAGE = 26;
const MAX_HITS = 3;
const CHASE_LIMIT = 22;
const DUST = 0x857b70;

type Phase = 'waiting' | 'rumble' | 'emerge' | 'chase' | 'halt' | 'leave' | 'gone';

interface Rock {
  mesh: THREE.Object3D;
  base: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  size: number;
  flying: boolean;
}

export interface IrregularEvent {
  update(dt: number): void;
  frame(dt: number, time: number): void;
  dispose(): void;
}

/** How far the beast may stray from the middle of the corridor at a given depth. */
function laneHalfWidth(z: number): number {
  if (z > 40.3) return 0.2;
  if (z > 29.8) return 4.6;
  if (z > 4.2) return 1.5;
  return 2.6;
}

function floorAt(z: number): number {
  return -clamp((z - RAMP.z0) / (RAMP.z1 - RAMP.z0), 0, 1) * RAMP.drop;
}

/**
 * The Irregular. The first time you reach the collapse in the Broken Galleries, the Hollowhorn,
 * something from far below that has no business on Floor 2, bursts through the rockfall and runs
 * you down the main gallery. You can't fight it. On its way back down it leaves the route open.
 */
export function irregularEvent(game: Game, kit: LevelKit, fall: THREE.Group, rockfall: Collider | null): IrregularEvent {
  if (game.hasFlag('irregular_seen')) return { update() {}, frame() {}, dispose() {} };

  let phase: Phase = 'waiting';
  let t = 0;
  let chaseTime = 0;
  let hits = 0;
  let recover = 0;
  let speed = 0;
  let sideTime = 0;
  let dustTimer = 0;
  let lastStep = 0;
  let bellowed = false;
  const pos = EMERGE_FROM.clone();
  let yaw = Math.PI;
  const pose: HollowhornPose = { speed: 0, rear: 0, roar: 0, charge: 0 };
  const dusted = new Set<number>();

  const materials: THREE.MeshStandardMaterial[] = [];
  const rig: HollowhornRig = buildHollowhorn((color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.8,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
    });
    materials.push(m);
    return m;
  });
  rig.body.visible = false;
  rig.root.position.copy(pos);
  rig.root.rotation.y = yaw;
  rig.root.userData.dynamic = true;
  kit.add(rig.root);

  // Light leaking through the cracks while it pushes. Always in the scene so shaders never recompile mid-chase.
  const glow = new THREE.PointLight(0xff5a24, 0, 10, 2);
  glow.position.set(0, 1.8, 41.8);
  kit.add(glow);

  const lights: { light: THREE.PointLight; base: number }[] = [];
  kit.root.traverse((o) => {
    if (o instanceof THREE.PointLight && o !== glow && o !== rig.light) lights.push({ light: o, base: o.intensity });
  });

  const rocks: Rock[] = fall.children.map((mesh) => ({
    mesh,
    base: mesh.position.clone(),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    size: (mesh.userData.size as number | undefined) ?? 0.8,
    flying: false,
  }));

  const player = game.player;
  const setPhase = (next: Phase): void => {
    phase = next;
    t = 0;
  };

  const fallingDust = (at: THREE.Vector3, count: number): void => {
    game.effects.burst(at, { count, color: DUST, speed: 0.5, size: 0.035, life: 1.8, gravity: 3.5, spread: 1 });
  };

  const begin = (): void => {
    setPhase('rumble');
    game.combat.cowed = true;
    game.hud.subtitle('[A deep grinding, somewhere behind the rockfall]', RUMBLE_TIME);
  };

  const smash = (): void => {
    setPhase('emerge');
    game.events.emit('sound', { name: 'roar', position: EMERGE_FROM.clone() });
    game.setFlag('irregular_seen');
    game.setFlag('galleries_route_open');
    if (rockfall) kit.removeCollider(rockfall);
    for (const rock of rocks) {
      rock.flying = true;
      rock.mesh.position.copy(rock.base);
      rock.vel.set((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, -1.5 - Math.random() * 3);
      rock.spin.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
    }
    rig.body.visible = true;
    glow.intensity = 0;
    game.loop.freeze(0.09);
    player.addShake(1);
    game.effects.burst(ROCKFALL, { count: 70, color: DUST, speed: 7, size: 0.09, life: 1.4, spread: 0.9 });
    game.effects.burst(ROCKFALL, { count: 24, color: 0xff7a3a, speed: 5, size: 0.04, life: 0.6, emissive: true });
    game.events.emit('slam', { position: ROCKFALL.clone() });
    game.hud.announce('Irregular', 'Run');
    game.hud.subtitle('[A bellow that shakes the whole gallery]', 2.4);
    game.objectiveOverride = 'Run! Get back to the gallery mouth';
  };

  const gore = (): void => {
    if (player.invulnerable > 0) return;
    const knock = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(11).setY(5);
    game.combat.damagePlayer(HIT_DAMAGE, pos.clone().setY(1.2), knock);
    hits++;
    recover = 1.1;
    game.loop.freeze(0.07);
    player.addShake(0.6);
    game.effects.burst(player.chestPosition(), { count: 14, color: 0xd8c8a8, speed: 4, size: 0.05, life: 0.5 });
  };

  /** Steps the beast toward a point along the corridor, turning like something that weighs ten tonnes. */
  const drive = (target: THREE.Vector3, want: number, dt: number): number => {
    const desired = Math.atan2(target.x - pos.x, target.z - pos.z);
    const delta = wrapAngle(desired - yaw);
    yaw = wrapAngle(yaw + clamp(delta, -TURN_RATE * dt, TURN_RATE * dt));
    speed = damp(speed, want * clamp(Math.cos(delta), 0.2, 1), 3, dt);
    pos.x += Math.sin(yaw) * speed * dt;
    pos.z += Math.cos(yaw) * speed * dt;
    const half = laneHalfWidth(pos.z);
    pos.x = damp(pos.x, clamp(pos.x, -half, half), 12, dt);
    pos.z = clamp(pos.z, -2.5, RAMP.z1 - 0.5);
    pos.y = floorAt(pos.z);
    pose.speed = speed;
    trample();
    return delta;
  };

  /** Anything small in its way is simply run over. */
  const trample = (): void => {
    const chestX = pos.x + Math.sin(yaw) * 1.6;
    const chestZ = pos.z + Math.cos(yaw) * 1.6;
    for (const enemy of game.combat.enemies) {
      if (!enemy.alive) continue;
      const reach = enemy.radius + 1.2;
      const near = Math.hypot(enemy.position.x - pos.x, enemy.position.z - pos.z) < reach || Math.hypot(enemy.position.x - chestX, enemy.position.z - chestZ) < reach;
      if (!near) continue;
      game.combat.crush(enemy);
      player.addShake(0.2 * clamp(1 - pos.distanceTo(player.position) / 20, 0, 1));
    }
  };

  /** A side room the player has ducked into, if any. */
  const hidingIn = (): (typeof SIDE_DOORS)[number] | undefined => {
    const p = player.position;
    const side = p.x < -4 ? -1 : p.x > 4 ? 1 : 0;
    return SIDE_DOORS.find((d) => d.side === side && p.z > d.minZ && p.z < d.maxZ);
  };

  const chase = (dt: number): void => {
    chaseTime += dt;
    recover = Math.max(0, recover - dt);
    pose.rear = damp(pose.rear, 0, 8, dt);
    pose.roar = damp(pose.roar, 0, 6, dt);
    pose.charge = damp(pose.charge, 1, 4, dt);

    const door = hidingIn();
    sideTime = door ? sideTime + dt : 0;
    const target = door ? new THREE.Vector3(door.side * 1.2, 0, door.z) : player.position;
    // Rubber-banded: it closes a big gap fast, then hangs just behind a sprint.
    const gap = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
    const want = recover > 0 ? 1.5 : gap > 10 ? 9.5 : gap < 4.5 ? 6 : 8.2;
    drive(target, want, dt);

    const horn = new THREE.Vector3(pos.x + Math.sin(yaw) * HORN_REACH, pos.y + 1.2, pos.z + Math.cos(yaw) * HORN_REACH);
    if (recover <= 0 && horn.distanceTo(player.chestPosition()) < 1.6) gore();

    const cornered = door !== undefined && sideTime > 0.5 && Math.abs(pos.z - door.z) < 3;
    if (player.position.z < MOUTH_Z || pos.z < 6.5 || hits >= MAX_HITS || chaseTime > CHASE_LIMIT || cornered) {
      setPhase('halt');
      game.objectiveOverride = null;
    }
  };

  const halt = (dt: number): void => {
    if (t < 1.9) {
      drive(pos.clone().add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))), 0, dt);
      const roaring = t > 0.5;
      pose.rear = damp(pose.rear, roaring ? 1 : 0, 6, dt);
      pose.roar = damp(pose.roar, roaring ? 1 : 0, 8, dt);
      pose.charge = damp(pose.charge, 0, 4, dt);
      if (roaring) player.addShake(0.015);
      if (roaring && !bellowed) {
        bellowed = true;
        game.hud.subtitle('[It bellows after you, then turns back toward the collapse]', 3);
      }
    } else {
      pose.rear = damp(pose.rear, 0, 6, dt);
      pose.roar = damp(pose.roar, 0, 6, dt);
      const delta = drive(new THREE.Vector3(0, 0, RAMP.z1), 2, dt);
      if (t > 2.6 && Math.abs(delta) < 0.4) setPhase('leave');
    }
  };

  const leave = (dt: number): void => {
    pose.charge = damp(pose.charge, 0.3, 3, dt);
    drive(new THREE.Vector3(0, 0, RAMP.z1), 7.2, dt);
    if (pos.z > RAMP.z1 - 0.8) finish();
  };

  const finish = (): void => {
    setPhase('gone');
    rig.body.visible = false;
    rig.light.intensity = 0;
    game.combat.cowed = false;
    for (const { light, base } of lights) light.intensity = base;
    game.hud.toast('It went down the far tunnel. The way past the collapse is open.', 'info', 4.5);
    game.save();
  };

  const updateRocks = (dt: number): void => {
    for (const rock of rocks) {
      if (!rock.flying) continue;
      const m = rock.mesh;
      rock.vel.y -= 20 * dt;
      m.position.addScaledVector(rock.vel, dt);
      m.rotation.x += rock.spin.x * dt;
      m.rotation.y += rock.spin.y * dt;
      m.rotation.z += rock.spin.z * dt;
      if (Math.abs(m.position.x) > 6.4) rock.vel.x = -Math.sign(m.position.x) * Math.abs(rock.vel.x) * 0.5;
      if (m.position.z < 30.6) rock.vel.z = Math.abs(rock.vel.z) * 0.5;
      const rest = rock.size * 0.55;
      if (m.position.y < rest) {
        m.position.y = rest;
        if (Math.abs(rock.vel.y) > 2.5) {
          rock.vel.y = -rock.vel.y * 0.3;
          rock.vel.x *= 0.6;
          rock.vel.z *= 0.6;
          rock.spin.multiplyScalar(0.5);
        } else rock.flying = false;
      }
    }
  };

  return {
    update(dt) {
      if (phase === 'gone') return;
      t += dt;
      switch (phase) {
        case 'waiting':
          if (player.position.z > TRIGGER_Z && Math.abs(player.position.x) < 7 && !game.panelOpen) begin();
          break;
        case 'rumble': {
          const k = t / RUMBLE_TIME;
          player.addShake(0.008 + 0.03 * k);
          glow.intensity = (2 + 5 * k) * (0.65 + 0.35 * Math.random());
          dustTimer -= dt;
          if (dustTimer <= 0) {
            dustTimer = 0.12;
            const a = Math.random() * Math.PI * 2;
            const r = 1 + Math.random() * 5;
            fallingDust(new THREE.Vector3(player.position.x + Math.cos(a) * r, 6.6, player.position.z + Math.sin(a) * r), 5);
            game.effects.burst(ROCKFALL.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, -0.6)), { count: 3, color: DUST, speed: 1.5, size: 0.06, life: 0.6 });
          }
          if (t > RUMBLE_TIME) smash();
          break;
        }
        case 'emerge':
          if (t < 0.7) {
            pos.lerpVectors(EMERGE_FROM, EMERGE_TO, 1 - (1 - t / 0.7) ** 2);
            pos.y = floorAt(pos.z);
            pose.speed = 6;
            pose.charge = 0.6;
          } else {
            pose.speed = damp(pose.speed, 0, 8, dt);
            pose.rear = damp(pose.rear, 1, 6, dt);
            pose.roar = damp(pose.roar, 1, 8, dt);
            player.addShake(0.02);
          }
          if (t > 2.0) {
            setPhase('chase');
            speed = 2;
          }
          break;
        case 'chase':
          chase(dt);
          break;
        case 'halt':
          halt(dt);
          break;
        case 'leave':
          leave(dt);
          break;
      }
      updateRocks(dt);
    },

    frame(dt, time) {
      if (phase === 'gone' || phase === 'waiting' || game.mode !== 'playing') return;
      if (phase === 'rumble') {
        const k = t / RUMBLE_TIME;
        for (const rock of rocks) {
          rock.mesh.position.set(
            rock.base.x + (Math.random() - 0.5) * 0.06 * k,
            rock.base.y + (Math.random() - 0.5) * 0.04 * k,
            rock.base.z + (Math.random() - 0.5) * 0.06 * k,
          );
        }
      }

      rig.root.position.copy(pos);
      rig.root.rotation.y = yaw;
      animateHollowhorn(rig, pose, dt, time);
      rig.light.intensity = rig.body.visible ? 7 + Math.sin(time * 2.6) * 2 + pose.roar * 6 : 0;

      // Every hoof-fall shakes the camera, harder the closer it is.
      const step = Math.floor(rig.phase / Math.PI);
      if (step !== lastStep) {
        lastStep = step;
        if (pose.speed > 1.5) {
          const d = pos.distanceTo(player.position);
          player.addShake(0.13 * clamp(1 - d / 22, 0, 1));
          const side = step % 2 === 0 ? 1 : -1;
          game.effects.burst(new THREE.Vector3(pos.x + Math.cos(yaw) * side * 0.7, pos.y + 0.05, pos.z - Math.sin(yaw) * side * 0.7), { count: 5, color: DUST, speed: 1.6, size: 0.06, life: 0.7 });
        }
      }

      // Dust shaken off the timber sets as it thunders underneath.
      for (const z of FRAME_ZS) {
        const near = Math.abs(pos.z - z);
        if (near < 0.6 && !dusted.has(z) && pose.speed > 2) {
          dusted.add(z);
          for (const x of [-2.2, 0, 2.2]) fallingDust(new THREE.Vector3(x, 5.6, z), 8);
        } else if (near > 3) dusted.delete(z);
      }

      // Lanterns shudder while it pushes, and stutter as it passes.
      for (let i = 0; i < lights.length; i++) {
        const entry = lights[i] as (typeof lights)[number];
        const flutter = 0.5 + 0.5 * Math.sin(time * 37 + i * 11) * Math.sin(time * 23 + i * 3);
        let strength = 0;
        if (phase === 'rumble') strength = 0.5 * (t / RUMBLE_TIME);
        else if (phase === 'emerge' && t < 0.25) strength = 0.85;
        else strength = 0.45 * clamp(1 - entry.light.position.distanceTo(pos) / 7, 0, 1);
        entry.light.intensity = entry.base * (1 - strength * flutter);
      }
    },

    dispose() {
      game.combat.cowed = false;
      for (const m of materials) m.dispose();
    },
  };
}
