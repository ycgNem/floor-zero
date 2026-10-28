import * as THREE from 'three';
import { createGridTexture } from '../render/textures';

export type MaterialKey =
  | 'stone_floor' | 'stone_wall' | 'rock' | 'brick' | 'plaster' | 'cobble' | 'dirt' | 'ancient'
  | 'wood' | 'wood_dark' | 'metal' | 'rust' | 'roof' | 'canvas' | 'moss'
  | 'water' | 'lamp' | 'window' | 'glow_blue' | 'core' | 'crack'
  | 'ore_copper' | 'ore_iron' | 'ore_cobalt'
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
  /** Multiplies the albedo texture. */
  tint?: number;
  normalScale?: number;
}

/** Each surface's texture set and real-world scale, with the greybox palette as a fallback. */
const SPECS: Record<MaterialKey, MaterialSpec> = {
  stone_floor: { color: 0x9a948a, roughness: 0.9, textures: 'stone_floor', tile: 3 },
  stone_wall: { color: 0x7d776f, roughness: 0.92, textures: 'stone_wall', tile: 2.4 },
  rock: { color: 0x5f5a55, roughness: 0.95, textures: 'rock', tile: 3, normalScale: 1.2 },
  brick: { color: 0x8a5a48, roughness: 0.9, textures: 'brick', tile: 1.1 },
  plaster: { color: 0xc9b9a0, roughness: 0.95, textures: 'plaster', tile: 2 },
  cobble: { color: 0x85807a, roughness: 0.9, textures: 'cobble', tile: 1.6 },
  dirt: { color: 0x5b4a3b, roughness: 1, textures: 'dirt', tile: 2.5 },
  ancient: { color: 0x8b9396, roughness: 0.7, textures: 'ancient', tile: 2 },
  wood: { color: 0x8a6440, roughness: 0.8, textures: 'wood', tile: 1.2 },
  wood_dark: { color: 0x4f3826, roughness: 0.85, textures: 'wood_dark', tile: 1.2 },
  metal: { color: 0x7a7f86, roughness: 0.45, metalness: 0.8, textures: 'metal', tile: 1.5 },
  rust: { color: 0x7a4a30, roughness: 0.75, metalness: 0.4, textures: 'rust', tile: 1.5 },
  roof: { color: 0x5a3b33, roughness: 0.85, textures: 'roof', tile: 1.2 },
  canvas: { color: 0xb8a684, roughness: 1, textures: 'canvas', tile: 1 },
  moss: { color: 0x4d6b3a, roughness: 1, textures: 'moss', tile: 1.5 },
  water: { color: 0x0d2230, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, grid: false },
  lamp: { color: 0xffd9a0, emissive: 0xffb25e, emissiveIntensity: 3.5, grid: false },
  window: { color: 0x3a2a18, emissive: 0xffa548, emissiveIntensity: 1.4, grid: false },
  glow_blue: { color: 0x9fd4ff, emissive: 0x5fb0ff, emissiveIntensity: 2.5, grid: false },
  core: { color: 0xe6fbff, emissive: 0x9ef3ff, emissiveIntensity: 3, grid: false },
  crack: { color: 0x6b625a, roughness: 0.95, textures: 'crack', tile: 2.4 },
  ore_copper: { color: 0xb8673a, roughness: 0.5, metalness: 0.6, grid: false },
  ore_iron: { color: 0x8c8f94, roughness: 0.45, metalness: 0.7, grid: false },
  ore_cobalt: { color: 0x2f5fd0, roughness: 0.35, metalness: 0.6, emissive: 0x1a3fa0, emissiveIntensity: 0.6, grid: false },
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

const tmpScale = new THREE.Vector3();

export class MaterialLibrary {
  private readonly cache = new Map<MaterialKey, THREE.MeshStandardMaterial>();
  private readonly keys = new WeakMap<THREE.Material, MaterialKey>();
  private readonly sets = new Map<string, TextureSet>();
  private readonly grid = createGridTexture();

  /**
   * Loads every texture set the palette uses. Materials made before this (the viewmodel's)
   * are upgraded in place, so call it before the first frame to avoid shader recompiles.
   */
  async preload(anisotropy: number): Promise<void> {
    const loader = new THREE.TextureLoader();
    const names = [...new Set(Object.values(SPECS).flatMap((spec) => (spec.textures ? [spec.textures] : [])))];
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
    for (const [key, material] of this.cache) this.apply(key, material);
  }

  get(key: MaterialKey): THREE.MeshStandardMaterial {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const spec = SPECS[key];
    const material = new THREE.MeshStandardMaterial({
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 1,
      transparent: spec.transparent ?? false,
      opacity: spec.opacity ?? 1,
    });
    material.name = key;
    this.apply(key, material);
    this.cache.set(key, material);
    this.keys.set(material, key);
    return material;
  }

  /** Metres per texture repeat for world-space UVs. */
  tile(key: MaterialKey): number {
    return SPECS[key].tile ?? 1;
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
      if (key === undefined || !SPECS[key].textures || geometry.userData.worldUVs || !geometry.getAttribute('normal')) return;
      object.getWorldScale(tmpScale);
      applyWorldUVs(geometry, this.tile(key), (tmpScale.x + tmpScale.y + tmpScale.z) / 3);
    });
  }

  private apply(key: MaterialKey, material: THREE.MeshStandardMaterial): void {
    const spec = SPECS[key];
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
