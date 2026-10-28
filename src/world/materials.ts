import * as THREE from 'three';
import { createGridTexture } from '../render/textures';

export type MaterialKey =
  | 'stone_floor' | 'stone_wall' | 'rock' | 'brick' | 'plaster' | 'cobble' | 'dirt' | 'ancient'
  | 'wood' | 'wood_dark' | 'metal' | 'rust' | 'roof' | 'canvas' | 'moss'
  | 'water' | 'lamp' | 'window' | 'window_dark' | 'glow_blue' | 'core' | 'crack'
  | 'ore_copper' | 'ore_iron' | 'ore_cobalt'
  | 'leather' | 'bronze' | 'tool_copper' | 'tool_iron' | 'tool_cobalt'
  | 'hazard' | 'interact' | 'shortcut' | 'safe';

interface MaterialSpec {
  /** Greybox colour, used when the material has no texture set or it failed to load. */
  color: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  /** Metres per texture repeat on box-projected UVs. */
  tile?: number;
  transparent?: boolean;
  opacity?: number;
  /** Greybox grid overlay. Emissive and water materials skip it. */
  grid?: boolean;
  /** Texture set in public/assets/textures, made by tools/textures.ts. */
  textures?: string;
  /**
   * A texture set lending only its surface (normal, roughness, metalness) to a flat colour:
   * worked metals and leather, whose colour matters more than any pattern.
   */
  surface?: string;
  /** Multiplies the albedo texture. */
  tint?: number;
  normalScale?: number;
  /** Strength of a slow colour drift in world space, which hides the texture repeating. */
  weather?: number;
  /** World-space strata and mineral seeps: natural rock. */
  strata?: boolean;
  /** Grain runs along each piece's longest side instead of the world axes: timber. */
  grain?: boolean;
}

