import * as THREE from 'three';

/** Linear HDR colours for the four parts of an environment room. */
export interface EnvironmentLook {
  /** The room itself: walls, dark. */
  ambient: THREE.Color;
  /** A warm lamp, up and to the left. */
  lamp: THREE.Color;
  /** Cold light from the depths, ahead and to the right. */
  depths: THREE.Color;
  /** Bounce off the floor. */
  floor: THREE.Color;
}

const cache = new Map<string, THREE.Texture>();

/**
 * A small dark room with a lamp in it, prefiltered into an environment map. It gives metal
 * something to reflect (with nothing to reflect, polished metal renders nearly black) and adds a
 * faint fill. Built once per look and cached.
 */
export function environment(gl: THREE.WebGLRenderer, look: EnvironmentLook): THREE.Texture {
  const id = [look.ambient, look.lamp, look.depths, look.floor].map((c) => c.toArray().map((v) => v.toFixed(3)).join(',')).join('|');
  const cached = cache.get(id);
  if (cached) return cached;
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const add = (geometry: THREE.BufferGeometry, color: THREE.Color, side: THREE.Side, at?: THREE.Vector3Tuple): void => {
    const material = new THREE.MeshBasicMaterial({ color, side });
    const mesh = new THREE.Mesh(geometry, material);
    if (at) {
      mesh.position.set(...at);
      mesh.lookAt(0, 0, 0);
    }
    scene.add(mesh);
    disposables.push(geometry, material);
  };
  add(new THREE.BoxGeometry(12, 12, 12), look.ambient, THREE.BackSide);
  add(new THREE.PlaneGeometry(2.6, 1.6), look.lamp, THREE.DoubleSide, [-2.2, 3.6, 1.8]);
  add(new THREE.PlaneGeometry(7, 2.2), look.depths, THREE.DoubleSide, [3.2, 0.6, -4.5]);
  add(new THREE.PlaneGeometry(9, 1.2), look.floor, THREE.DoubleSide, [0, -5, 0]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const texture = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  for (const d of disposables) d.dispose();
  cache.set(id, texture);
  return texture;
}

/** An area's environment, from its fog: the room takes the fog's colour, the lamp stays warm. */
export function areaEnvironment(gl: THREE.WebGLRenderer, fog: number): THREE.Texture {
  const air = new THREE.Color(fog);
  return environment(gl, {
    ambient: air.clone().multiplyScalar(0.8),
    lamp: new THREE.Color(3.2, 1.9, 0.85),
    depths: air.clone().multiplyScalar(6).add(new THREE.Color(0.02, 0.04, 0.07)),
    floor: new THREE.Color(0.06, 0.045, 0.035),
  });
}
