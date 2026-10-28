/**
 * Generates the tiling PBR texture sets for the level kit's materials: albedo, normal, and ORM
 * (occlusion, roughness, metalness), written to public/assets/textures/<name>_<map>.jpg.
 *
 * Everything is procedural and periodic, so every map tiles. For the organic materials, a source
 * image at assets-src/textures/<name>.png (a ComfyUI render, say) replaces the procedural surface;
 * it's made seamless here.
 *
 * Usage, from the project root: node tools/textures.ts [name ...]
 * Needs ImageMagick's `magick` on PATH. Not covered by `npm run typecheck` (no Node types installed).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SIZE = 1024;
const MASK = SIZE - 1;
const N = SIZE * SIZE;
const OUT_DIR = 'public/assets/textures';
const SRC_DIR = 'assets-src/textures';

type Channel = Float32Array;
type Color = readonly [number, number, number];

interface Surface {
  r: Channel;
  g: Channel;
  b: Channel;
  height: Channel;
  rough: Channel;
  metal: Channel;
  /** Slope multiplier when height becomes normals. */
  bump: number;
}

function surface(bump: number): Surface {
  return {
    r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N),
    height: new Float32Array(N), rough: new Float32Array(N), metal: new Float32Array(N), bump,
  };
}

const hex = (c: number): Color => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function paint(s: Surface, i: number, c: Color, k = 1): void {
  s.r[i] = c[0] * k;
  s.g[i] = c[1] * k;
  s.b[i] = c[2] * k;
}

function mix(s: Surface, i: number, c: Color, t: number): void {
  s.r[i] = lerp(s.r[i], c[0], t);
  s.g[i] = lerp(s.g[i], c[1], t);
  s.b[i] = lerp(s.b[i], c[2], t);
}

function shade(s: Surface, i: number, k: number): void {
  s.r[i] *= k;
  s.g[i] *= k;
  s.b[i] *= k;
}

const pick = (palette: Color[], t: number): Color => palette[Math.min(palette.length - 1, Math.floor(t * palette.length))];

// ---------------------------------------------------------------- randomness and noise

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 0..1 value per (id, salt), for per-block variation. */
function hash(id: number, salt = 0): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** Periodic gradient noise with `cx` by `cy` lattice cells across the tile, roughly -1..1. */
function gradient(cx: number, cy: number, seed: number): Channel {
  const r = rng(seed);
  const gx = new Float32Array(cx * cy);
  const gy = new Float32Array(cx * cy);
  for (let i = 0; i < cx * cy; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const out = new Float32Array(N);
  for (let y = 0; y < SIZE; y++) {
    const fy = (y / SIZE) * cy;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = fade(ty);
    const r0 = y0 * cx;
    const r1 = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < SIZE; x++) {
      const fx = (x / SIZE) * cx;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const x1 = (x0 + 1) % cx;
      const sx = fade(tx);
      const n00 = gx[r0 + x0] * tx + gy[r0 + x0] * ty;
      const n10 = gx[r0 + x1] * (tx - 1) + gy[r0 + x1] * ty;
      const n01 = gx[r1 + x0] * tx + gy[r1 + x0] * (ty - 1);
      const n11 = gx[r1 + x1] * (tx - 1) + gy[r1 + x1] * (ty - 1);
      const top = n00 + (n10 - n00) * sx;
      const bottom = n01 + (n11 - n01) * sx;
      out[y * SIZE + x] = (top + (bottom - top) * sy) * 1.41;
    }
  }
  return out;
}

/**
 * Periodic fractal noise around 0.5. `stretch` above 1 elongates features vertically (streaks),
 * below 1 horizontally.
 */
function fbm(cells: number, octaves: number, seed: number, gain = 0.5, stretch = 1): Channel {
  const out = new Float32Array(N);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const c = Math.min(SIZE, cells << o);
    const n = gradient(c, Math.max(1, Math.min(SIZE, Math.round(c / stretch))), seed * 7919 + o * 104729);
    for (let i = 0; i < N; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < N; i++) out[i] = (out[i] / total) * 0.5 + 0.5;
  return out;
}

interface Cells {
  f1: Channel;
  f2: Channel;
  id: Int32Array;
  /** Offset from the pixel to its cell's point. */
  ox: Channel;
  oy: Channel;
}

/** Periodic Voronoi over a jittered `grid` by `grid` lattice; distances in pixels. */
function voronoi(grid: number, seed: number, jitter = 0.8): Cells {
  const r = rng(seed);
  const cell = SIZE / grid;
  const px = new Float32Array(grid * grid);
  const py = new Float32Array(grid * grid);
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      px[j * grid + i] = (i + 0.5 + (r() - 0.5) * jitter) * cell;
      py[j * grid + i] = (j + 0.5 + (r() - 0.5) * jitter) * cell;
    }
  }
  const out: Cells = { f1: new Float32Array(N), f2: new Float32Array(N), id: new Int32Array(N), ox: new Float32Array(N), oy: new Float32Array(N) };
  const half = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    const cy = Math.floor(y / cell);
    for (let x = 0; x < SIZE; x++) {
      const cx = Math.floor(x / cell);
      let d1 = Infinity;
      let d2 = Infinity;
      let best = 0;
      let bx = 0;
      let by = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const row = ((cy + dj + grid) % grid) * grid;
        for (let di = -1; di <= 1; di++) {
          const k = row + ((cx + di + grid) % grid);
          let dx = px[k] - x;
          if (dx > half) dx -= SIZE;
          else if (dx < -half) dx += SIZE;
          let dy = py[k] - y;
          if (dy > half) dy -= SIZE;
          else if (dy < -half) dy += SIZE;
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
            bx = dx;
            by = dy;
          } else if (d < d2) d2 = d;
        }
      }
      const i = y * SIZE + x;
      out.f1[i] = Math.sqrt(d1);
      out.f2[i] = Math.sqrt(d2);
      out.id[i] = best;
      out.ox[i] = bx;
      out.oy[i] = by;
    }
  }
  return out;
}

