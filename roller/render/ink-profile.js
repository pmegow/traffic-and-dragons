// A back-face shell supplies a consistent screen-width silhouette around inked dice.
// It shares the die's geometry and exit uniforms, but owns/disposes only its own material.
import * as THREE from 'three';
import { FINISHES } from './finish-table.js';
import { EXIT_OUTGOING } from './exit-shader.js';
const KEY = 'inkProfile';
export function disposeInkProfile(mesh) {
  const profile = mesh.userData[KEY];
  if (!profile) return;
  mesh.remove(profile);
  profile.material.dispose();
  delete mesh.userData[KEY];
}
export function updateInkProfile(mesh, renderer) {
  const source = mesh.material, width = FINISHES[source.userData.dice?.finish]?.profileWidth || 0;
  let profile = mesh.userData[KEY];
  if (profile && (profile.userData.source !== source || !width)) { disposeInkProfile(mesh); profile = null; }
  if (!width) return;
  if (!profile) {
    const material = source.clone();
    // PhysicalMaterial.copy does not carry these custom shader inputs (notably USE_UV).
    material.defines = { ...source.defines };
    material.defaultAttributeValues = source.defaultAttributeValues;
    const viewport = { value: new THREE.Vector2() };
    material.side = THREE.BackSide;
    material.userData = source.userData;
    material.onBeforeCompile = (shader) => {
      source.onBeforeCompile(shader);
      shader.uniforms.uProfileViewport = viewport;
      shader.uniforms.uProfileWidth = { value: width };
      if (!shader.vertexShader.includes('#include <project_vertex>') || !shader.fragmentShader.includes(EXIT_OUTGOING)) throw new Error('Ink profile: shader hook missing');
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec2 uProfileViewport; uniform float uProfileWidth;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec3 profileNormal = normalize(normalMatrix * objectNormal);
          vec4 profileTip = projectionMatrix * vec4(mvPosition.xyz + profileNormal * 0.001, 1.0);
          vec2 profileDirection = (profileTip.xy / profileTip.w - gl_Position.xy / gl_Position.w) * uProfileViewport;
          float profileLength = length(profileDirection);
          if (profileLength > 1e-7) gl_Position.xy += (profileDirection / profileLength) * (2.0 * uProfileWidth / uProfileViewport) * gl_Position.w;
        `);
      // Keep the same dissolve, clipping and exit color effects after applying the solid ink.
      shader.fragmentShader = shader.fragmentShader.replace(EXIT_OUTGOING, 'outgoingLight = uInk;\n' + EXIT_OUTGOING);
    };
    material.customProgramCacheKey = () => source.customProgramCacheKey() + '-ink-profile';
    profile = new THREE.Mesh(mesh.geometry, material);
    profile.name = 'Ink profile';
    profile.frustumCulled = mesh.frustumCulled;
    profile.userData.source = source;
    profile.userData.viewport = viewport;
    profile.raycast = () => {}; // the outline never intercepts picking or dragging the actual die
    profile.castShadow = false; // the existing shadow remains the actual die's shape
    mesh.userData[KEY] = profile;
    mesh.add(profile);
  }
  renderer.getSize(profile.userData.viewport.value);
  profile.material.opacity = source.opacity;
  if (profile.material.transparent !== source.transparent) {
    profile.material.transparent = source.transparent;
    profile.material.needsUpdate = true;
  }
  profile.material.depthWrite = source.depthWrite;
  profile.visible = source.visible;
}
