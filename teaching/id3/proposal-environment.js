// One local daylight panorama for the architectural proposals. Three prefilters
// it once per renderer. The software renderer reads the same panorama as sRGB.
import * as T from './lib/three.module.min.js';

const panoramaUrl = new URL('./models/kerrytown-daylight.webp?v=9e1d115b01', import.meta.url);
let pending;

export function loadProposalEnvironment() {
 if (!pending) {
  pending = new T.TextureLoader().loadAsync(panoramaUrl.href).then(texture => {
   texture.mapping = T.EquirectangularReflectionMapping;
   texture.colorSpace = T.SRGBColorSpace;
   texture.name = 'Kerrytown daylight';
   texture.userData.viewerShared = true;
   const {width,height} = texture.image;
   let pixels;
   return {
    texture, width, height,
    get pixels() {
     if (!pixels) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', {willReadFrequently:true});
      context.drawImage(texture.image,0,0);
      pixels = new Uint8Array(context.getImageData(0,0,width,height).data.buffer);
     }
     return pixels;
    }
   };
  }).catch(error => {
   pending = undefined;
   throw error;
  });
 }
 return pending;
}

function reflectance(material) {
 const finish = material.userData.proposalFinish;
 if (finish === 'glass' || finish === 'frosted' || /glass|glazing/i.test(material.name)) {
  const frosted = finish === 'frosted' || /frosted|translucent|channel/i.test(material.name);
  return ['glass',frosted ? .85 : 1.45];
 }
 if (finish === 'pv' || /photovoltaic|solar cell/i.test(material.name)) return ['metal',1.05];
 if (['zinc','steel'].includes(finish) || material.metalness > .45 ||
     /steel|alumin(?:u|i)um|aluminum|galvaniz|zinc|copper|brass/i.test(material.name)) return ['metal',1.12];
 return ['matte',.26];
}

function glassCoverage(material) {
 // In straight-alpha rasterization, tint only absorbs the transmitted part.
 // Preserve the surface reflection of the glass even where a pane is clear.
 const oldCompile = material.onBeforeCompile;
 const oldKey = material.customProgramCacheKey();
 material.customProgramCacheKey = () => oldKey+'|glass-coverage-v1';
 material.onBeforeCompile = function(shader,renderer) {
  oldCompile.call(this,shader,renderer);
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
   float viewCos = clamp(dot(geometryNormal,geometryViewDir),0.,1.);
   float interfaceReflection = .04 + .96 * pow(1.-viewCos,5.);
   float tintedCoverage = diffuseColor.a;
   diffuseColor.a = tintedCoverage + (1.-tintedCoverage)*interfaceReflection;
   outgoingLight = ((totalDiffuse+totalEmissiveRadiance)*tintedCoverage + totalSpecular)
                    / max(diffuseColor.a,.001);
   #include <opaque_fragment>`);
 };
}

export function applyProposalEnvironment(root,probe) {
 if (!probe) return;
 const visited = new Set();
 root.traverse(object => {
  if (!object.isMesh) return;
  for (const material of [].concat(object.material || [])) {
   if (!material.isMeshStandardMaterial || material.envMap || visited.has(material)) continue;
   visited.add(material);
   const [kind,intensity] = reflectance(material);
   material.envMap = probe.texture;
   const gain = Number.isFinite(material.userData.reflectionGain) ? T.MathUtils.clamp(material.userData.reflectionGain, .2, 3) : 1;
   material.envMapIntensity = intensity * gain;
   material.userData.proposalEnvIntensity = material.envMapIntensity;
   material.userData.proposalReflection = kind;
   if (kind==='glass' && material.transparent && !material.transmission) glassCoverage(material);
   material.needsUpdate = true;
  }
 });
}

let skyTexture;
export function proposalSkyTexture() {
 if (skyTexture) return skyTexture;
 // The visible background is sky only. Reflections use the actual streetscape
 // panorama above, so the browser draws the district's silhouette only once.
 const width=256, height=128, data=new Uint8Array(width*height*4);
 const below=[216,217,211], horizon=[231,233,230], mid=[160,196,221], zenith=[114,158,195];
 for(let y=0;y<height;y++) {
  // DataTexture's first unpacked row maps to v=0 (the lower hemisphere).
  const altitude=Math.sin(Math.PI*((y+.5)/height-.5));
  const a=altitude<0?below:altitude<.5?horizon:mid;
  const b=altitude<0?horizon:altitude<.5?mid:zenith;
  const t=altitude<0?1+altitude:altitude<.5?2*altitude:2*altitude-1;
  for(let x=0;x<width;x++) {
   const i=4*(width*y+x);
   for(let c=0;c<3;c++) data[i+c]=Math.round(a[c]+(b[c]-a[c])*t);
   data[i+3]=255;
  }
 }
 skyTexture=new T.DataTexture(data,width,height,T.RGBAFormat);
 skyTexture.name='Daylight sky';skyTexture.mapping=T.EquirectangularReflectionMapping;
 skyTexture.colorSpace=T.SRGBColorSpace;
 skyTexture.magFilter=T.LinearFilter;skyTexture.minFilter=T.LinearFilter;
 skyTexture.userData.viewerShared=true;skyTexture.needsUpdate=true;
 return skyTexture;
}