/** Bilinear lookup with wrapping. */
function sample(m: Channel, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const xa = x0 & MASK;
  const xb = (x0 + 1) & MASK;
  const ya = (y0 & MASK) * SIZE;
  const yb = ((y0 + 1) & MASK) * SIZE;
  return lerp(lerp(m[ya + xa], m[ya + xb], tx), lerp(m[yb + xa], m[yb + xb], tx), ty);
}

function warp(m: Channel, wx: Channel, wy: Channel, amount: number): Channel {
  const out = new Float32Array(N);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      out[i] = sample(m, x + (wx[i] - 0.5) * amount, y + (wy[i] - 0.5) * amount);
    }
  }
  return out;
}

/** Periodic box blur, run twice for a softer kernel. */
function blur(m: Channel, radius: number): Channel {
  let src = m;
  const w = 2 * radius + 1;
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(N);
    const out = new Float32Array(N);
    for (let y = 0; y < SIZE; y++) {
      const row = y * SIZE;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[row + (k & MASK)];
      for (let x = 0; x < SIZE; x++) {
        tmp[row + x] = sum / w;
        sum += src[row + ((x + radius + 1) & MASK)] - src[row + ((x - radius) & MASK)];
      }
    }
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[(k & MASK) * SIZE + x];
      for (let y = 0; y < SIZE; y++) {
        out[y * SIZE + x] = sum / w;
        sum += tmp[((y + radius + 1) & MASK) * SIZE + x] - tmp[((y - radius) & MASK) * SIZE + x];
      }
    }
    src = out;
  }
  return src;
}

function normalize(m: Channel): void {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < N; i++) {
    lo = Math.min(lo, m[i]);
    hi = Math.max(hi, m[i]);
  }
  const span = hi - lo || 1;
  for (let i = 0; i < N; i++) m[i] = (m[i] - lo) / span;
}

/** Thin jagged lines: warped Voronoi borders, shown where a mask noise allows. */
function crackMask(seed: number, grid: number, amount: number): Channel {
  const cells = voronoi(grid, seed);
  const border = new Float32Array(N);
  for (let i = 0; i < N; i++) border[i] = cells.f2[i] - cells.f1[i];
  const warped = warp(border, fbm(8, 4, seed + 1), fbm(8, 4, seed + 2), 70);
  const presence = fbm(4, 3, seed + 3);
  const lo = 0.68 - amount * 0.4;
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = (1 - smoothstep(0.4, 2.6, warped[i])) * smoothstep(lo, lo + 0.1, presence[i]);
  return out;
}

/** Short straight scratches in random directions. */
function scratchMap(seed: number, count: number): Channel {
  const r = rng(seed);
  const out = new Float32Array(N);
  for (let n = 0; n < count; n++) {
    let x = r() * SIZE;
    let y = r() * SIZE;
    const a = r() * Math.PI * 2;
    const len = 15 + r() * 110;
    const strength = 0.3 + r() * 0.7;
    for (let t = 0; t < len; t++) {
      const i = ((y | 0) & MASK) * SIZE + ((x | 0) & MASK);
      out[i] = Math.max(out[i], strength * (1 - (t / len) * 0.5));
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  return out;
}

// ---------------------------------------------------------------- block layouts

interface Layout {
  id: Int32Array;
  /** Distance in pixels to the block's nearest edge. */
  edge: Channel;
  u: Channel;
  v: Channel;
  w: Channel;
  h: Channel;
}

/** Rows of blocks: relative row heights, and each row's cut positions in pixels (wrapping). */
function rowsLayout(heights: number[], cuts: number[][]): Layout {
  const total = heights.reduce((a, b) => a + b, 0);
  const lay: Layout = {
    id: new Int32Array(N), edge: new Float32Array(N), u: new Float32Array(N),
    v: new Float32Array(N), w: new Float32Array(N), h: new Float32Array(N),
  };
  let top = 0;
  heights.forEach((rowHeight, row) => {
    const y0 = Math.round((top / total) * SIZE);
    top += rowHeight;
    const y1 = Math.round((top / total) * SIZE);
    const c = cuts[row].map((x) => ((x % SIZE) + SIZE) % SIZE).sort((a, b) => a - b);
    for (let y = y0; y < y1; y++) {
      const dy = Math.min(y - y0 + 0.5, y1 - y - 0.5);
      for (let x = 0; x < SIZE; x++) {
        let k = c.length - 1;
        let xs = x;
        if (x < c[0]) xs = x + SIZE;
        else for (let j = 0; j < c.length; j++) if (c[j] <= x) k = j;
        const start = c[k];
        const end = k + 1 < c.length ? c[k + 1] : c[0] + SIZE;
        const i = y * SIZE + x;
        lay.id[i] = row * 64 + k;
        lay.edge[i] = Math.min(xs - start + 0.5, end - xs - 0.5, dy);
        lay.u[i] = xs - start;
        lay.v[i] = y - y0;
        lay.w[i] = end - start;
        lay.h[i] = y1 - y0;
      }
    }
  });
  return lay;
}

/** Evenly spaced cuts per row, every other row shifted by half a block (running bond). */
function bond(rows: number, perRow: number, jitter: number, seed: number): number[][] {
  const w = SIZE / perRow;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: perRow }, (_, k) => k * w + (r % 2) * w * 0.5 + (hash(r * 64 + k, seed) - 0.5) * jitter));
}

