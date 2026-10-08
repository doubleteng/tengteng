// Exercise the actual homepage script with a minimal DOM: catalogue selection is independent of browser layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const cards = Array.from({length: 43}, (_, i) => ({
  dataset: {year: i === 42 ? '' : i === 41 ? '2022–2026' : String(1995 + i % 32), category: ['research','teaching','design'][i % 3], title: `Project ${String(i).padStart(2,'0')}`, weight: i % 4 + 1},
  image: {}, querySelector() { return this.image; }
}));
const grid = {children: cards, replaceChildren(fragment) { this.children = fragment.children; }};
const control = () => ({value: '', hidden: true, events: {}, addEventListener(type, fn) { this.events[type] = fn; }});
const sort = control(), shuffle = control(), status = {};
const elements = {'home-projects':grid,'home-sort':sort,'home-shuffle':shuffle,'home-sort-control':{},'home-grid-status':status};
vm.runInNewContext(source, {document:{getElementById:id=>elements[id],createDocumentFragment:()=>({children:[],appendChild(card){this.children.push(card);}})}});
const years = card => Math.max(0,...(card.dataset.year.match(/\b\d{4}\b/g)||[]).map(Number));
const expected = [...cards].sort((a,b)=>years(b)-years(a)||a.dataset.title.localeCompare(b.dataset.title));
assert.equal(grid.children.length,16);
assert.equal(new Set(grid.children).size,16);
for (let i=0;i<10;i++) {
  shuffle.events.click();
  assert.equal(grid.children.length,16);
  sort.value='date';sort.events.change();
  assert.equal(grid.children.length,43,'Date mode must display the entire catalogue');
  assert.deepEqual(grid.children.map(c=>c.dataset.title),expected.map(c=>c.dataset.title));
  assert.equal(grid.children.at(-1).dataset.year,'','Undated projects sort last');
}
sort.value='type';sort.events.change();assert.equal(grid.children.length,43);
sort.value='random';sort.events.change();assert.equal(grid.children.length,16);
assert.equal(new Set(grid.children).size,16);
assert.match(status.textContent,/16 of 43/);
console.log('PASS: global chronological sorting, ranges, undated entries, repeated shuffle/sort, full type catalogue, and random sample.');
