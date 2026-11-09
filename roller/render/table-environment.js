// Single-bounce image-based lighting: the actual table replaces the room's lower hemisphere.
// Capture only when appearance changes, never per animation frame. No dice in this scene means
// no recursive lighting, self-reflections or transient exit effects baked into the environment.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LIGHTS } from './lights.js';
import { tableMaterial } from './table-material.js';
export class TableEnvironment {
  constructor(renderer,intensity) {
    this.renderer=renderer;
    this.generator=new THREE.PMREMGenerator(renderer);
    const room=new RoomEnvironment();
    try { this.baseTarget=this.generator.fromScene(room,0.04); } finally { room.dispose(); }
    this.base={texture:this.baseTarget.texture,intensity};
    this.capture=new THREE.Scene();
    this.capture.background=this.base.texture;
    this.capture.backgroundIntensity=intensity;
    for(const spec of LIGHTS) {
      const light=new THREE.DirectionalLight(spec.color,spec.intensity);
      light.position.set(spec.side*0.8,spec.up*0.8,spec.toward*0.8);
      this.capture.add(light,light.target);
    }
    const geometry=new THREE.PlaneGeometry(40,40);
    geometry.rotateX(-Math.PI/2);
    this.floor=new THREE.Mesh(geometry);
    this.capture.add(this.floor);
    this.key=null;this.target=null;this.updates=0;
  }
  update(look) {
    if(!look) return this.base;
    const key=JSON.stringify(look);
    if(key!==this.key) {
      const material=tableMaterial(look,this.base),oldMaterial=this.floor.material;
      this.floor.material=material;
      let target;
      try {
        // A local probe at dice-center height above the effectively infinite plane. The source
        // room is already at its configured intensity; scaling this result again would dim
        // the bounced direct light twice. PMREM retains linear HDR radiance and filters by
        // material roughness for both diffuse and specular IBL.
        target=this.generator.fromScene(this.capture,0.04,0.001,100,{size:256,position:new THREE.Vector3(0,0.02,0)});
      } catch(error) { this.floor.material=oldMaterial;material.dispose();throw error; }
      oldMaterial.dispose();
      this.target?.dispose();this.target=target;this.key=key;this.updates++;
    }
    return {texture:this.target.texture,intensity:1};
  }
  dispose() {
    this.floor.geometry.dispose();this.floor.material.dispose();
    this.target?.dispose();this.baseTarget.dispose();this.generator.dispose();
  }
}
