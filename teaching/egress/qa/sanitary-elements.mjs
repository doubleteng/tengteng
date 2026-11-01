// Restroom fixtures do not subdivide the room/door graph. A separately
// enclosed private toilet remains a room; only explicit stall evidence is
// downgraded from legacy generic room/door/wall classifications.
export const sanitaryKinds=['toilet-compartment','toilet-partition','toilet-door','sanitary-fixture'];
export function normalizeSanitaryElements(elements){
 return elements.map(e=>{
  const label=e.label||'',toilet=/\b(toilet|restroom|washroom|bathroom|wc|lavatory)\b|卫生间|洗手间|厕所|厕位/i.test(label);
  // A whole restroom's evidence often mentions its stalls. That is not a
  // reason to demote the room itself. Only an explicit object label, or an
  // evidence sentence identifying THIS object as a stall, can do that.
  const stallLabel=/\b(?:toilet|restroom|wc)\s+(?:stall|cubicle|compartment)\b|\b(?:stall|cubicle)\s*(?:door|partition|panel|gate|\d|$)|厕位|厕所隔间|卫生间隔间/i.test(label);
  const stallEvidence=/^(?:individual |internal |single )?(?:toilet |restroom |wc )(?:stall|cubicle|compartment)\b/i.test(e.evidence||'');
  if((stallLabel||stallEvidence)&&e.roomUse!=='restroom'&&!e.confirmed){
   if(e.kind==='room')return {...e,kind:'toilet-compartment'};
   if(['door','entrance'].includes(e.kind))return {...e,kind:'toilet-door'};
   if(e.kind==='wall')return {...e,kind:'toilet-partition'};
  }
  if(e.kind==='room'&&(toilet||e.roomUse==='restroom'))return {...e,roomUse:'restroom'};
  return e;
 });
}
