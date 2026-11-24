// Layered architectural meshes keep their original topology and UVs. The baked
// field lives in the model's registered world coordinates and covers large faces.
import * as T from './lib/three.module.min.js';

const cache = new Map();

async function readVolume(url, expectedVersion) {
 const response = await fetch(url);
 if (!response.ok) throw Error('Project lighting is unavailable');
 let bytes = new Uint8Array(await response.arrayBuffer());
 if (bytes[0] === 31 && bytes[1] === 139) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  bytes = new Uint8Array(await new Response(stream).arrayBuffer());
 }
 const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 if (bytes.length < 60 || header.getUint32(0) !== 0x49505631) throw Error('Invalid project lighting');
 const size = [4,6,8].map(i=>header.getUint16(i,true));
 const origin = [12,16,20].map(i=>header.getFloat32(i,true));
 const step = header.getFloat32(24,true);
 const version = Array.from(bytes.subarray(28,60), b=>b.toString(16).padStart(2,'0')).join('');
 if (!/^[0-9a-f]{10,64}$/i.test(expectedVersion) || !version.startsWith(expectedVersion.toLowerCase())) {
  throw Error('Lighting does not match the selected model');
 }
 const [width,height,depth] = size;
 if (!width || !height || !depth || Math.max(...size)>256 || !origin.every(Number.isFinite) ||
     !Number.isFinite(step) || step<=0 || 60+4*width*height*depth!==bytes.length) {
  throw Error('Invalid project lighting dimensions');
 }
 const data = bytes.subarray(60);
 const texture = new T.Data3DTexture(data,width,height,depth);
 texture.format=T.RGBAFormat;
 texture.type=T.UnsignedByteType;
 texture.minFilter=texture.magFilter=T.LinearFilter;
 texture.unpackAlignment=1;
 texture.generateMipmaps=false;
 texture.needsUpdate=true;
 texture.userData.viewerShared=true;
 return {texture,data,size,origin,step,version,strength:{value:1}};
}

export function loadProjectLightVolume(url, expectedVersion) {
 const key = url+'|'+expectedVersion;
 if (!cache.has(key)) {
  const request = readVolume(url, expectedVersion).catch(error=>{
   cache.delete(key);
   throw error;
  });
  cache.set(key,request);
 }
 return cache.get(key);
}

// Directional irradiance uses one average and three signed first-order terms.
// The normal is computed in the fragment stage, including flat-shaded GLBs.
const vertexInterface = 'varying vec3 vProjectProbeWorld;\n';
const fragmentInterface = `
uniform highp sampler3D projectProbes;
uniform vec3 projectProbeOrigin;
uniform vec3 projectProbeSize;
uniform float projectProbeStep;
uniform float projectProbeStrength;
varying vec3 vProjectProbeWorld;
`;
const shade = `
 vec3 probeNormal = inverseTransformDirection(normal, viewMatrix);
 vec3 probeIndex = (vProjectProbeWorld-projectProbeOrigin)/projectProbeStep + 0.62*probeNormal;
 vec4 probe = texture(projectProbes,(probeIndex+vec3(.5))/projectProbeSize);
 float probeVisibility = clamp(probe.r + dot(probe.gba-vec3(128./255.),probeNormal),0.,1.);
 float diffuseVisibility = mix(.32,1.,probeVisibility);
 reflectedLight.indirectDiffuse *= mix(1.,diffuseVisibility,projectProbeStrength);
 reflectedLight.indirectSpecular *= mix(1.,mix(.82,1.,probeVisibility),projectProbeStrength);
`;

export function applyProjectLightVolume(root, volume) {
 const materials = new Set();
 root.traverse(mesh=>{
  if (!mesh.isMesh) return;
  mesh.geometry.userData.proposalLighting=true;
  for (const material of [].concat(mesh.material)) {
   if (material?.isMeshStandardMaterial) materials.add(material);
  }
 });
 const origin = {value:new T.Vector3(...volume.origin)};
 const size = {value:new T.Vector3(...volume.size)};
 for (const material of materials) {
  if (material.userData.projectProbeVersion===volume.version) continue;
  const previousCompile=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey();
  material.userData.projectProbeVersion=volume.version;
  material.customProgramCacheKey=()=>previousKey+'|project-probes-1';
  material.onBeforeCompile=function(shader, renderer) {
   previousCompile.call(this,shader,renderer);
   shader.uniforms.projectProbes={value:volume.texture};
   shader.uniforms.projectProbeOrigin=origin;
   shader.uniforms.projectProbeSize=size;
   shader.uniforms.projectProbeStep={value:volume.step};
   shader.uniforms.projectProbeStrength=volume.strength;
   shader.vertexShader=vertexInterface+shader.vertexShader.replace('#include <project_vertex>',
    '#include <project_vertex>\nvProjectProbeWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=fragmentInterface+shader.fragmentShader.replace('#include <aomap_fragment>',
    '#include <aomap_fragment>\n'+shade);
  };
  material.needsUpdate=true;
 }
}