/** Random-width blocks per row, for rubble and flagstones. */
function randomCuts(heights: number[], minWidth: number, extraWidth: number, r: () => number): number[][] {
  const total = heights.reduce((a, b) => a + b, 0);
  return heights.map((h) => {
    const rowPx = (h / total) * SIZE;
    const start = r() * SIZE;
    const list: number[] = [];
    for (let x = start; x < start + SIZE - rowPx * minWidth; x += rowPx * (minWidth + r() * extraWidth)) list.push(x);
    return list;
  });
}

/** Index into a detail map at a block's own offset, so neighbouring blocks don't share a surface. */
function blockSample(lay: Layout, i: number): number {
  const id = lay.id[i];
  const u = (lay.u[i] + Math.floor(hash(id, 1) * SIZE)) & MASK;
  const v = (lay.v[i] + Math.floor(hash(id, 2) * SIZE)) & MASK;
  return v * SIZE + u;
}

// ---------------------------------------------------------------- materials

function brick(): Surface {
  const s = surface(6);
  const lay = rowsLayout(Array(14).fill(1), bond(14, 5, 10, 5));
  const grain = fbm(48, 5, 11);
  const blotch = fbm(4, 5, 12);
  const chip = fbm(40, 3, 13);
  const soot = fbm(5, 4, 14, 0.5, 6);
  const mortarNoise = fbm(96, 3, 15);
  const palette = [0x8e4a35, 0x9c5a3f, 0x7a3e2e, 0xa4663f, 0x6b3a2c, 0x8a5240, 0x5e3427].map(hex);
  const mortar = hex(0x9d9282);
  for (let i = 0; i < N; i++) {
    const id = lay.id[i];
    const e = lay.edge[i] - 4.5 - (chip[i] - 0.5) * 8;
    const inside = smoothstep(0, 2, e);
    const bevel = smoothstep(0, 10, e);
    const gr = grain[blockSample(lay, i)];
    paint(s, i, mortar, 0.85 + (mortarNoise[i] - 0.5) * 0.5);
    const tone = 0.82 + hash(id, 6) * 0.3 + (gr - 0.5) * 0.5;
    const c = pick(palette, hash(id, 4));
    mix(s, i, [c[0] * tone, c[1] * tone, c[2] * tone], inside);
    shade(s, i, 1 - 0.28 * smoothstep(0.5, 0.8, blotch[i]) - 0.22 * smoothstep(0.55, 0.8, soot[i]));
    s.height[i] = inside * (0.5 + 0.4 * bevel + (gr - 0.5) * 0.25) + (1 - inside) * (0.08 + mortarNoise[i] * 0.12);
    s.rough[i] = lerp(0.96, 0.8 + (gr - 0.5) * 0.2, inside);
  }
  return s;
}

/** Dressed stone blocks in courses. `cracks` 0..1 adds broken lines (the breakable wall). */
function ashlar(seed: number, cracks: number): Surface {
  const s = surface(cracks > 0 ? 9 : 7);
  const r = rng(seed);
  const heights = Array.from({ length: 5 }, () => 0.75 + r() * 0.5);
  const lay = rowsLayout(heights, randomCuts(heights, 1.1, 1.2, r));
  const grain = fbm(16, 6, seed + 1);
  const chisel = fbm(64, 2, seed + 2, 0.5, 0.25);
  const chip = fbm(24, 4, seed + 3);
  const blotch = fbm(3, 5, seed + 4);
  const streak = fbm(4, 4, seed + 5, 0.5, 5);
  const crack = cracks > 0 ? crackMask(seed + 6, 7, cracks) : null;
  const palette = [0x8a847b, 0x7b766e, 0x948d82, 0x6f6a63, 0x857f77, 0x9a9184].map(hex);
  const joint = hex(0x4a4640);
  for (let i = 0; i < N; i++) {
    const id = lay.id[i];
    const e = lay.edge[i] - 5 - (chip[i] - 0.5) * 14;
    const inside = smoothstep(0, 2.5, e);
    const pillow = smoothstep(0, 26, e);
    const k = blockSample(lay, i);
    const gr = grain[k];
    const ch = chisel[k];
    paint(s, i, pick(palette, hash(id, 4)), 0.85 + hash(id, 6) * 0.25 + (gr - 0.5) * 0.45 + (ch - 0.5) * 0.12);
    mix(s, i, joint, 1 - inside);
    shade(s, i, 1 - 0.3 * smoothstep(0.5, 0.8, blotch[i]) - 0.18 * smoothstep(0.55, 0.85, streak[i]));
    let h = inside * (0.45 + 0.35 * pillow + (gr - 0.5) * 0.35 + (ch - 0.5) * 0.08) + (1 - inside) * 0.05;
    let rough = lerp(0.95, 0.86 + (gr - 0.5) * 0.15, inside);
    if (crack) {
      h -= crack[i] * 0.35;
      shade(s, i, 1 - crack[i] * 0.65);
      rough = lerp(rough, 1, crack[i]);
    }
    s.height[i] = h;
    s.rough[i] = rough;
  }
  return s;
}

