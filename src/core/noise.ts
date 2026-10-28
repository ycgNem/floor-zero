import { createRng } from './rng';

export type Noise3 = (x: number, y: number, z: number) => number;

const GRADIENTS = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
] as const;

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Seeded 3D gradient (Perlin) noise, roughly in [-1, 1]. */
export function createNoise3(seed: number): Noise3 {
  const rng = createRng(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j] as number, perm[i] as number];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255] as number;
  const grad = (hash: number, x: number, y: number, z: number): number => {
    const g = GRADIENTS[hash % 12] as readonly [number, number, number];
    return g[0] * x + g[1] * y + g[2] * z;
  };
  return (x, y, z) => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);
    const X = fx & 255;
    const Y = fy & 255;
    const Z = fz & 255;
    x -= fx;
    y -= fy;
    z -= fz;
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = (p[X] as number) + Y;
    const AA = (p[A] as number) + Z;
    const AB = (p[A + 1] as number) + Z;
    const B = (p[X + 1] as number) + Y;
    const BA = (p[B] as number) + Z;
    const BB = (p[B + 1] as number) + Z;
    const h = (i: number): number => p[i] as number;
    return lerp(
      lerp(
        lerp(grad(h(AA), x, y, z), grad(h(BA), x - 1, y, z), u),
        lerp(grad(h(AB), x, y - 1, z), grad(h(BB), x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(grad(h(AA + 1), x, y, z - 1), grad(h(BA + 1), x - 1, y, z - 1), u),
        lerp(grad(h(AB + 1), x, y - 1, z - 1), grad(h(BB + 1), x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  };
}

/** Fractal sum of octaves, each at double the frequency and `gain` times the strength. */
export function fbm3(noise: Noise3, x: number, y: number, z: number, octaves: number, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y, z) * amp;
    norm += amp;
    amp *= gain;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
  }
  return sum / norm;
}
