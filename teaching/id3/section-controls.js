// Geometry stays in its registered coordinate system. All public distances are feet.
const foot = 0.3048;
export function bindSectionControls(getViewer, closeOther) {
 const byId = id => document.getElementById(id);
 const button = byId('section-toggle'), panel = byId('section-panel');
 const mode = byId('section-mode'), fields = byId('section-fields');
 const range = byId('section-range'), number = byId('section-number'), flip = byId('section-flip');
 const positions = new Map();
 let origin = 0, side = -1;
 function close() {
  panel.hidden = true;
  button.setAttribute('aria-expanded', 'false');
 }
 function apply() {
  const axis = mode.value;
  const value = Number(range.value);
  range.setAttribute('aria-valuetext', value + ' feet');
  getViewer()?.setSection(axis, origin + value * foot, side);
  if (axis !== 'off') positions.set(axis, {value, side});
 }
 function choose() {
  const axis = mode.value, viewer = getViewer();
  fields.hidden = axis === 'off';
  button.classList.toggle('cut-active', axis !== 'off');
  if (axis === 'off') { viewer?.setSection('off'); return; }
  const box = viewer.sectionBounds, horizontal = axis === 'y';
  origin = horizontal ? 0 : (box.min[axis] + box.max[axis]) / 2;
  const min = Math.floor((box.min[axis] - origin) / foot);
  const max = Math.max(min + 1, Math.ceil((box.max[axis] - origin) / foot));
  for (const field of [range,number]) { field.min = min; field.max = max; }
  const saved = positions.get(axis);
  const initial = horizontal ? (Math.max(0,viewer.projectBounds.min.y) / foot + 4) : 0;
  const value = Math.max(min, Math.min(max, saved?.value ?? Math.round(initial*100)/100));
  range.value = number.value = value;
  side = saved?.side ?? (horizontal || viewer.camera.position[axis] >= origin ? -1 : 1);
  const label = horizontal ? 'Height above model datum' : 'Offset from model center';
  range.setAttribute('aria-label', label + ' in feet');
  byId('section-label').textContent = label;
  byId('section-min').textContent = min + ' ft'; byId('section-max').textContent = max + ' ft';
  apply();
 }
 function reset() {
  close(); mode.value = 'off'; choose(); positions.clear(); button.disabled = true;
 }
 mode.onchange = choose;
 range.oninput = () => { number.value = range.value; apply(); };
 number.oninput = () => {
  if (number.value && number.validity.valid) { range.value = number.value; apply(); }
 };
 number.onchange = () => {
  const typed = number.valueAsNumber;
  if (Number.isFinite(typed)) range.value = Math.max(+range.min, Math.min(+range.max, Math.round(typed*100)/100));
  number.value = range.value; apply();
 };
 flip.onclick = () => { side = -side; apply(); };
 button.onclick = () => {
  if (!panel.hidden) { close(); return; }
  closeOther(); panel.hidden = false; button.setAttribute('aria-expanded','true'); mode.focus({preventScroll:true});
 };
 panel.onkeydown = event => {
  if (event.key === 'Escape') { event.stopPropagation(); close(); button.focus(); }
 };
 document.addEventListener('pointerdown', event => {
  if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) close();
 });
 return {reset, close, ready() { button.disabled = false; }};
}