function flagstones(): Surface {
  const seed = 31;
  const s = surface(5);
  const r = rng(seed);
  const heights = Array.from({ length: 4 }, () => 0.8 + r() * 0.4);
  const lay = rowsLayout(heights, randomCuts(heights, 1.2, 1.4, r));
  const grain = fbm(12, 6, seed + 1);
  const fine = fbm(128, 3, seed + 2);
  const scuff = fbm(20, 4, seed + 3, 0.5, 0.5);
  const blotch = fbm(3, 5, seed + 4);
  const chip = fbm(32, 3, seed + 5);
  const crack = crackMask(seed + 6, 5, 0.45);
  const palette = [0xa39c90, 0x9a9387, 0xada597, 0x8f897e, 0xb0a898].map(hex);
  const joint = hex(0x3d3933);
  for (let i = 0; i < N; i++) {
    const id = lay.id[i];
    const e = lay.edge[i] - 3.5 - (chip[i] - 0.5) * 6;
    const inside = smoothstep(0, 1.5, e);
    const bevel = smoothstep(0, 7, e);
    const k = blockSample(lay, i);
    const gr = grain[k];
    const worn = smoothstep(0.55, 0.75, scuff[i]);
    const cracked = hash(id, 9) > 0.55 ? crack[i] : 0;
    paint(s, i, pick(palette, hash(id, 4)), 0.86 + hash(id, 6) * 0.2 + (gr - 0.5) * 0.35 + (fine[i] - 0.5) * 0.08 + worn * 0.08);
    mix(s, i, joint, 1 - inside);
    shade(s, i, (1 - 0.25 * smoothstep(0.5, 0.8, blotch[i])) * (1 - cracked * 0.6));
    s.height[i] = inside * (0.55 + 0.2 * bevel + (gr - 0.5) * 0.12 + (fine[i] - 0.5) * 0.05 + (hash(id, 7) - 0.5) * 0.1) - cracked * 0.25;
    s.rough[i] = lerp(0.95, 0.8 + (gr - 0.5) * 0.2 - worn * 0.18, inside);
  }
  return s;
}

function cobble(): Surface {
  const s = surface(8);
  const cells = voronoi(14, 41, 0.75);
  const grain = fbm(32, 5, 42);
  const fine = fbm(160, 2, 43);
  const blotch = fbm(4, 4, 44);
  const gapNoise = fbm(64, 3, 45);
  const palette = [0x7d7a75, 0x6e6b66, 0x8a857c, 0x6a6560, 0x7f776c, 0x5f5c58].map(hex);
  const gap = hex(0x3a3129);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const id = cells.id[i];
      const k = ((y + Math.floor(hash(id, 2) * SIZE)) & MASK) * SIZE + ((x + Math.floor(hash(id, 1) * SIZE)) & MASK);
      const d = Math.min((cells.f2[i] - cells.f1[i]) * 0.5, (SIZE / 14) * 0.64 - cells.f1[i]) - 2.5 - (grain[i] - 0.5) * 5;
      const inside = smoothstep(0, 1.5, d);
      const dome = Math.sqrt(smoothstep(0, 20, d));
      paint(s, i, gap, 0.8 + gapNoise[i] * 0.4);
      const tone = 0.85 + hash(id, 6) * 0.3 + (grain[k] - 0.5) * 0.35 + (fine[i] - 0.5) * 0.08;
      const c = pick(palette, hash(id, 4));
      mix(s, i, [c[0] * tone, c[1] * tone, c[2] * tone], inside);
      shade(s, i, 1 - 0.25 * smoothstep(0.5, 0.8, blotch[i]));
      s.height[i] = inside * (0.25 + 0.65 * dome + (grain[k] - 0.5) * 0.15) + (1 - inside) * (0.05 + gapNoise[i] * 0.08);
      s.rough[i] = lerp(1, 0.88 - dome * 0.22, inside);
    }
  }
  return s;
}

function transposeSurface(s: Surface): Surface {
  const flip = (m: Channel): Channel => {
    const out = new Float32Array(N);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) out[x * SIZE + y] = m[y * SIZE + x];
    return out;
  };
  return { r: flip(s.r), g: flip(s.g), b: flip(s.b), height: flip(s.height), rough: flip(s.rough), metal: flip(s.metal), bump: s.bump };
}

/** Boards with butt joints and nails. Built running along x, then turned to run vertically. */
function planks(dark: boolean): Surface {
  const seed = dark ? 61 : 51;
  const r = rng(seed);
  const s = surface(5);
  const heights = Array.from({ length: 6 }, () => 0.9 + r() * 0.2);
  const cuts = heights.map(() => {
    const n = 1 + Math.floor(r() * 2);
    const start = r() * SIZE;
    return Array.from({ length: n }, (_, k) => start + (k * SIZE) / n + (r() - 0.5) * 120);
  });
  const lay = rowsLayout(heights, cuts);
  const fibre = fbm(6, 5, seed + 1, 0.55, 0.06);
  const bend = fbm(3, 4, seed + 2, 0.5, 0.2);
  const pores = fbm(256, 2, seed + 3, 0.5, 0.15);
  const weather = fbm(5, 5, seed + 4);
  const light = hex(dark ? 0x56402c : 0x9a7048);
  const deep = hex(dark ? 0x2a1d13 : 0x5b3d24);
  const grey = hex(0x7f776c);
  const nailColor = hex(0x2b2a28);
  for (let i = 0; i < N; i++) {
    const id = lay.id[i];
    const k = blockSample(lay, i);
    const u = lay.u[i];
    const v = lay.v[i];
    const w = lay.w[i];
    const h = lay.h[i];
    // Growth rings: stripes along the board, bent by low-frequency noise.
    const ring = 0.5 + 0.5 * Math.sin((v + (bend[k] - 0.5) * 36 + hash(id, 3) * 50) * (0.42 + hash(id, 5) * 0.3));
    const grain = smoothstep(0.75, 1, ring) * 0.35 + (fibre[k] - 0.5) * 1.6;
    const t = clamp01(0.35 + grain * 0.5 + (pores[k] - 0.5) * 0.3);
    const tone = 0.88 + hash(id, 6) * 0.24;
    paint(s, i, [lerp(light[0], deep[0], t) * tone, lerp(light[1], deep[1], t) * tone, lerp(light[2], deep[2], t) * tone]);
    if (!dark) mix(s, i, grey, smoothstep(0.6, 0.85, weather[i]) * 0.25);
    const inside = smoothstep(0.5, 2.5, Math.min(Math.min(v + 0.5, h - v - 0.5) - 1.5, Math.min(u + 0.5, w - u - 0.5) - 0.5));
    const nx = Math.min(Math.abs(u - 12), Math.abs(w - 12 - u));
    const ny = Math.min(Math.abs(v - h * 0.25), Math.abs(v - h * 0.75));
    const nail = 1 - smoothstep(2.2, 3.4, Math.hypot(nx, ny));
    mix(s, i, nailColor, nail * 0.9);
    shade(s, i, lerp(0.15, 1, inside));
    s.height[i] = inside * (0.62 + 0.12 * Math.sin((Math.PI * v) / h) - t * 0.06) + nail * 0.05;
    s.rough[i] = lerp(lerp(1, (dark ? 0.72 : 0.8) + (pores[k] - 0.5) * 0.1, inside), 0.5, nail);
    s.metal[i] = nail * 0.6;
  }
  return transposeSurface(s);
}

