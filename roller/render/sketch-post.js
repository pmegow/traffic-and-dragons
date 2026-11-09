// Opt-in image-space drawing pass. Materials provide tone/ink/coverage, never screen-space lines.
import * as THREE from 'three';
import { FINISHES } from './finish-table.js';
import { POST_VERTEX, POST_FRAGMENT, installPostCapture } from './sketch-post-shader.js';
const PIXEL_BUDGET = 1500000;
export class SketchPostprocess {
  constructor(renderer) {
    if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('Post-process hatching needs floating-point render targets. Use the surface-hatching comparison on this device.');
    this.materials = new Map();
    this.target = new THREE.WebGLRenderTarget(1, 1, { count: 3, type: THREE.HalfFloatType, depthBuffer: true });
    this.size = new THREE.Vector2();
    this.cssSize = new THREE.Vector2();
    this.pass = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 1 }, uBeauty: { value: this.target.textures[0] }, uData: { value: this.target.textures[1] }, uInk: { value: this.target.textures[2] }, uCssSize: { value: this.cssSize } },
      vertexShader: POST_VERTEX, fragmentShader: POST_FRAGMENT, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.screen = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.pass);
    this.quad.frustumCulled = false;
    this.screen.add(this.quad);
    this.camera = new THREE.Camera();
    this.active = false;
  }
  prepare(view) {
    const owners = new Map();
    const own = (root, die) => root.traverse(o => owners.set(o, die));
    for (const d of view.dice) own(d.mesh, d);
    for (const r of view.exiting) { own(r.die.mesh, r.die); own(r.effects, r.die); }
    let active = false;
    view.scene.traverse(o => {
      if (!o.material) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        const owner = owners.get(o), source = owner?.mesh.material.userData.dice || m.userData.dice;
        const spec = FINISHES[source?.finish]?.sketch;
        const profile = owner?.mesh.userData.inkProfile === o;
        const eligible = !!spec && !profile;
        if (eligible && o.visible) active = true;
        let record = this.materials.get(m);
        if (!record) {
          const uniforms = { uPostOwned: { value: 0 }, uPostBold: { value: 0 }, uPostInk: { value: new THREE.Color() } };
          const restore = installPostCapture(m, uniforms, () => this.materials.delete(m));
          record = { uniforms, restore };
          this.materials.set(m, record);
        }
        record.uniforms.uPostOwned.value = eligible ? 1 : 0;
        record.uniforms.uPostBold.value = spec?.inkStyle || 0;
        if (source) record.uniforms.uPostInk.value.copy(source.uniforms.uInk.value);
        if (m.userData.dice?.uniforms.uSketchPost) m.userData.dice.uniforms.uSketchPost.value = 1;
      }
    });
    this.active = active;
    return active;
  }
  render(view) {
    const r = view.renderer;
    if (!this.prepare(view)) { r.render(view.scene, view.camera); return; }
    r.getDrawingBufferSize(this.size);
    r.getSize(this.cssSize);
    const scale = Math.min(1, Math.sqrt(PIXEL_BUDGET / (this.size.x * this.size.y)));
    const width = Math.max(1, Math.floor(this.size.x * scale)), height = Math.max(1, Math.floor(this.size.y * scale));
    if (this.target.width !== width || this.target.height !== height) this.target.setSize(width, height);
    const target = r.getRenderTarget();
    try {
      r.setRenderTarget(this.target);
      r.render(view.scene, view.camera);
      r.setRenderTarget(target);
      r.render(this.screen, this.camera);
    } finally { r.setRenderTarget(target); }
  }
  dispose() {
    for (const r of this.materials.values()) r.restore();
    this.materials.clear(); this.target.dispose(); this.quad.geometry.dispose(); this.pass.dispose();
  }
}
