/** Anonymous, instructor-funded vision service. No Drive/Sheets APIs or student credentials. */
const APP_ORIGIN = 'https://teng-teng.org';
function doGet(e) {
  const template=HtmlService.createTemplateFromFile('Bridge');
  const nonce=e&&e.parameter&&e.parameter.nonce||'';
  template.nonce=/^[a-zA-Z0-9-]{16,80}$/.test(nonce)?nonce:'';
  template.origin=APP_ORIGIN;
  template.token=template.nonce?createVisionSession_(template.nonce):'';
  return template.evaluate().setTitle('Egress + Site Lab — recognition service').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/** Editor-only migration; underscore functions are unavailable to google.script.run. */
function initializeInstructorVision_() {
  const shared=PropertiesService.getScriptProperties(),old=PropertiesService.getUserProperties();
  if(!shared.getProperty('VISION_API_KEY')){
    const key=old.getProperty('VISION_API_KEY');
    if(!key)throw Error('No saved instructor key. Configure VISION_API_KEY in Script Properties.');
    shared.setProperties({VISION_API_KEY:key,VISION_MODEL:old.getProperty('VISION_MODEL')||'gemini-4-argon'});
  }
  if(!shared.getProperty('VISION_SESSION_SECRET'))shared.setProperty('VISION_SESSION_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if(!shared.getProperty('VISION_DAILY_LIMIT'))shared.setProperty('VISION_DAILY_LIMIT','120');
  if(!shared.getProperty('VISION_MAX_CONCURRENT'))shared.setProperty('VISION_MAX_CONCURRENT','3');
  console.log('Instructor vision ready: '+visionStatus_().model+'. No credentials returned.');
}
function visionSignature_(data){
  const secret=PropertiesService.getScriptProperties().getProperty('VISION_SESSION_SECRET');
  if(!secret)throw Error('The instructor recognition service is being configured. Please try again later.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data,secret)).replace(/=+$/,'');
}
function createVisionSession_(nonce){const data=nonce+'.'+(Date.now()+21600000);return data+'.'+visionSignature_(data);}
function verifyVisionSession_(token){
  if(typeof token!=='string'||token.length>180)throw Error('Recognition session expired. Close and reopen recognition.');
  const parts=token.split('.');
  if(parts.length!==3||!/^[a-zA-Z0-9-]{16,80}$/.test(parts[0])||!/^\d{13}$/.test(parts[1])||Number(parts[1])<Date.now()||Number(parts[1])>Date.now()+21600000)throw Error('Recognition session expired. Close and reopen recognition.');
  const expected=visionSignature_(parts[0]+'.'+parts[1]);let difference=expected.length^parts[2].length;
  for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^(parts[2].charCodeAt(i)||0);
  if(difference)throw Error('Invalid recognition session.');
  return parts[0];
}
function validateVisionImage_(image){
  if(typeof image!=='string'||image.length>6000000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(image))throw Error('Use a PNG or JPEG plan under 4 MB for AI recognition.');
}
function reserveVisionRequest_(session){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const props=PropertiesService.getScriptProperties(),now=Date.now(),day=new Date(now).toISOString().slice(0,10);
    let usage=JSON.parse(props.getProperty('VISION_SHARED_USAGE')||'{}');
    if(usage.day!==day)usage={day:day,count:0};
    const limit=Math.max(1,Math.min(1000,Number(props.getProperty('VISION_DAILY_LIMIT'))||120));
    if(usage.count>=limit)throw Error('Today’s shared recognition allowance has been used. Your drawing is saved locally; contact your instructor.');
    const active=JSON.parse(props.getProperty('VISION_ACTIVE')||'[]').filter(r=>now-r.started<420000);
    const concurrent=Math.max(1,Math.min(10,Number(props.getProperty('VISION_MAX_CONCURRENT'))||3));
    if(active.length>=concurrent)throw Error('Recognition is busy with other plans. Please try again in a minute.');
    const cache=CacheService.getScriptCache(),sessionKey='vision-session-'+session,count=Number(cache.get(sessionKey))||0;
    if(count>=12)throw Error('This recognition session has reached its allowance. Your drawing remains on this device.');
    const id=Utilities.getUuid();active.push({id:id,started:now});usage.count=(Number(usage.count)||0)+1;
    props.setProperties({VISION_SHARED_USAGE:JSON.stringify(usage),VISION_ACTIVE:JSON.stringify(active)});
    cache.put(sessionKey,String(count+1),21600);return id;
  }finally{lock.releaseLock();}
}
function releaseVisionRequest_(id){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{const props=PropertiesService.getScriptProperties();props.setProperty('VISION_ACTIVE',JSON.stringify(JSON.parse(props.getProperty('VISION_ACTIVE')||'[]').filter(r=>r.id!==id)));}
  finally{lock.releaseLock();}
}
/** The only browser-callable operation. Caller cannot choose key, model, prompt or URL. */
function visionCall(request){
  if(!request||!['status','recognizePlan'].includes(request.action))throw Error('Unsupported recognition action.');
  const session=verifyVisionSession_(request.token);
  if(request.action==='status')return visionStatus_();
  validateVisionImage_(request.image);
  if(!visionStatus_().configured)throw Error('The instructor vision service is not configured. No student API key is needed.');
  const id=reserveVisionRequest_(session);
  try{return recognizePlan_({image:request.image});}finally{releaseVisionRequest_(id);}
}
