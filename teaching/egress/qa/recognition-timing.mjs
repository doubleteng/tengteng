export function recognitionTiming(run,now=()=>performance.now()){
 const started=now(),log=run.timings??={version:1,sessions:[]};
 const session={startedAt:new Date().toISOString(),elapsedMs:0,phases:{}};log.sessions.push(session);log.sessions=log.sessions.slice(-8);
 const active=new Map();
 const measure=async(name,work)=>{
  const phase=session.phases[name]??={calls:0,failures:0,totalMs:0,maxConcurrent:0},start=now();
  phase.calls++;active.set(name,(active.get(name)||0)+1);phase.maxConcurrent=Math.max(phase.maxConcurrent,active.get(name));
  try{return await work();}catch(error){phase.failures++;throw error;}
  finally{phase.totalMs+=Math.max(0,now()-start);active.set(name,active.get(name)-1);session.elapsedMs=Math.max(0,now()-started);}
 };
 return {measure,elapsed:()=>Math.max(0,now()-started),finish:()=>{session.elapsedMs=Math.max(0,now()-started);return session;}};
}
export function elapsedLabel(ms){const seconds=Math.floor(Math.max(0,ms)/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