/** Each surface's texture set and real-world scale, with the greybox palette as a fallback. */
const SPECS: Record<MaterialKey, MaterialSpec> = {
  stone_floor: { color: 0x9a948a, roughness: 0.9, textures: 'stone_floor', tile: 3, weather: 0.12 },
  stone_wall: { color: 0x7d776f, roughness: 0.92, textures: 'stone_wall', tile: 2.4, weather: 0.12 },
  rock: { color: 0x5f5a55, roughness: 0.95, textures: 'rock', tile: 3, normalScale: 1.3, weather: 0.16, strata: true },
  brick: { color: 0x8a5a48, roughness: 0.9, textures: 'brick', tile: 1.1, weather: 0.1 },
  plaster: { color: 0xc9b9a0, roughness: 0.95, textures: 'plaster', tile: 2, weather: 0.12 },
  cobble: { color: 0x85807a, roughness: 0.9, textures: 'cobble', tile: 1.6, weather: 0.1 },
  dirt: { color: 0x5b4a3b, roughness: 1, textures: 'dirt', tile: 2.5, weather: 0.16 },
  ancient: { color: 0x8b9396, roughness: 0.7, textures: 'ancient', tile: 2, weather: 0.08 },
  wood: { color: 0x8a6440, roughness: 0.8, textures: 'wood', tile: 1.2, weather: 0.08, grain: true },
  wood_dark: { color: 0x4f3826, roughness: 0.85, textures: 'wood_dark', tile: 1.6, weather: 0.1, grain: true },
  metal: { color: 0x7a7f86, roughness: 0.45, metalness: 0.8, textures: 'metal', tile: 1.5, weather: 0.1 },
  rust: { color: 0x7a4a30, roughness: 0.75, metalness: 0.4, textures: 'rust', tile: 1.5, weather: 0.12 },
  roof: { color: 0x5a3b33, roughness: 0.85, textures: 'roof', tile: 1.2, weather: 0.1 },
  canvas: { color: 0xb8a684, roughness: 1, textures: 'canvas', tile: 1, weather: 0.08 },
  moss: { color: 0x4d6b3a, roughness: 1, textures: 'moss', tile: 1.5, weather: 0.15 },
  water: { color: 0x0d2230, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, grid: false },
  lamp: { color: 0xffd9a0, emissive: 0xffb25e, emissiveIntensity: 3.5, grid: false },
  window: { color: 0x3a2a18, emissive: 0xffa548, emissiveIntensity: 1.4, grid: false },
  // Unlit glass: dark, catching a little of the sky.
  window_dark: { color: 0x14171b, roughness: 0.18, metalness: 0.4, grid: false },
  glow_blue: { color: 0x9fd4ff, emissive: 0x5fb0ff, emissiveIntensity: 2.5, grid: false },
  core: { color: 0xe6fbff, emissive: 0x9ef3ff, emissiveIntensity: 3, grid: false },
  crack: { color: 0x6b625a, roughness: 0.95, textures: 'crack', tile: 2.4, weather: 0.12 },
  // Ore breaking out of its seam: bright enough to read across a cave (doc 12).
  ore_copper: { color: 0xd38c5c, roughness: 0.3, metalness: 1, grid: false },
  ore_iron: { color: 0xc2c6cc, roughness: 0.32, metalness: 0.95, grid: false },
  ore_cobalt: { color: 0x3b62d8, roughness: 0.22, metalness: 0.5, emissive: 0x2048c0, emissiveIntensity: 0.9, grid: false },
  // Held tools. Roughness doubles here because the surface map's roughness averages about a half.
  leather: { color: 0x3a291d, roughness: 0.75, metalness: 0, surface: 'canvas', tile: 0.6, grid: false },
  bronze: { color: 0x8c7446, roughness: 0.9, metalness: 1, surface: 'metal', tile: 0.5, grid: false },
  tool_copper: { color: 0xc98458, roughness: 0.75, metalness: 1, surface: 'metal', tile: 0.5, grid: false },
  tool_iron: { color: 0xa2a6ab, roughness: 0.65, metalness: 1, surface: 'metal', tile: 0.5, grid: false },
  tool_cobalt: { color: 0x4560b0, roughness: 0.6, metalness: 1, emissive: 0x1a3fa0, emissiveIntensity: 0.18, surface: 'metal', tile: 0.5, grid: false },
  hazard: { color: 0xc23b30, roughness: 0.8 },
  interact: { color: 0xe0b43a, roughness: 0.7 },
  shortcut: { color: 0x3a6fd0, roughness: 0.7 },
  safe: { color: 0x4f9a5a, roughness: 0.8 },
};

interface TextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** Occlusion, roughness, metalness in R, G, B. */
  orm: THREE.Texture;
}

/**
 * Box-projected UVs in metres: each face takes the two axes it faces across, so walls keep
 * textures upright and every surface shares one scale. `scale` is the mesh's world scale.
 */
export function applyWorldUVs(geometry: THREE.BufferGeometry, tile: number, scale = 1): void {
  const pos = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const k = scale / tile;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u * k;
    uv[i * 2 + 1] = v * k;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.worldUVs = true;
}

/**
 * Timber UVs: box-projected like applyWorldUVs, but in the piece's own frame with the grain (the
 * texture's v) along its longest side, and a per-piece offset so neighbouring beams differ.
 */
export function applyGrainUVs(geometry: THREE.BufferGeometry, tile: number, scale = 1): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const long = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
  const seed = Math.abs(Math.sin(centre.x * 12.9898 + centre.y * 78.233 + centre.z * 37.719) * 43758.5453);
  const offU = seed % 1;
  const offV = (seed * 7.31) % 1;
  const pos = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const k = scale / tile;
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    // The two axes this face spans, as indices into p.
    const [a, b] = nx >= ny && nx >= nz ? [1, 2] : ny >= nz ? [0, 2] : [0, 1];
    // The grain runs along the long side wherever it lies in this face; end grain takes either.
    const v = a === long ? a : b;
    const u = v === a ? b : a;
    p[0] = pos.getX(i);
    p[1] = pos.getY(i);
    p[2] = pos.getZ(i);
    uv[i * 2] = p[u] * k + offU;
    uv[i * 2 + 1] = p[v] * k + offV;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.worldUVs = true;
}

