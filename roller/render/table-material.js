// One physical tabletop material for the visible floor and its indirect-light capture.
import * as THREE from 'three';
import { SPECULAR } from './finish-table.js';
import { patternUniforms, injectPattern } from './patterns.js';
export function tableMaterial(look, environment) {
  const uniforms = patternUniforms(THREE, {pattern:look.pattern,base:look.color});
  const material = new THREE.MeshPhysicalMaterial({color:look.color,roughness:look.roughness ?? 0.95,
    metalness:look.metalness ?? 0,anisotropy:look.anisotropy ?? 0,specularIntensity:SPECULAR,
    envMap:environment.texture,envMapIntensity:environment.intensity});
  material.onBeforeCompile = shader => injectPattern(shader,uniforms,'world');
  material.customProgramCacheKey = () => 'tray-pattern';
  return material;
}
