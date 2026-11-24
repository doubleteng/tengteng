// The visibility bake stores one normalized byte per referenced vertex in mesh order.
// It modulates indirect light only. The sun and its shadow map stay fully dynamic.
import * as T from './lib/three.module.min.js';

async function readBake(url) {
 const response = await fetch(url);
 if (!response.ok) throw Error('District light data unavailable');
 let bytes = new Uint8Array(await response.arrayBuffer());
 // Some hosts already apply Content-Encoding to files ending in .gz.
 if (bytes[0] === 31 && bytes[1] === 139) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  bytes = new Uint8Array(await new Response(stream).arrayBuffer());
 }
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 if (view.getUint32(0) !== 0x49444131) throw Error('Invalid district light data');
 const entries = new Map(), count = view.getUint32(4, true);
 let offset = 8;
 for (let i = 0; i < count; i++) {
  const mesh = view.getUint32(offset, true), primitive = view.getUint32(offset+4, true);
  const size = view.getUint32(offset+8, true);
  offset += 12;
  if (size > bytes.length-offset) throw Error('Incomplete district light data');
  entries.set(mesh+'/'+primitive, bytes.subarray(offset, offset+size));
  offset += size;
 }
 return entries;
}

export async function loadDistrict(loader, url) {
 const [asset, entries] = await Promise.all([
  loader.loadAsync(url), readBake(url.replace(/\.glb$/, '.ambient.gz')).catch(() => null)
 ]);
 if (entries) asset.scene.traverse(node => {
  if (!node.isMesh) return;
  const id = asset.parser.associations.get(node);
  const values = entries.get(id?.meshes+'/'+id?.primitives);
  if (values?.length === node.geometry.getAttribute('position').count)
   node.geometry.setAttribute('districtAmbient', new T.BufferAttribute(values, 1, true));
 });
 return asset.scene;
}

export function applyDistrictLight(material, glazing) {
 if (!material.isMeshStandardMaterial || material.userData.districtAmbient) return;
 material.userData.districtAmbient = true;
 material.userData.districtGlass = glazing;
 material.defaultAttributeValues = {...material.defaultAttributeValues, districtAmbient: [1]};
 material.customProgramCacheKey = () => glazing ? 'district-glass-1' : 'district-matte-1';
 material.onBeforeCompile = shader => {
  shader.vertexShader = 'attribute float districtAmbient; varying float vDistrictAmbient;\n'+shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvDistrictAmbient = districtAmbient;');
  shader.fragmentShader = 'varying float vDistrictAmbient;\n'+shader.fragmentShader;
  const sky = glazing ? `
   vec3 reflectedWorld = inverseTransformDirection(reflect(-geometryViewDir, normal), viewMatrix);
   float skyVisibility = smoothstep(-.15, .65, reflectedWorld.y);
   float grazing = 1.0-clamp(dot(geometryViewDir,normal),0.0,1.0);
   vec3 skyColor = mix(vec3(.20,.22,.20), vec3(.61,.75,.86), skyVisibility);
   reflectedLight.indirectSpecular += skyColor*(.045+.20*grazing*grazing*grazing)*vDistrictAmbient;` : '';
  shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>',
   '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vDistrictAmbient;'+sky);
 };
}
