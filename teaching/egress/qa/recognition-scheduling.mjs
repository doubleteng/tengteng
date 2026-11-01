// Keep model calls independent while applying their geometry in source order.
// The window includes completed, unconsumed replies, so an early completion
// can waste at most one look-ahead request, never a whole queued batch.
export class ReadAhead {
 constructor(read,{concurrency=1,cancelled=()=>false}={}){this.read=read;this.limit=Math.max(1,Math.min(2,Math.floor(concurrency)||1));this.cancelled=cancelled;this.pending=new Map();this.closed=false;this.paused=false;}
 prime(items){
  for(const item of items){
   if(this.closed||this.paused||this.cancelled()||this.pending.size>=this.limit)break;
   if(this.pending.has(item))continue;
   this.pending.set(item,Promise.resolve().then(()=>this.read(item)).then(value=>({value}),error=>{if(serviceUnavailable(error))this.paused=true;return {error};}));
  }
 }
 async take(item){this.prime([item]);const promise=this.pending.get(item);if(!promise)return null;const result=await promise;this.pending.delete(item);return result;}
 async settle(){await Promise.all(this.pending.values());}
 async close(){this.closed=true;await this.settle();}
}

export const serviceUnavailable=error=>/quota|allowance|configured|access|session|429|busy|connect/i.test(String(error?.message||error));
export const smallerRegionNeeded=error=>/truncated|no architectural walls|unresolved structure/i.test(String(error?.message||error));
export const busyService=error=>/busy with other plans/i.test(String(error?.message||error));

// Exact result reuse only within one immutable source-image run. Concurrent
// reads may finish out of order; saving those replies never merges geometry.
export function serialProgress(callback){let tail=Promise.resolve();return (...args)=>{const next=tail.then(()=>callback(...args));tail=next.catch(()=>{});return next;};}