function roof(): Surface {
  const s = surface(7);
  const lay = rowsLayout(Array(10).fill(1), bond(10, 8, 6, 2));
  const grain = fbm(32, 5, 71);
  const lichen = fbm(16, 5, 72);
  const blotch = fbm(3, 5, 73);
  const edgeNoise = fbm(64, 3, 74);
  const palette = [0x7b3f2c, 0x8a4a32, 0x6d3828, 0x93553a, 0x5e3225, 0x84462f].map(hex);
  const under = hex(0x1e1512);
  const moss = hex(0x8c8a55);
  for (let i = 0; i < N; i++) {
    const id = lay.id[i];
    const u = lay.u[i];
    const w = lay.w[i];
    const vn = lay.v[i] / lay.h[i];
    const side = Math.min(u, w - u) - 2 - (edgeNoise[i] - 0.5) * 3;
    const lip = 1 - ((u / w) * 2 - 1) ** 2;
    const bottom = lay.h[i] - lay.v[i] - (1 - lip) * 10;
    const inside = smoothstep(0, 1.5, Math.min(side, bottom));
    const gr = grain[blockSample(lay, i)];
    const tone = (0.85 + hash(id, 6) * 0.3 + (gr - 0.5) * 0.3) * (0.5 + 0.5 * smoothstep(0, 0.4, vn));
    paint(s, i, pick(palette, hash(id, 4)), tone);
    mix(s, i, moss, smoothstep(0.68, 0.8, lichen[i]) * 0.45);
    shade(s, i, 1 - 0.25 * smoothstep(0.5, 0.8, blotch[i]));
    mix(s, i, under, 1 - inside);
    s.height[i] = inside * (0.25 + 0.65 * vn + (gr - 0.5) * 0.08) + (1 - inside) * 0.15;
    s.rough[i] = lerp(1, 0.82 + (gr - 0.5) * 0.15, inside);
  }
  return s;
}

function plaster(): Surface {
  const s = surface(3);
  const big = fbm(3, 5, 81);
  const mottle = fbm(32, 4, 82);
  const trowel = fbm(6, 4, 83, 0.5, 0.35);
  const fine = fbm(200, 2, 84);
  const streak = fbm(5, 4, 85, 0.5, 6);
  const crackNoise = fbm(10, 5, 86);
  const base = hex(0xc2b299);
  const stain = hex(0x8f8068);
  for (let i = 0; i < N; i++) {
    const ridge = 1 - Math.abs(crackNoise[i] * 2 - 1);
    const crack = smoothstep(0.978, 0.995, ridge) * smoothstep(0.58, 0.68, big[i]);
    paint(s, i, base, 0.92 + (mottle[i] - 0.5) * 0.12 + (fine[i] - 0.5) * 0.06 + (trowel[i] - 0.5) * 0.08);
    mix(s, i, stain, Math.min(0.6, smoothstep(0.55, 0.85, big[i]) * 0.35 + smoothstep(0.6, 0.85, streak[i]) * 0.25));
    shade(s, i, 1 - crack * 0.35);
    s.height[i] = 0.5 + (trowel[i] - 0.5) * 0.35 + (mottle[i] - 0.5) * 0.08 + (fine[i] - 0.5) * 0.04 - crack * 0.25;
    s.rough[i] = 0.9 + (fine[i] - 0.5) * 0.08;
  }
  return s;
}

/** Cave rock: tilted fracture facets, warped crags, strata, damp patches. */
function rock(): Surface {
  const s = surface(9);
  const cells = voronoi(6, 91, 0.9);
  const cellPx = SIZE / 6;
  const facets = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const id = cells.id[i];
    const a = hash(id, 1) * Math.PI * 2;
    facets[i] = hash(id, 3) * 0.5 + ((cells.ox[i] * Math.cos(a) + cells.oy[i] * Math.sin(a)) / cellPx) * (0.4 + hash(id, 2) * 0.6);
  }
  const soft = blur(facets, 2);
  const crag = fbm(12, 6, 92);
  const wx = fbm(4, 4, 93);
  const wy = fbm(4, 4, 94);
  const strataBase = fbm(3, 4, 95);
  const grit = fbm(128, 3, 96);
  const damp = fbm(4, 5, 97);
  const mineral = fbm(8, 5, 98);
  const strataAt = new Float32Array(N);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const ridged = 1 - Math.abs(sample(crag, x + (wx[i] - 0.5) * 80, y + (wy[i] - 0.5) * 80) * 2 - 1);
      strataAt[i] = 0.5 + 0.5 * Math.sin(((y + (strataBase[i] - 0.5) * 260) / SIZE) * Math.PI * 2 * 9);
      s.height[i] = soft[i] * 0.45 + ridged * 0.3 + strataAt[i] * 0.1 + (grit[i] - 0.5) * 0.12;
    }
  }
  normalize(s.height);
  const dark = hex(0x46423e);
  const mid = hex(0x6a645d);
  const brown = hex(0x5c4b3d);
  const pale = hex(0x9a958c);
  for (let i = 0; i < N; i++) {
    const t = s.height[i];
    paint(s, i, [lerp(dark[0], mid[0], t), lerp(dark[1], mid[1], t), lerp(dark[2], mid[2], t)], 0.9 + (grit[i] - 0.5) * 0.3);
    mix(s, i, brown, smoothstep(0.45, 0.75, mineral[i]) * 0.6);
    if (mineral[i] < 0.5) mix(s, i, pale, smoothstep(0.8, 1, strataAt[i]) * 0.1);
    const wet = smoothstep(0.55, 0.75, damp[i]);
    shade(s, i, 1 - wet * 0.3);
    s.rough[i] = 0.92 - wet * 0.45 + (grit[i] - 0.5) * 0.1;
  }
  return s;
}

