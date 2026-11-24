import SunCalc from './lib/sun-position.js';
export const siteLatitude=42+17/60+2.1/3600,siteLongitude=-(83+44/60+48.2/3600);
const localFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function localEpoch(ms){
 const p=Object.fromEntries(localFormat.formatToParts(ms).map(x=>[x.type,x.value]));
 return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
}
export function detroitSun(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
 const target=Date.parse(date+'T'+time+':00Z');if(!Number.isFinite(target))return null;
 let utc=target+4*3600000;for(let i=0;i<3;i++){const delta=target-localEpoch(utc);if(!delta)break;utc+=delta;}
 if(localEpoch(utc)!==target)return null;
 const sun=SunCalc.getPosition(new Date(utc),siteLatitude,siteLongitude);
 return {az:(180+sun.azimuth*180/Math.PI+360)%360,alt:sun.altitude*180/Math.PI,utc};
}
