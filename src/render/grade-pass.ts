import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

/** A colour grade in display space, after tone mapping. Doc 12: it supports the lighting, never fixes it. */
export interface Grade {
  /** Colour added to the shadows, so black reads as deep cold blue rather than nothing. */
  lift: number;
  /** Tint over the highlights. */
  gain: number;
  /** How hard the soft S-curve pulls, 0 to 1. */
  contrast: number;
  saturation: number;
  vignette: number;
  /** Film grain, which also hides banding in dark fog. */
  grain: number;
}

export const GRADES = {
  /** Underground: cool lifted shadows, lamplight kept warm. */
  dungeon: { lift: 0x070b14, gain: 0xfff0dc, contrast: 0.32, saturation: 1.02, vignette: 0.42, grain: 0.035 },
  /** Bellwether: warmer all through, a little softer. */
  town: { lift: 0x0a0b12, gain: 0xfff2e0, contrast: 0.24, saturation: 1.06, vignette: 0.32, grain: 0.03 },
  /** The drowned cathedral: teal in the shadows. */
  pool: { lift: 0x05100f, gain: 0xf4fbff, contrast: 0.3, saturation: 1.0, vignette: 0.42, grain: 0.035 },
} as const satisfies Record<string, Grade>;

export type GradeName = keyof typeof GRADES;

export class GradePass extends Pass {
  private readonly quad: FullScreenQuad;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        lift: { value: new THREE.Color() },
        gain: { value: new THREE.Color() },
        contrast: { value: 0 },
        saturation: { value: 1 },
        vignette: { value: 0 },
        grain: { value: 0 },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec3 lift;
        uniform vec3 gain;
        uniform float contrast;
        uniform float saturation;
        uniform float vignette;
        uniform float grain;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        float hash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          const vec3 W = vec3(0.2126, 0.7152, 0.0722);
          // A soft S-curve: richer mid-tones without crushing either end.
          vec3 curve = c * c * (3.0 - 2.0 * c);
          c = mix(c, curve, contrast);
          float l = dot(c, W);
          // Split tone: warm the highlights, then lift the shadows to a colour.
          c *= mix(vec3(1.0), gain, smoothstep(0.2, 0.9, l));
          c += lift * (1.0 - smoothstep(0.0, 0.45, l));
          c = mix(vec3(dot(c, W)), c, saturation);
          vec2 d = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
          c *= 1.0 - vignette * smoothstep(0.3, 1.05, length(d));
          float n = hash(vUv * resolution + fract(time * 0.618) * 917.0) - 0.5;
          c += n * grain * (1.0 - 0.6 * l);
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  set(grade: Grade): void {
    const u = this.material.uniforms;
    // The colours are display-space values, so they go in as written, without linearising.
    (u.lift.value as THREE.Color).setHex(grade.lift, THREE.LinearSRGBColorSpace);
    (u.gain.value as THREE.Color).setHex(grade.gain, THREE.LinearSRGBColorSpace);
    u.contrast.value = grade.contrast;
    u.saturation.value = grade.saturation;
    u.vignette.value = grade.vignette;
    u.grain.value = grade.grain;
  }

  override setSize(width: number, height: number): void {
    (this.material.uniforms.resolution.value as THREE.Vector2).set(width, height);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    // A new grain pattern every frame.
    u.time.value = ((u.time.value as number) + 1) % 4096;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
