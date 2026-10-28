import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

/** Lamps whose glow the air carries at once: the nearest ones win. */
export const MAX_AIR_LIGHTS = 12;

/** How an area's air holds light. */
export interface AirSettings {
  /** How much lamplight the air catches. 0 is clear air; the dungeon sits around 0.02. */
  scatter: number;
  /** Mist pooled low: its colour, density at the floor, and how fast it thins upward (per metre). */
  mist?: { color: number; density: number; floor: number; falloff: number };
}

export interface AirLight {
  position: THREE.Vector3;
  /** Linear colour already multiplied by intensity and visibility. */
  color: THREE.Color;
  range: number;
}

/**
 * Light hanging in the air: every nearby lamp lights the fog around it, so a lamp across a
 * cavern reads as a warm sphere of lit air, and low mist pools in the hollows. Runs on the
 * scene's depth in linear HDR, before bloom.
 *
 * Each lamp's in-scattering is the closed-form integral of inverse-square light along the view
 * ray (no ray marching), clipped to the lamp's range and to the first surface behind it.
 */
export class AirPass extends Pass {
  private readonly quad: FullScreenQuad;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions = Array.from({ length: MAX_AIR_LIGHTS }, () => new THREE.Vector3());
  private readonly colors = Array.from({ length: MAX_AIR_LIGHTS }, () => new THREE.Vector3());
  private readonly ranges = new Float32Array(MAX_AIR_LIGHTS);

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    /** The depth of the target the scene was drawn into this frame. */
    private readonly depth: () => THREE.DepthTexture | null,
  ) {
    super();
    this.material = new THREE.ShaderMaterial({
      defines: { MAX_LIGHTS: MAX_AIR_LIGHTS },
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        projectionInverse: { value: new THREE.Matrix4() },
        cameraWorld: { value: new THREE.Matrix4() },
        cameraPos: { value: new THREE.Vector3() },
        scatter: { value: 0 },
        fogDensity: { value: 0 },
        lightPos: { value: this.positions },
        lightColor: { value: this.colors },
        lightRange: { value: this.ranges },
        lightCount: { value: 0 },
        mistColor: { value: new THREE.Color() },
        mistDensity: { value: 0 },
        mistFloor: { value: 0 },
        mistFalloff: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform mat4 projectionInverse;
        uniform mat4 cameraWorld;
        uniform vec3 cameraPos;
        uniform float scatter;
        uniform float fogDensity;
        uniform vec3 lightPos[MAX_LIGHTS];
        uniform vec3 lightColor[MAX_LIGHTS];
        uniform float lightRange[MAX_LIGHTS];
        uniform int lightCount;
        uniform vec3 mistColor;
        uniform float mistDensity;
        uniform float mistFloor;
        uniform float mistFalloff;
        varying vec2 vUv;

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          float depth = texture2D(tDepth, vUv).x;
          vec4 view = projectionInverse * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          view /= view.w;
          vec3 world = (cameraWorld * vec4(view.xyz, 1.0)).xyz;
          vec3 ray = world - cameraPos;
          float tMax = length(ray);
          vec3 dir = ray / max(tMax, 1e-4);
          tMax = min(tMax, 90.0);

          vec3 inscatter = vec3(0.0);
          for (int i = 0; i < MAX_LIGHTS; i++) {
            if (i >= lightCount) break;
            vec3 rel = cameraPos - lightPos[i];
            float b = dot(dir, rel);
            float h2 = max(dot(rel, rel) - b * b, 0.0225);
            float r = lightRange[i];
            float disc = r * r - h2;
            if (disc <= 0.0) continue;
            float q = sqrt(disc);
            // The lit stretch of the ray: inside the lamp's reach, past the lens, before the wall.
            float s0 = max(-b - q, 0.3);
            float s1 = min(-b + q, tMax);
            if (s1 <= s0) continue;
            float h = sqrt(h2);
            // Inverse-square light integrated along the ray, minus its value at the edge of the
            // lamp's reach so the glow fades to nothing there instead of stopping at a sphere.
            float lit = (atan((s1 + b) / h) - atan((s0 + b) / h)) / h - (s1 - s0) / (r * r);
            // The fog between you and the lamp swallows its glow like it swallows the lamp.
            float near = clamp(-b, s0, s1) * fogDensity;
            inscatter += lightColor[i] * max(lit, 0.0) * exp(-near * near);
          }
          vec3 color = base.rgb + inscatter * scatter;

          if (mistDensity > 0.0) {
            // Exponential height fog, integrated in closed form along the ray.
            float dy = dir.y * tMax;
            float k = mistFalloff;
            float start = mistDensity * exp(-k * (cameraPos.y - mistFloor));
            float amount = abs(dy) > 1e-3 ? start * (1.0 - exp(-k * dy)) / (k * dir.y) : start * tMax;
            color = mix(color, mistColor, 1.0 - exp(-max(amount, 0.0)));
          }
          gl_FragColor = vec4(color, base.a);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  /** The area's air, and the scene fog density that dims far glows. */
  configure(air: AirSettings, fogDensity: number): void {
    const u = this.material.uniforms;
    u.scatter.value = air.scatter;
    u.fogDensity.value = fogDensity;
    u.mistDensity.value = air.mist?.density ?? 0;
    if (air.mist) {
      (u.mistColor.value as THREE.Color).set(air.mist.color);
      u.mistFloor.value = air.mist.floor;
      u.mistFalloff.value = air.mist.falloff;
    }
  }

  setLights(lights: readonly AirLight[]): void {
    const count = Math.min(lights.length, MAX_AIR_LIGHTS);
    for (let i = 0; i < count; i++) {
      const light = lights[i];
      if (!light) continue;
      this.positions[i]?.copy(light.position);
      this.colors[i]?.set(light.color.r, light.color.g, light.color.b);
      this.ranges[i] = light.range;
    }
    this.material.uniforms.lightCount.value = count;
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = this.depth();
    (u.projectionInverse.value as THREE.Matrix4).copy(this.camera.projectionMatrixInverse);
    (u.cameraWorld.value as THREE.Matrix4).copy(this.camera.matrixWorld);
    (u.cameraPos.value as THREE.Vector3).setFromMatrixPosition(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
