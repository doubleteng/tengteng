import {serviceUnavailable} from './recognition-scheduling.mjs?v=recognition-speed-2';

export const hasRecognitionObjects=result=>(result?.elements||[]).some(e=>['wall','room','corridor','lobby','door','entrance','exterior','courtyard','stair','window'].includes(e.kind)&&e.points?.length>=2);

// Recover explicit service failures from both new checkpoints and older empty
// previews. A successful resumed region must not inherit a stale region error.
export function recognitionServiceError(run){
 if(!run||run.finished)return null;
 if(run.failure?.message&&serviceUnavailable(run.failure.message))return run.failure.message;
 const failed=(run.regions||[]).find(r=>r.state==='failed'&&serviceUnavailable(r.error));
 if(failed)return failed.error;
 if(!hasRecognitionObjects(run.result))return (run.result?.warnings||[]).find(serviceUnavailable)||null;
 return null;
}

export async function readRecognitionOverview(run,read){
 try{return await read();}
 catch(error){
  if(serviceUnavailable(error))throw error;
  run.result.warnings.push('Overview unavailable; continuing with individual regions: '+error.message);
  return null;
 }
}

export function requireRecognitionGeometry(run){
 const blocked=recognitionServiceError(run);if(blocked)throw Error(blocked);
 if(!hasRecognitionObjects(run.result))throw Error('Recognition returned no architectural objects. The drawing has not been analyzed.');
}

export function recognitionFailure(image,error){
 const run=image?.recognitionRun,raw=String(error?.message||error||recognitionServiceError(run)||run?.failure?.message||'Recognition returned no architectural objects. The drawing has not been analyzed.');
 let title='Recognition did not finish',message=raw;
 if(/today.*shared recognition allowance|app.*daily.*limit/i.test(raw)){
  title='Daily request limit reached';message='The app’s shared daily request limit has been reached. Recognition requests are paused.';
 }else if(/Google quota/i.test(raw)){
  title='Google request limit reached';message='Google rejected the recognition request because its quota was reached.';
 }else if(/session.*allowance/i.test(raw)){
  title='Session request limit reached';message='This recognition session has reached its request limit.';
 }else if(/busy with other plans/i.test(raw)){
  title='Recognition service is busy';message='Other plans are being processed. Try again shortly.';
 }else if(/no architectural objects/i.test(raw)){
  title='No recognition result';message='No architectural objects were returned. The drawing has not been analyzed.';
 }
 const read=(run?.regions||[]).filter(r=>r.state==='read').length,total=run?.regions?.length||0;
 return {title,message,raw,read,total,hasDraft:hasRecognitionObjects(image?.interpretation),saved:read?`${read} of ${total} regions are saved. Continue from them when the service is available.`:'Your uploaded drawing and existing design are unchanged.'};
}
