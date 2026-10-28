import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { AirPass, type AirLight, type AirSettings } from './air-pass';
import { GRADES, GradePass, type GradeName } from './grade-pass';

export type Quality = 'low' | 'medium' | 'high';

interface QualitySettings {
  pixelRatio: number;
  shadowMapSize: number;
  ao: boolean;
  bloom: boolean;
  smaa: boolean;
}

const QUALITY: Record<Quality, QualitySettings> = {
  low: { pixelRatio: 0.75, shadowMapSize: 512, ao: false, bloom: true, smaa: false },
  medium: { pixelRatio: 1, shadowMapSize: 1024, ao: false, bloom: true, smaa: true },
  high: { pixelRatio: 1.5, shadowMapSize: 2048, ao: true, bloom: true, smaa: true },
};

/** Draws the scene and remembers which target it went into, so later passes can read its depth. */
class ScenePass extends RenderPass {
  target: THREE.WebGLRenderTarget | null = null;

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    this.target = readBuffer;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

/**
 * WebGL renderer plus the post-processing chain: scene, lit air, AO, viewmodel, bloom,
 * tone mapping, SMAA, then the colour grade.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly scenePass: ScenePass;
  private readonly air: AirPass;
  private readonly gtao: GTAOPass;
  private readonly bloom: UnrealBloomPass;
  private readonly smaa: SMAAPass;
  private readonly grade: GradePass;
  private settings: QualitySettings = QUALITY.medium;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.toneMapping = THREE.AgXToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    // The composer renders several passes per frame; reset stats once per frame instead.
    this.gl.info.autoReset = false;

    // Both of the composer's targets carry a depth texture (the second is a clone), so the air
    // pass can read the scene's depth whichever one the scene landed in.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
    this.composer = new EffectComposer(this.gl, target);
    this.scenePass = new ScenePass(scene, camera);
    this.air = new AirPass(camera, () => this.scenePass.target?.depthTexture ?? null);
    this.gtao = new GTAOPass(scene, camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.9);
    this.smaa = new SMAAPass();
    this.grade = new GradePass();

    // The air pass reads the scene's depth, so it runs before anything draws into that target again.
    this.composer.addPass(this.scenePass);
    this.composer.addPass(this.air);
    this.composer.addPass(this.gtao);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.smaa);
    this.composer.addPass(this.grade);

    this.setAtmosphere({ scatter: 0 }, 0, 'dungeon');
    this.setQuality('medium');
    window.addEventListener('resize', () => this.resize());
  }

  get info(): THREE.WebGLInfo {
    return this.gl.info;
  }

  setQuality(quality: Quality): void {
    this.settings = QUALITY[quality];
    this.gtao.enabled = this.settings.ao;
    this.bloom.enabled = this.settings.bloom;
    this.smaa.enabled = this.settings.smaa;
    this.applyShadowSize(this.scene);
    this.resize();
  }

  /** The area's air and grade. */
  setAtmosphere(air: AirSettings, fogDensity: number, grade: GradeName): void {
    this.air.configure(air, fogDensity);
    this.grade.set(GRADES[grade]);
  }

  /** The lamps lighting the air this frame, nearest first. */
  setAirLights(lights: readonly AirLight[]): void {
    this.air.setLights(lights);
  }

  /** Re-applies the shadow map size to every shadow-casting light in the scene. */
  applyShadowSize(root: THREE.Object3D): void {
    const size = this.settings.shadowMapSize;
    root.traverse((object) => {
      const isShadowLight =
        object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight || object instanceof THREE.PointLight;
      if (!isShadowLight || !object.castShadow) return;
      // Point lights render six faces, so they get half the resolution.
      const target = object instanceof THREE.PointLight ? size / 2 : size;
      if (object.shadow.mapSize.x !== target) {
        object.shadow.mapSize.set(target, target);
        object.shadow.map?.dispose();
        object.shadow.map = null;
      }
    });
  }

  setExposure(exposure: number): void {
    this.gl.toneMappingExposure = exposure;
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio, 2) * this.settings.pixelRatio;
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(width, height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.bloom.resolution.set(width / 2, height / 2);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.gl.info.reset();
    this.composer.render();
  }

  /**
   * Draws a second scene on top with a cleared depth buffer: the first-person
   * viewmodel, so held tools never clip into walls. It goes in after the air and AO.
   */
  setOverlay(scene: THREE.Scene, camera: THREE.Camera): void {
    const pass = new RenderPass(scene, camera);
    pass.clear = false;
    pass.clearDepth = true;
    this.composer.insertPass(pass, 3);
  }
}
