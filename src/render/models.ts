import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { isMaterialKey, type MaterialKey, type MaterialLibrary } from '../world/materials';

/**
 * Loads a model library exported by tools/blender: each top-level node is one model, found by
 * its name. Returns an empty map if the file can't be loaded, so callers can fall back.
 */
export async function loadModels(file: string): Promise<Map<string, THREE.Object3D>> {
  const models = new Map<string, THREE.Object3D>();
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/${file}`);
    for (const child of [...gltf.scene.children]) models.set(child.name, child);
  } catch (error) {
    console.warn(`Models "${file}" didn't load; keeping the primitive stand-ins.`, error);
  }
  return models;
}

/**
 * A copy of a model wearing the game's own materials: each mesh's Blender material name is a
 * MaterialLibrary key, and `swap` can redirect one (a tool's `tier` part to its metal).
 */
export function dress(
  model: THREE.Object3D,
  materials: MaterialLibrary,
  swap: Partial<Record<string, MaterialKey>> = {},
): THREE.Object3D {
  const copy = model.clone(true);
  copy.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const name = (object.material as THREE.Material).name;
    const key = swap[name] ?? (isMaterialKey(name) ? name : 'metal');
    object.material = materials.get(key);
    object.castShadow = true;
    object.receiveShadow = true;
  });
  materials.fit(copy);
  return copy;
}