/** Fits UVs to a material: timber along its grain, everything else box-projected. */
export function fitUVs(geometry: THREE.BufferGeometry, key: MaterialKey, tile: number, scale = 1): void {
  if (SPECS[key].grain) applyGrainUVs(geometry, tile, scale);
  else applyWorldUVs(geometry, tile, scale);
}

/** Cheap value noise for the weathering below: smooth, and plenty for colour drift. */
const NOISE_GLSL = /* glsl */ `
  varying vec3 vFzWorld;
  float fzHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float fzNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(fzHash(i), fzHash(i + vec3(1, 0, 0)), f.x), mix(fzHash(i + vec3(0, 1, 0)), fzHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(fzHash(i + vec3(0, 0, 1)), fzHash(i + vec3(1, 0, 1)), f.x), mix(fzHash(i + vec3(0, 1, 1)), fzHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fzWet = 0.0;
`;

/**
 * Weathering in world space, added to the standard shader: a slow colour drift over every
 * textured surface, and for natural rock, strata bands and mineral seeps that run unbroken
 * across walls and ceilings, which no tiling texture can do.
 */
function weathering(material: THREE.MeshStandardMaterial, spec: MaterialSpec): void {
  const weather = spec.weather ?? 0;
  if (weather <= 0 && !spec.strata) return;
  material.customProgramCacheKey = () => `fz-weather:${weather}:${spec.strata ? 1 : 0}`;
  material.onBeforeCompile = (shader) => {
    shader.defines = { ...shader.defines, FZ_WEATHER: weather.toFixed(3), ...(spec.strata ? { FZ_STRATA: '' } : {}) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFzWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 fzWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fzWorld = instanceMatrix * fzWorld;
        #endif
        vFzWorld = (modelMatrix * fzWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 p = vFzWorld;
          float drift = fzNoise(p * 0.11) * 0.65 + fzNoise(p * 0.37 + 7.0) * 0.35;
          diffuseColor.rgb *= 1.0 + (drift - 0.5) * 2.0 * FZ_WEATHER;
          #ifdef FZ_STRATA
            // Layers a little under a metre thick, wandering gently, each its own shade.
            float layer = p.y * 1.35 + fzNoise(p * vec3(0.07, 0.04, 0.07)) * 3.0 + fzNoise(p * 0.5) * 0.25;
            float band = fzHash(vec3(floor(layer) * 7.13, 1.7, 3.1));
            float seam = smoothstep(0.0, 0.06, fract(layer)) * smoothstep(1.0, 0.9, fract(layer));
            diffuseColor.rgb *= mix(vec3(0.62), mix(vec3(0.8, 0.79, 0.78), vec3(1.14, 1.08, 1.0), band), seam);
            // Seeps: streaks running down the rock, rust-stained and wet.
            float streak = fzNoise(vec3(p.x * 1.6, p.y * 0.06, p.z * 1.6) + 3.0);
            float seep = smoothstep(0.66, 0.88, streak) * smoothstep(0.35, 0.65, fzNoise(p * 0.18 + 11.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 0.9, 0.66), seep * 0.85);
            fzWet = seep;
          #endif
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= 1.0 - fzWet * 0.55;`,
      );
  };
}

const tmpScale = new THREE.Vector3();

export function isMaterialKey(name: string): name is MaterialKey {
  return name in SPECS;
}

/** 'shaded' takes per-vertex colour: LevelKit's rock, darkened in its hollows. */
export type MaterialVariant = 'shaded';

export class MaterialLibrary {
  private readonly cache = new Map<string, { key: MaterialKey; material: THREE.MeshStandardMaterial }>();
  private readonly keys = new WeakMap<THREE.Material, MaterialKey>();
  private readonly sets = new Map<string, TextureSet>();
  private readonly grid = createGridTexture();

  /**
   * Loads every texture set the palette uses. Materials made before this (the viewmodel's)
   * are upgraded in place, so call it before the first frame to avoid shader recompiles.
   */
  async preload(anisotropy: number): Promise<void> {
    const loader = new THREE.TextureLoader();
    const names = [...new Set(Object.values(SPECS).flatMap((spec) => [spec.textures, spec.surface].filter((name): name is string => name !== undefined)))];
    await Promise.all(names.map(async (name) => {
      try {
        const [map, normalMap, orm] = await Promise.all(
          ['albedo', 'normal', 'orm'].map((kind) => loader.loadAsync(`${import.meta.env.BASE_URL}assets/textures/${name}_${kind}.jpg`)),
        );
        if (!map || !normalMap || !orm) return;
        map.colorSpace = THREE.SRGBColorSpace;
        for (const texture of [map, normalMap, orm]) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = anisotropy;
        }
        this.sets.set(name, { map, normalMap, orm });
      } catch (error) {
        console.warn(`Texture set "${name}" didn't load; keeping the greybox look.`, error);
      }
    }));
    for (const { key, material } of this.cache.values()) this.apply(key, material);
  }

  get(key: MaterialKey, variant?: MaterialVariant): THREE.MeshStandardMaterial {
    const id = variant ? `${key}:${variant}` : key;
    const cached = this.cache.get(id);
    if (cached) return cached.material;
    const spec = SPECS[key];
    const material = new THREE.MeshStandardMaterial({
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 1,
      transparent: spec.transparent ?? false,
      opacity: spec.opacity ?? 1,
      vertexColors: variant === 'shaded',
    });
    material.name = id;
    weathering(material, spec);
    this.apply(key, material);
    this.cache.set(id, { key, material });
    this.keys.set(material, key);
    return material;
  }

  /** Metres per texture repeat for world-space UVs. */
  tile(key: MaterialKey): number {
    return SPECS[key].tile ?? 1;
  }

  /** True for timber, whose UVs follow each piece's grain. */
  grained(key: MaterialKey): boolean {
    return SPECS[key].grain === true;
  }

  /**
   * Gives loose meshes (props, tools) the same metre-scaled UVs as level geometry, so a lever
   * handle doesn't get a whole wall's worth of texture squeezed onto it.
   */
  fit(root: THREE.Object3D): void {
    root.updateWorldMatrix(true, true);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const key = this.keys.get(object.material as THREE.Material);
      const geometry = object.geometry as THREE.BufferGeometry;
      const spec = key === undefined ? undefined : SPECS[key];
      if (key === undefined || !(spec?.textures || spec?.surface) || geometry.userData.worldUVs || !geometry.getAttribute('normal')) return;
      object.getWorldScale(tmpScale);
      fitUVs(geometry, key, this.tile(key), (tmpScale.x + tmpScale.y + tmpScale.z) / 3);
    });
  }

  private apply(key: MaterialKey, material: THREE.MeshStandardMaterial): void {
    const spec = SPECS[key];
    const surface = spec.surface ? this.sets.get(spec.surface) : undefined;
    if (surface) {
      material.color.set(spec.color);
      material.roughness = spec.roughness ?? 0.85;
      material.metalness = spec.metalness ?? 0;
      material.map = null;
      material.normalMap = surface.normalMap;
      material.roughnessMap = surface.orm;
      material.metalnessMap = spec.metalness ? surface.orm : null;
      material.normalScale.setScalar(spec.normalScale ?? 0.6);
      material.needsUpdate = true;
      return;
    }
    const set = spec.textures ? this.sets.get(spec.textures) : undefined;
    material.color.set(set ? (spec.tint ?? 0xffffff) : spec.color);
    // With maps, the ORM texture carries roughness and metalness; the scalars just pass it through.
    material.roughness = set ? 1 : (spec.roughness ?? 0.85);
    material.metalness = set ? 1 : (spec.metalness ?? 0);
    material.map = set ? set.map : spec.grid === false ? null : this.grid;
    material.normalMap = set?.normalMap ?? null;
    material.roughnessMap = set?.orm ?? null;
    material.metalnessMap = set?.orm ?? null;
    material.normalScale.setScalar(spec.normalScale ?? 1);
    material.needsUpdate = true;
  }
}
