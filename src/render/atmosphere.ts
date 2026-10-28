import * as THREE from 'three';

const DUST_COUNT = 700;
const DUST_BOX = 14;

/**
 * Motes drifting in the air around the camera. Positions wrap inside a box that follows the
 * camera in the vertex shader, so the field is endless and costs nothing on the CPU.
 */
export class Dust {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    const positions = new Float32Array(DUST_COUNT * 3);
    const seeds = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = Math.random() * DUST_BOX;
      positions[i * 3 + 1] = Math.random() * DUST_BOX;
      positions[i * 3 + 2] = Math.random() * DUST_BOX;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        camPos: { value: new THREE.Vector3() },
        scale: { value: 500 },
        color: { value: new THREE.Color(0xffd6a8) },
        opacity: { value: 0.5 },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        uniform vec3 camPos;
        uniform float scale;
        uniform float opacity;
        attribute float seed;
        varying float vAlpha;
        void main() {
          vec3 p = position + vec3(
            sin(time * 0.13 + seed * 6.28) * 0.7,
            time * (0.04 + 0.05 * seed),
            cos(time * 0.11 + seed * 3.1) * 0.7);
          p = mod(p - camPos + ${(DUST_BOX / 2).toFixed(1)}, ${DUST_BOX.toFixed(1)}) - ${(DUST_BOX / 2).toFixed(1)} + camPos;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = length(mv.xyz);
          // Visible in the lantern's reach, never as blobs on the lens, and no popping at the box edge.
          vAlpha = opacity * smoothstep(0.5, 1.6, d) * (1.0 - smoothstep(3.0, ${(DUST_BOX * 0.48).toFixed(1)}, d));
          vAlpha *= 0.55 + 0.45 * sin(time * (0.6 + seed) + seed * 40.0);
          gl_PointSize = max(1.0, (0.014 + 0.016 * seed) * scale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = 1.0 - dot(c, c) * 4.0;
          if (a <= 0.0) discard;
          a *= a * vAlpha;
          gl_FragColor = vec4(color * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  set(o: { visible: boolean; color?: number; opacity?: number }): void {
    this.points.visible = o.visible;
    if (o.color !== undefined) (this.material.uniforms.color.value as THREE.Color).set(o.color);
    if (o.opacity !== undefined) this.material.uniforms.opacity.value = o.opacity;
  }

  update(time: number, camera: THREE.PerspectiveCamera, viewportHeight: number): void {
    if (!this.points.visible) return;
    this.material.uniforms.time.value = time;
    (this.material.uniforms.camPos.value as THREE.Vector3).copy(camera.position);
    this.material.uniforms.scale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}

let coneMaterial: THREE.ShaderMaterial | null = null;

/** Soft additive glow, brightest at the top of the mesh and fading at silhouettes and up close. */
function lightConeMaterial(): THREE.ShaderMaterial {
  coneMaterial ??= new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0.07 } },
    vertexShader: /* glsl */ `
      attribute vec3 tint;
      varying float vH;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vTint;
      void main() {
        vH = uv.y;
        vTint = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float strength;
      varying float vH;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vTint;
      void main() {
        float d = length(vView);
        float facing = abs(dot(normalize(vNormal), -vView / d));
        float a = strength * facing * facing * pow(vH, 1.7) * smoothstep(0.6, 2.2, d) * (1.0 - smoothstep(22.0, 42.0, d));
        gl_FragColor = vec4(vTint * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return coneMaterial;
}

/**
 * A fake volumetric cone hanging from a lamp: dusty air catching the light. `top` is the lamp,
 * and the cone widens down to `length` below it.
 */
export function lightCone(top: THREE.Vector3Like, length: number, radius: number, color: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius * 0.12, radius, length, 20, 1, true);
  const tint = new THREE.Color(color);
  const tints = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < tints.length; i += 3) tint.toArray(tints, i);
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
  const mesh = new THREE.Mesh(geometry, lightConeMaterial());
  mesh.position.set(top.x, top.y - length / 2, top.z);
  mesh.renderOrder = 4;
  return mesh;
}