function dirt(): Surface {
  const s = surface(7);
  const mottle = fbm(6, 6, 101);
  const grit = fbm(256, 2, 102);
  const pebbles = voronoi(36, 103, 0.9);
  const clumps = fbm(24, 4, 104);
  const a = hex(0x5b4a3b);
  const b = hex(0x46382c);
  const c = hex(0x6e5b48);
  const stone = hex(0x5f5750);
  for (let i = 0; i < N; i++) {
    const id = pebbles.id[i];
    const isPebble = hash(id, 1) > 0.8 ? 1 : 0;
    const radius = (SIZE / 36) * (0.3 + hash(id, 2) * 0.2);
    const peb = isPebble * (1 - smoothstep(radius - 1.5, radius, pebbles.f1[i]));
    const dome = isPebble * Math.sqrt(clamp01(1 - (pebbles.f1[i] / radius) ** 2));
    const t = mottle[i];
    const base = t < 0.5
      ? [lerp(b[0], a[0], t * 2), lerp(b[1], a[1], t * 2), lerp(b[2], a[2], t * 2)] as const
      : [lerp(a[0], c[0], (t - 0.5) * 2), lerp(a[1], c[1], (t - 0.5) * 2), lerp(a[2], c[2], (t - 0.5) * 2)] as const;
    paint(s, i, base, 0.9 + (grit[i] - 0.5) * 0.3 + (clumps[i] - 0.5) * 0.15);
    const tone = 0.7 + hash(id, 3) * 0.35 + dome * 0.15;
    mix(s, i, [stone[0] * tone, stone[1] * tone, stone[2] * tone], peb);
    s.height[i] = 0.3 + (mottle[i] - 0.5) * 0.25 + (clumps[i] - 0.5) * 0.2 + (grit[i] - 0.5) * 0.08 + dome * 0.45;
    s.rough[i] = lerp(0.97, 0.75, peb);
  }
  return s;
}

/** Machined basalt panels with engraved frames and ring motifs: the builders' stonework. */
function ancient(): Surface {
  const s = surface(5);
  const lay = rowsLayout([1, 1], [[0, SIZE / 2], [SIZE / 4, (3 * SIZE) / 4]]);
  const speck = fbm(128, 3, 111);
  const mottle = fbm(4, 5, 112);
  const veinNoise = fbm(5, 5, 113);
  const wear = fbm(24, 4, 114);
  const base = hex(0x7b8386);
  const vein = hex(0x9ba2a4);
  const groove = hex(0x2f3437);
  const engrave = (d: number): number => 1 - smoothstep(0.8, 2, d);
  for (let i = 0; i < N; i++) {
    const id = lay.id[i];
    const e = lay.edge[i];
    const cx = lay.u[i] - lay.w[i] / 2;
    const cy = lay.v[i] - lay.h[i] / 2;
    const rr = Math.hypot(cx, cy);
    const seam = 1 - smoothstep(4, 7, e);
    let lines = engrave(Math.abs(e - 44));
    if (hash(id, 3) > 0.4) {
      const t = (Math.atan2(cy, cx) / (Math.PI * 2)) * 24;
      const tick = rr > 156 && rr < 184 ? engrave(Math.abs(t - Math.round(t)) * ((Math.PI * 2) / 24) * rr) : 0;
      lines = Math.max(lines, engrave(Math.abs(rr - 130)), engrave(Math.abs(rr - 150)) * 0.8, tick);
    }
    const veinM = smoothstep(0.985, 0.998, 1 - Math.abs(veinNoise[i] * 2 - 1)) * smoothstep(0.5, 0.65, mottle[i]);
    paint(s, i, base, 0.92 + (mottle[i] - 0.5) * 0.15 + (speck[i] - 0.5) * 0.12 + hash(id, 6) * 0.06);
    mix(s, i, vein, veinM * 0.3);
    shade(s, i, 1 + (1 - smoothstep(7, 18, e)) * (wear[i] > 0.5 ? 0.1 : 0.04));
    mix(s, i, groove, Math.max(seam, lines * 0.8));
    s.height[i] = 0.7 - seam * 0.65 - lines * 0.18 + (speck[i] - 0.5) * 0.03;
    s.rough[i] = 0.5 + (speck[i] - 0.5) * 0.1 + seam * 0.35 + lines * 0.25 - veinM * 0.15;
  }
  return s;
}

