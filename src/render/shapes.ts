import * as THREE from 'three';

export type Vec3 = [number, number, number];

/** A tube along a curve that tapers to a point: horns, tails. */
export function taperedTube(points: Vec3[], r0: number, r1: number, segments = 18, radial = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.85));
    const n = frames.normals[i] as THREE.Vector3;
    const bn = frames.binormals[i] as THREE.Vector3;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      positions.push(p.x + c * n.x + s * bn.x, p.y + c * n.y + s * bn.y, p.z + c * n.z + s * bn.z);
    }
  }
  const tip = curve.getPointAt(1);
  positions.push(tip.x, tip.y, tip.z);
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const bb = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, bb, c, bb, d, c);
    }
  }
  const last = segments * radial;
  const tipIndex = (segments + 1) * radial;
  for (let j = 0; j < radial; j++) indices.push(last + j, last + ((j + 1) % radial), tipIndex);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Flips a geometry inside out, for surfaces seen from within (a basin wall, a shaft). */
export function insideOut(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geometry.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1] as number;
      a[i + 1] = a[i + 2] as number;
      a[i + 2] = t;
    }
    index.needsUpdate = true;
  }
  const normal = geometry.getAttribute('normal');
  if (normal) {
    for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
    normal.needsUpdate = true;
  }
  return geometry;
}
