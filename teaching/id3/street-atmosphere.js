import * as T from './lib/three.module.min.js';

const sunBearing=258, sunElevation=13;
const radians=Math.PI/180, mix=T.MathUtils.lerp;

// Elevation in degrees and sRGB values for the sky opposite the setting sun.
const skyStops=[
 [-90,135,127,138],[-5,191,162,164],[0,225,181,171],[4,225,183,180],
 [13,188,167,194],[24,138,167,193],[39,89,161,188],[66,52,133,168],[90,43,113,152]
];

// Each cirrus wisp occupies a limited sweep of the sky. Its tapered body,
// tilt and uneven thickness follow the local wind direction in the panorama.
// Columns give bearing, elevation, angular half-length, thickness and rise.
const wisps=[
 [247,5.9,24,.65,1.3],[276,7.0,16,.8,1.1],[270,10.5,30,1.1,2.5],
 [242,12.4,12,.7,1.6],[296,16.5,21,1.2,1.6],[311,23.6,24,1.1,-2.4],
 [205,22,32,1.4,-3.3],[178,13,21,.9,-1.7],[122,8,24,.8,1.2],
 [76,18,32,1.4,3.4],[53,16.6,13,.7,1.4],[26,28,27,1.6,-3.7],[7,10.0,18,.9,1.8]
];

function skyColumn(bearing) {
 const clouds=[];
 for(const [azimuth,height,length,thickness,rise] of wisps) {
  const t=((bearing-azimuth+540)%360-180)/length;
  if(Math.abs(t)>=1)continue;
  const phase=azimuth*radians, taper=1-t*t;
  const drift=Math.sin(5.4*t+phase)+.36*Math.sin(12.7*t-phase);
  clouds.push({
   height:height+rise*t+thickness*.53*drift,
   width:thickness*(.3+.7*taper)*(.85+.15*Math.cos(8.2*t+phase)),
   opacity:taper*taper*(.25+.09*Math.cos(8.5*t-phase)+.055*Math.sin(17*t+phase))
  });
 }
 return {cosWest:Math.cos((bearing-sunBearing)*radians),clouds};
}

function makePanorama() {
 const width=512,height=256, data=new Uint8Array(width*height*4);
 // Equirectangular U increases from world -X through -Z. setSun measures
 // bearing clockwise from -Z, so the first column looks west (270 degrees).
 const columns=Array.from({length:width},(_,x)=>skyColumn((270+360*(x+.5)/width)%360));
 const sinSun=Math.sin(sunElevation*radians),cosSun=Math.cos(sunElevation*radians);
 let stop=0;
 for(let y=0;y<height;y++) {
  const elevation=180*(y+.5)/height-90;
  while(skyStops[stop+1][0]<elevation)stop++;
  const low=skyStops[stop],high=skyStops[stop+1],t=(elevation-low[0])/(high[0]-low[0]);
  const red=mix(low[1],high[1],t),green=mix(low[2],high[2],t),blue=mix(low[3],high[3],t);
  const sinY=Math.sin(elevation*radians),cosY=Math.cos(elevation*radians);
  const haze=Math.exp(-((elevation-6)**2)/300);
  for(let x=0;x<width;x++) {
   const {cosWest,clouds}=columns[x];
   const west=Math.max(0,cosWest), airLight=.72*west*west*haze;
   let r=mix(red,255,airLight),g=mix(green,201,airLight),b=mix(blue,151,airLight);
   // The disc and surrounding aureole share the directional light's bearing
   // and elevation. A broad falloff gives nearby clouds a pale gold lining.
   const solarDistance=Math.max(0,1-(sinY*sinSun+cosY*cosSun*cosWest));
   if(solarDistance<.07) {
    const glow=.65*Math.exp(-135*solarDistance)+.35*Math.exp(-5200*solarDistance);
    r=mix(r,255,glow);g=mix(g,237,glow);b=mix(b,194,glow);
   }
   if(elevation>1&&elevation<35)for(const cloud of clouds) {
    const offset=(elevation-cloud.height)/cloud.width;
    if(Math.abs(offset)>2.5)continue;
    const coverage=cloud.opacity*Math.exp(-offset*offset);
    const rim=T.MathUtils.smoothstep(-offset,-.4,1.05)*west;
    r=mix(r,mix(190,255,rim),coverage);
    g=mix(g,mix(178,219,rim),coverage);
    b=mix(b,mix(199,187,rim),coverage);
   }
   const i=(y*width+x)*4;
   data[i]=Math.round(r);data[i+1]=Math.round(g);data[i+2]=Math.round(b);data[i+3]=255;
  }
 }
 return {pixels:data,width,height};
}

function skyTexture({pixels,width,height}) {
 const texture=new T.DataTexture(pixels,width,height,T.RGBAFormat);
 texture.name='West sky over Kerrytown';
 texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;
 texture.wrapS=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
 texture.needsUpdate=true;
 return texture;
}

let panorama;
export function enterStreetAtmosphere(viewer) {
 const {scene,sky,sun,renderer}=viewer,webgl=renderer.isWebGLRenderer;
 panorama??=makePanorama();
 const background=webgl?skyTexture(panorama):new T.Color(0xe0b5b1);
 const previous={
  background:scene.background,fog:scene.fog,solar:viewer.solar,wide:viewer.wideLighting,
  sky:sky.color.clone(),ground:sky.groundColor.clone(),sun:sun.color.clone(),
  skyPower:sky.intensity,sunPower:sun.intensity,visible:sun.visible,shadows:sun.castShadow
 };
 const style=renderer.domElement.style;
 if(webgl)scene.fog=new T.Fog(0xd2b6b6,78,520);
 else {
  previous.streetSky=renderer.streetSky;
  renderer.streetSky=panorama;
  // The raster worker shares the panorama but uses scalar lighting for
  // surfaces. Keep its slight material grade local to the model canvas.
  previous.filter=style.getPropertyValue('filter');
  previous.priority=style.getPropertyPriority('filter');
  const base=previous.filter&&previous.filter!=='none'?previous.filter+' ':'';
  style.setProperty('filter',base+'sepia(.085) saturate(1.10) contrast(1.025)',previous.priority);
 }
 sky.color.set(0xc6dbf7);sky.groundColor.set(0xb6a1a1);sky.intensity=1.28;
 sun.color.set(0xffc28d);sun.intensity=3.46;
 viewer.setSun(sunBearing,sunElevation,false);

 let disposed=false;
 return {background,dispose(){
  if(disposed)return;
  disposed=true;
  if(scene.background===background)scene.background=previous.background;
  scene.fog=previous.fog;
  if(webgl)background.dispose();
  else {
   renderer.streetSky=previous.streetSky;
   if(previous.filter)style.setProperty('filter',previous.filter,previous.priority);
   else style.removeProperty('filter');
  }
  sky.color.copy(previous.sky);sky.groundColor.copy(previous.ground);sky.intensity=previous.skyPower;
  sun.color.copy(previous.sun);sun.intensity=previous.sunPower;
  viewer.wideLighting=previous.wide;viewer.setSun(...previous.solar,false);
  sun.visible=previous.visible;sun.castShadow=previous.shadows;
 }};
}