/** Riveted steel plates; `rusty` corrodes them and leaves flakes of old paint. */
function metal(rusty: boolean): Surface {
  const s = surface(4);
  const lay = rowsLayout([1, 1], [[0, SIZE / 2], [SIZE / 4, (3 * SIZE) / 4]]);
  const brushed = fbm(4, 3, 121, 0.5, 1 / 60);
  const stains = fbm(5, 6, 122);
  const fine = fbm(96, 3, 123);
  const scratches = scratchMap(124, 500);
  const rustNoise = fbm(6, 6, 125);
  const paintNoise = fbm(9, 5, 126);
  const pits = fbm(96, 3, 127);
  const steel = hex(0x777b80);
  const dark = hex(0x3c3b39);
  const rustA = hex(0x5e3420);
  const rustB = hex(0x8a4a26);
  const rustPit = hex(0x3b2216);
  const paintColor = hex(0x3f4a44);
  const toGrid = (t: number): number => Math.abs(t - Math.round(t / 64) * 64);
  for (let i = 0; i < N; i++) {
    const e = lay.edge[i];
    const u = lay.u[i];
    const v = lay.v[i];
    const w = lay.w[i];
    const h = lay.h[i];
    const seam = 1 - smoothstep(1.5, 3, e);
    const d1 = Math.hypot(Math.min(Math.abs(u - 16), Math.abs(u - (w - 16))), toGrid(v - 16));
    const d2 = Math.hypot(toGrid(u - 16), Math.min(Math.abs(v - 16), Math.abs(v - (h - 16))));
    const rd = Math.min(d1, d2);
    const rivet = rd < 6 ? Math.sqrt(1 - (rd / 6) ** 2) : 0;
    paint(s, i, steel, 0.9 + (brushed[i] - 0.5) * 0.35 + (fine[i] - 0.5) * 0.08 + scratches[i] * 0.15);
    const stain = smoothstep(0.55, 0.8, stains[i]);
    mix(s, i, dark, stain * 0.6);
    let metalness = lerp(0.9, 0.35, stain);
    let rough = 0.38 + (brushed[i] - 0.5) * 0.12 + stain * 0.35 + scratches[i] * 0.1;
    let height = 0.6 - seam * 0.5 + rivet * 0.35 - scratches[i] * 0.04 + (fine[i] - 0.5) * 0.02;
    if (rusty) {
      const rust = smoothstep(0.32, 0.48, rustNoise[i] + (1 - smoothstep(0, 60, e)) * 0.22 + rivet * 0.2);
      const flake = (1 - rust) * smoothstep(0.56, 0.62, paintNoise[i]);
      shade(s, i, 0.75);
      const pit = smoothstep(0.6, 0.8, pits[i]) * 0.8;
      const rc: Color = [lerp(lerp(rustA[0], rustB[0], fine[i]), rustPit[0], pit), lerp(lerp(rustA[1], rustB[1], fine[i]), rustPit[1], pit), lerp(lerp(rustA[2], rustB[2], fine[i]), rustPit[2], pit)];
      mix(s, i, rc, rust);
      mix(s, i, [paintColor[0] * (0.9 + (fine[i] - 0.5) * 0.2), paintColor[1], paintColor[2]], flake);
      metalness = lerp(lerp(metalness, 0.1, rust), 0, flake);
      rough = lerp(lerp(rough, 0.88, rust), 0.6, flake);
      height += rust * (pits[i] - 0.5) * 0.25 + flake * 0.04;
    }
    mix(s, i, [dark[0] * 0.5, dark[1] * 0.5, dark[2] * 0.5], seam);
    s.height[i] = height;
    s.rough[i] = rough;
    s.metal[i] = metalness;
  }
  return s;
}

function canvas(): Surface {
  const s = surface(3);
  const fibre = fbm(128, 3, 131, 0.5, 0.3);
  const stains = fbm(4, 5, 132);
  const folds = fbm(2, 4, 133);
  const base = hex(0xb09d7c);
  const stain = hex(0x76664f);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const over = ((x >> 3) + (y >> 3)) & 1;
      const thread = over ? Math.sin((Math.PI * ((y & 7) + 0.5)) / 8) : Math.sin((Math.PI * ((x & 7) + 0.5)) / 8);
      paint(s, i, base, 0.82 + thread * 0.22 + (fibre[i] - 0.5) * 0.15);
      mix(s, i, stain, smoothstep(0.55, 0.85, stains[i]) * 0.5);
      s.height[i] = 0.35 + 0.45 * thread + (fibre[i] - 0.5) * 0.2 + (folds[i] - 0.5) * 0.6;
      s.rough[i] = 0.97;
    }
  }
  return s;
}

function moss(): Surface {
  const s = surface(6);
  const clumps = voronoi(72, 141, 0.9);
  const fine = fbm(256, 2, 142);
  const big = fbm(4, 5, 143);
  const cushions = fbm(12, 5, 144);
  const darkC = hex(0x26361b);
  const midC = hex(0x46612e);
  const tipC = hex(0x76873f);
  for (let i = 0; i < N; i++) {
    const id = clumps.id[i];
    const radius = (SIZE / 72) * (0.6 + hash(id, 1) * 0.35);
    const sprig = Math.sqrt(clamp01(1 - (clumps.f1[i] / radius) ** 2)) * (0.6 + hash(id, 2) * 0.4);
    const dome = clamp01(smoothstep(0.3, 0.75, cushions[i]) * 0.6 + sprig * 0.25 + (fine[i] - 0.5) * 0.4);
    const t = clamp01(dome * 0.9 + (fine[i] - 0.5) * 0.3);
    const from = t < 0.5 ? darkC : midC;
    const to = t < 0.5 ? midC : tipC;
    const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    paint(s, i, [lerp(from[0], to[0], f), lerp(from[1], to[1], f), lerp(from[2], to[2], f)], 0.85 + (big[i] - 0.5) * 0.4);
    mix(s, i, tipC, smoothstep(0.6, 0.8, big[i]) * 0.3);
    s.height[i] = 0.15 + dome * 0.7 + (fine[i] - 0.5) * 0.25;
    s.rough[i] = 1;
  }
  return s;
}

const RECIPES: Record<string, () => Surface> = {
  stone_floor: flagstones,
  stone_wall: () => ashlar(21, 0),
  crack: () => ashlar(201, 1),
  rock,
  brick,
  plaster,
  cobble,
  dirt,
  ancient,
  wood: () => planks(false),
  wood_dark: () => planks(true),
  metal: () => metal(false),
  rust: () => metal(true),
  roof,
  canvas,
  moss,
};

