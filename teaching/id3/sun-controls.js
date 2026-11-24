import {detroitSun} from './solar.js';

// Measured true north, clockwise from Rhino +Y.
const northOffset=-2.25147;
const radians=Math.PI/180;
const directions=['North','Northeast','East','Southeast','South','Southwest','West','Northwest'];

export function bindSunlight(setSun){
 const get=id=>document.getElementById(id);
 const options=get('sun-options'),settings=get('sun-settings'),site=get('use-site-sun');
 const date=get('sun-date'),time=get('sun-time'),status=get('sun-readout');
 const direction=get('sun-direction'),height=get('sun-height');
 let azimuth=225,altitude=40,geographic=true,frame=0;

 const dayRange=get('sun-day-range'),timeRange=get('sun-time-range');
 function syncCalendar(){
  const year=Number(date.value.slice(0,4));
  if(date.value && year){
   const jan=Date.UTC(year,0,1),day=Date.parse(date.value+'T00:00:00Z');
   dayRange.max=(Date.UTC(year+1,0,1)-jan)/86400000;
   dayRange.value=1+(day-jan)/86400000;dayRange.setAttribute('aria-valuetext',date.value);
  }
  if(time.value){const [h,m]=time.value.split(':').map(Number);timeRange.value=h*60+m;timeRange.setAttribute('aria-valuetext',time.value);}
 }
 function calendarInput(){geographic=true;syncCalendar();
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;apply();});
 }
 dayRange.oninput=()=>{
  const year=Number(date.value.slice(0,4))||2026;
  date.value=new Date(Date.UTC(year,0,Number(dayRange.value))).toISOString().slice(0,10);
  calendarInput();
 };
 timeRange.oninput=()=>{
  const m=Number(timeRange.value);time.value=[Math.floor(m/60),m%60].map(x=>String(x).padStart(2,'0')).join(':');calendarInput();
 };
 syncCalendar();
 function handle(id,x,y){
  const node=get(id);
  node.setAttribute('cx',x);node.setAttribute('cy',y);
 }
 function draw(){
  const a=azimuth*radians,h=Math.max(0,altitude)*radians;
  const x=40+23*Math.sin(a),y=35-23*Math.cos(a);
  handle('sun-direction-handle',x,y);get('sun-bearing').setAttribute('d',`M40 35L${x} ${y}`);
  const hx=12+44*Math.cos(h),hy=58-44*Math.sin(h);
  handle('sun-height-handle',hx,hy);get('sun-elevation').setAttribute('d',`M12 58L${hx} ${hy}`);
  direction.setAttribute('aria-valuenow',Math.round(azimuth)%360);
  direction.setAttribute('aria-valuetext',directions[Math.round(azimuth/45)%8]);
  height.setAttribute('aria-valuenow',Math.max(0,Math.round(altitude)));
  height.setAttribute('aria-valuetext',altitude<=0?'Below the horizon':altitude<20?'Low sun':altitude<55?'Mid-sky':altitude<80?'High sun':'Overhead');
  get('sun-widget').classList.toggle('below-horizon',altitude<=0);
  site.setAttribute('aria-pressed',String(geographic));
 }
 function apply(interactive=true){
  if(geographic){
   const pos=detroitSun(date.value,time.value);
   if(!pos){status.textContent='Choose a valid Detroit date and time.';return;}
   azimuth=pos.az;altitude=pos.alt;
  }
  status.textContent=geographic?(altitude<=0?'Sun below the horizon':'Ann Arbor local time'):'Manual sun position';
  draw();setSun(azimuth+northOffset,altitude,interactive);
 }
 function manual(isDirection,value){
  geographic=false;
  if(isDirection){azimuth=(value%360+360)%360;altitude=Math.max(2,altitude);}
  else altitude=Math.max(0,Math.min(90,value));
  draw();
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;apply();});
 }
 function slider(el,isDirection){
  let pointer=null;
  function move(e){
   const transform=el.getScreenCTM();
   if(!transform)return;
   const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(transform.inverse());
   if(isDirection){
    if(Math.hypot(p.x-40,p.y-35)<4)return;
    manual(true,Math.atan2(p.x-40,35-p.y)/radians);
   }else manual(false,Math.atan2(Math.max(0,58-p.y),Math.max(0,p.x-12))/radians);
  }
  el.addEventListener('pointerdown',e=>{
   if(pointer!==null||e.button!==0)return;
   e.preventDefault();el.focus({preventScroll:true});pointer=e.pointerId;el.setPointerCapture(pointer);move(e);
  });
  el.addEventListener('pointermove',e=>{if(pointer===e.pointerId)move(e);});
  el.addEventListener('lostpointercapture',()=>{pointer=null;});
  el.addEventListener('keydown',e=>{
   const plus=['ArrowUp','ArrowRight'],minus=['ArrowDown','ArrowLeft'];
   let v=isDirection?azimuth:Math.max(0,altitude);
   const step=isDirection?5:2;
   if(plus.includes(e.key))v+=step;else if(minus.includes(e.key))v-=step;
   else if(e.key==='Home')v=0;else if(e.key==='End')v=isDirection?359:90;
   else if(e.key==='PageUp')v+=step*5;else if(e.key==='PageDown')v-=step*5;else return;
   e.preventDefault();manual(isDirection,v);
  });
 }
 slider(direction,true);slider(height,false);
 function panel(open){options.hidden=!open;settings.setAttribute('aria-expanded',String(open));}
 settings.onclick=()=>panel(options.hidden);
 site.onclick=()=>{geographic=true;apply();};
 date.oninput=time.oninput=calendarInput;
 get('sun-widget').addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!options.hidden){e.stopPropagation();panel(false);settings.focus();}
 });
 document.addEventListener('pointerdown',e=>{if(!options.hidden&&!get('sun-widget').contains(e.target))panel(false);});
 apply(false);
 return {apply};
}
