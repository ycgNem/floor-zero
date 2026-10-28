import * as THREE from 'three';

export interface SkyOptions {
  /** Linear HDR colours, straight into the scene before tone mapping. */
  zenith: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  /** Glow hugging the horizon: dawn light, or a town's lamps on the haze. */
  glow: THREE.ColorRepresentation;
  /** Toward the sun, or wherever the glow gathers. */
  glowDir: THREE.Vector3;
}

/**
 * A gradient sky dome: deep at the zenith, paler toward the horizon, with a glow gathered on one
 * side. Drawn first and behind everything, without fog, so the sky never reads as flat fog colour.
 */
export function skyDome(o: SkyOptions): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color(o.zenith) },
      horizon: { value: new THREE.Color(o.horizon) },
      glow: { value: new THREE.Color(o.glow) },
      glowDir: { value: o.glowDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 glow;
      uniform vec3 glowDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(horizon, zenith, pow(up, 0.55));
        float toward = max(dot(d, glowDir), 0.0);
        c += glow * pow(toward, 6.0) * (1.0 - up * 0.7);
        c += glow * 0.35 * pow(1.0 - up, 6.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}