/** Materials whose source image, if present, replaces the procedural surface. */
const ORGANIC = new Set(['rock', 'dirt', 'plaster', 'moss', 'canvas']);

// ---------------------------------------------------------------- source images

function readRgb(path: string, tmp: string): [Channel, Channel, Channel] {
  const raw = join(tmp, 'source.rgb');
  execFileSync('magick', [path, '-resize', `${SIZE}x${SIZE}!`, '-depth', '8', `rgb:${raw}`]);
  const bytes = readFileSync(raw);
  const out: [Channel, Channel, Channel] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) out[c][i] = bytes[i * 3 + c] / 255;
  return out;
}

/**
 * Four copies offset by half a tile, each fading out over its own seams, blended so contrast
 * survives (variance-preserving, after Heitz and Neyret).
 */
function seamless(m: Channel): Channel {
  let mean = 0;
  for (let i = 0; i < N; i++) mean += m[i];
  mean /= N;
  const out = new Float32Array(N);
  const half = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    const sy = Math.sin((Math.PI * y) / SIZE) ** 2;
    const ys = (y + half) & MASK;
    for (let x = 0; x < SIZE; x++) {
      const sx = Math.sin((Math.PI * x) / SIZE) ** 2;
      const xs = (x + half) & MASK;
      const w0 = sx * sy;
      const w1 = (1 - sx) * sy;
      const w2 = sx * (1 - sy);
      const w3 = (1 - sx) * (1 - sy);
      const num = w0 * (m[y * SIZE + x] - mean) + w1 * (m[y * SIZE + xs] - mean) + w2 * (m[ys * SIZE + x] - mean) + w3 * (m[ys * SIZE + xs] - mean);
      out[y * SIZE + x] = clamp01(mean + num / Math.sqrt(w0 * w0 + w1 * w1 + w2 * w2 + w3 * w3));
    }
  }
  return out;
}

function fromSource(path: string, tmp: string): Surface {
  const s = surface(6);
  const [r, g, b] = readRgb(path, tmp).map(seamless);
  s.r = r;
  s.g = g;
  s.b = b;
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = r[i] * 0.3 + g[i] * 0.59 + b[i] * 0.11;
  const low = blur(lum, 48);
  for (let i = 0; i < N; i++) s.height[i] = lum[i] - low[i];
  normalize(s.height);
  for (let i = 0; i < N; i++) s.rough[i] = 0.92 - (s.height[i] - 0.5) * 0.3;
  return s;
}

// ---------------------------------------------------------------- output

function writeJpg(path: string, channels: [Channel, Channel, Channel], tmp: string, quality: number, size: number, data: boolean): void {
  const bytes = new Uint8Array(N * 3);
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) bytes[i * 3 + c] = clamp01(channels[c][i]) * 255 + 0.5;
  const raw = join(tmp, 'map.rgb');
  writeFileSync(raw, bytes);
  const args = ['-size', `${SIZE}x${SIZE}`, '-depth', '8', `rgb:${raw}`];
  if (size !== SIZE) args.push('-resize', `${size}x${size}`);
  // Data maps keep full chroma: subsampling would bleed roughness into metalness, or tilt normals.
  if (data) args.push('-sampling-factor', '1x1');
  args.push('-strip', '-quality', String(quality), path);
  execFileSync('magick', args);
}

/** Bakes cavities into the albedo and writes the three maps. */
function finish(name: string, s: Surface, tmp: string): void {
  const near = blur(s.height, 3);
  const wide = blur(s.height, 14);
  const ao = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    ao[i] = clamp01(1 - Math.max(0, near[i] - s.height[i]) * 4 - Math.max(0, wide[i] - s.height[i]) * 1.5);
    shade(s, i, lerp(1, ao[i], 0.6));
  }
  const nx = new Float32Array(N);
  const ny = new Float32Array(N);
  const nz = new Float32Array(N);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const gx = s.height[y * SIZE + ((x + 1) & MASK)] - s.height[y * SIZE + ((x - 1) & MASK)];
      const gy = s.height[((y + 1) & MASK) * SIZE + x] - s.height[((y - 1) & MASK) * SIZE + x];
      // OpenGL convention (green up), which three.js expects with flipped image textures.
      const ax = -gx * s.bump;
      const ay = gy * s.bump;
      const len = Math.hypot(ax, ay, 1);
      nx[i] = (ax / len) * 0.5 + 0.5;
      ny[i] = (ay / len) * 0.5 + 0.5;
      nz[i] = (1 / len) * 0.5 + 0.5;
    }
  }
  writeJpg(join(OUT_DIR, `${name}_albedo.jpg`), [s.r, s.g, s.b], tmp, 88, SIZE, false);
  writeJpg(join(OUT_DIR, `${name}_normal.jpg`), [nx, ny, nz], tmp, 92, SIZE, true);
  writeJpg(join(OUT_DIR, `${name}_orm.jpg`), [ao, s.rough, s.metal], tmp, 90, SIZE / 2, true);
}

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(RECIPES);
mkdirSync(OUT_DIR, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'floor-zero-textures-'));
try {
  for (const name of names) {
    const recipe = RECIPES[name];
    if (!recipe) throw new Error(`Unknown texture "${name}". Known: ${Object.keys(RECIPES).join(', ')}`);
    const started = performance.now();
    const source = join(SRC_DIR, `${name}.png`);
    const fromImage = ORGANIC.has(name) && existsSync(source);
    finish(name, fromImage ? fromSource(source, tmp) : recipe(), tmp);
    console.log(`${name}${fromImage ? ' (from source image)' : ''}: ${Math.round(performance.now() - started)} ms`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
