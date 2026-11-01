import {SF} from './geometry.mjs?v=recognition-speed-2';
import {functions} from './model.mjs?v=recognition-speed-2';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const occupantSource='https://www.iccsafe.org/wp-content/uploads/Session-62-and-63-2021-IBC-Means-of-Egress.pdf#page=8';
export const areaBasisNote='Net: occupied use area, excluding accessory corridors, stairs, toilets and mechanical rooms. Gross: the served floor area, including its circulation and interior partitions. Confirm the polygon and any shared-area allocation; changing this label does not redraw it. Furniture does not create room boundaries.';
export const occupantMethod='Design occupant load = area ÷ area per person, rounded up. Use the factor for the actual activity. This is the load used to size egress, not a maximum capacity established by area alone. Fixed seating needs a seat-based calculation under IBC 1004.6.';
export function factorText(factor){return `${Number(factor)} sf/person · ${(factor*SF).toFixed(3)} m²/person`;}
export function factorReference(load){
 if(load.role==='corridor')return 'Circulation · carries loads from served rooms';
 const rule=functions[load.function];
 return rule&&Number(load.factor)===rule.factor&&load.basis===rule.basis?'IBC 2021 Table 1004.5':'Custom factor / basis · verify';
}
export function loadCalculation(load){
 if(load.role==='corridor')return '0 additional occupants; loads from the connected rooms accumulate along this corridor.';
 return `${load.area.toFixed(2)} m² ÷ ${(load.factor*SF).toFixed(3)} m²/person → ${load.occupants} people (round up)`;
}
export function loadCard(load){return `<section class="load-card"><span class="eyebrow">AREA → OCCUPANT LOAD</span><strong>${load.role==='corridor'?'Circulation':factorText(load.factor)}</strong><p class="load-calculation">${esc(loadCalculation(load))}</p><details class="inline-help"><summary>IBC factor & area basis</summary><p>${esc(load.basis)} area · ${esc(factorReference(load))}</p><small>Calculation uses unrounded areas and factors.</small></details></section>`;}
export function occupantReferenceTable(){return `<table class="occupant-table"><thead><tr><th>Space use</th><th>sf/person</th><th>m²/person</th><th>Area basis</th></tr></thead><tbody>${Object.values(functions).map(f=>`<tr><td>${esc(f.name)}</td><td>${f.factor}</td><td>${(f.factor*SF).toFixed(3)}</td><td>${f.basis}</td></tr>`).join('')}</tbody></table><p>${occupantMethod}</p><p>${areaBasisNote}</p><p><a href="${occupantSource}" target="_blank" rel="noopener">IBC 2021 Table 1004.5 · selected uses ↗</a></p>`;}
