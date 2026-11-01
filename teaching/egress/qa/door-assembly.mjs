// One record represents the complete doorway. Leaves/panels are attributes,
// never additional portals, exit choices, or multipliers for clear width.
export const doorTypes={unknown:'Not identified',single:'Single swing',double:'Double swing',sliding:'Sliding',folding:'Folding',other:'Other'};
export function doorAssembly(o={}){
 const doorType=Object.hasOwn(doorTypes,o.doorType)?o.doorType:'unknown';
 const leafCount=doorType==='single'?1:doorType==='double'?2:Number.isInteger(o.leafCount)&&o.leafCount>=1&&o.leafCount<=16?o.leafCount:null;
 return {doorType,leafCount};
}
export const nonSwingDoor=o=>['sliding','folding','other'].includes(doorAssembly(o).doorType);
export function doorAssemblyLabel(o){
 if(o.openingType==='passage')return 'Open passage';
 const {doorType,leafCount}=doorAssembly(o);
 return (doorType==='unknown'?'Door type not identified':doorTypes[doorType])+(leafCount?' · '+leafCount+' '+(leafCount===1?'leaf/panel':'leaves/panels'):'');
}
export function mergeDoorAssembly(items,anchor){
 const own=doorAssembly(anchor),known=items.map(doorAssembly).filter(o=>o.doorType!=='unknown');
 if(own.doorType!=='unknown')return own;
 const types=[...new Set(known.map(o=>o.doorType))];
 if(types.length!==1)return own;
 const counts=[...new Set(known.map(o=>o.leafCount).filter(n=>n!=null))];
 return doorAssembly({doorType:types[0],leafCount:counts.length===1?counts[0]:null});
}
export function doorAssemblyFields(o){
 const {doorType,leafCount}=doorAssembly(o);
 return `<label>Door type<select data-prop="doorType">${Object.entries(doorTypes).map(([k,v])=>`<option value="${k}" ${k===doorType?'selected':''}>${v}</option>`).join('')}</select></label>${!['single','double'].includes(doorType)?`<label>Leaves / panels<input data-prop="leafCount" type="number" min="1" max="16" step="1" placeholder="Not identified" value="${leafCount??''}"></label>`:''}<p class="small">1 doorway · ${leafCount?leafCount+' '+(leafCount===1?'leaf/panel':'leaves/panels'):'leaf count not identified'}. Enter the usable clear width once for the whole opening.</p>`;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function doorScheduleReport(p){
 const rows=p.floors.flatMap(f=>f.doors.map(d=>({floor:f.name,door:d})));
 if(!rows.length)return '';
 return `<h2>Doorway schedule</h2><p>Each row is one modeled doorway. Leaves and sliding/folding panels do not add doorways. Clear width is entered once for the whole usable opening, not multiplied by the number of leaves.</p><table><tr><th>Floor / doorway</th><th>Type</th><th>Doorway count</th><th>Usable clear width</th><th>Role</th></tr>${rows.map(({floor,door:d})=>`<tr><td>${esc(floor)} / ${esc(d.name||'Door')}</td><td>${esc(doorAssemblyLabel(d))}</td><td>1</td><td>${d.width>0?(p.units==='ft'?(d.width/.3048).toFixed(2)+' ft':d.width.toFixed(2)+' m'):'Not measured'}${d.recognition?.autoDetected&&d.widthConfirmed!==true?' · estimated':''}</td><td>${d.exit?(d.exitConfirmed===false?'Detected exit · role to confirm':'Marked as exit'):d.openingType==='passage'?'Open passage':'Interior door'}</td></tr>`).join('')}</table>`;
}
