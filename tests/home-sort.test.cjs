// Exercise the actual homepage script; assertions describe visitor-visible requirements.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const coreUrls = fs.readFileSync('_data/home.yml', 'utf8').split('core_projects:')[1]
  .split('\n\n')[0].match(/\/research\/[^\s]+\//g);
assert.equal(coreUrls.length, 4);
function card(category, i, coreOrder = 0) {
  return {
    dataset: {projectId: coreOrder ? coreUrls[coreOrder - 1] : `/${category}/${i}/`, coreOrder,
      year: i === 42 ? '' : i === 41 ? '2022–2026' : String(1995 + i % 32),
      category, title: `Project ${String(i).padStart(2, '0')}`, weight: i % 4 + 1},
    image: {}, querySelector() { return this.image; }
  };
}
// Match the current catalogue's 21 research, 13 design and 9 teaching records.
const cards = Array.from({length: 43}, (_, i) => card(
  i < 21 ? 'research' : i < 34 ? 'design' : 'teaching', i, i < 4 ? i + 1 : 0));
function mount(input, seed = 1, saved = null) {
  const grid = {children: input, replaceChildren(fragment) { this.children = fragment.children; }};
  const control = () => ({value: '', hidden: true, events: {}, addEventListener(type, fn) { this.events[type] = fn; }});
  const sort = control(), shuffle = control(), status = {};
  const elements = {'home-projects': grid, 'home-sort': sort, 'home-shuffle': shuffle,
    'home-sort-control': {}, 'home-grid-status': status};
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const history = {state: saved ? {portfolioHome: saved} : null, replaceState(state) { this.state = state; }};
  vm.runInNewContext(source, {Math: math, history, document: {
    getElementById: id => elements[id],
    createDocumentFragment: () => ({children: [], appendChild(c) { this.children.push(c); }})
  }});
  return {grid, sort, shuffle, status, history};
}
const ids = list => Array.from(list, c => c.dataset.projectId);
const years = c => Math.max(0, ...(c.dataset.year.match(/\b\d{4}\b/g) || []).map(Number));
const byDate = (a, b) => years(b) - years(a) || a.dataset.title.localeCompare(b.dataset.title);
const expectedDate = ids([...cards].sort(byDate));
const typeOrder = {research: 0, teaching: 1, design: 2};
const expectedType = ids([...cards].sort((a, b) =>
  typeOrder[a.dataset.category] - typeOrder[b.dataset.category] || byDate(a, b)));
function checkExplore(list, previous) {
  assert.equal(list.length, 16);
  assert.equal(new Set(ids(list)).size, 16, 'No repeated project, including cross-listed work');
  assert.deepEqual(ids(list.slice(0, 4)), coreUrls, 'Core order remains fixed');
  const rotating = list.slice(4);
  for (const category of ['research', 'design', 'teaching']) {
    assert.equal(rotating.filter(c => c.dataset.category === category).length, 4);
  }
  for (let i = 4; i < list.length; i++) {
    assert.notEqual(list[i].dataset.category, list[i - 1].dataset.category,
      'Separate neighbouring research samples with other disciplines');
  }
  if (previous) assert.ok(ids(rotating).filter(id => !previous.has(id)).length >= 6,
    'Discover more replaces at least half of the 12 rotating projects');
  for (let i = 0; i < 4; i++) assert.equal(list[i].image.loading, 'eager');
  return new Set(ids(rotating));
}
const seen = new Set();
for (let seed = 1; seed <= 20; seed++) {
  // A second record with the same canonical URL must not duplicate a cross-listed project.
  const state = mount([...cards, {...cards[3], dataset: {...cards[3].dataset}}], seed);
  let previous = checkExplore(state.grid.children);
  for (let i = 0; i < 50; i++) {
    state.shuffle.events.click();
    previous = checkExplore(state.grid.children, previous);
    ids(state.grid.children).forEach(id => seen.add(id));
    state.sort.value = 'date'; state.sort.events.change();
    assert.deepEqual(ids(state.grid.children), expectedDate, 'Newest first uses all 43 projects');
    assert.equal(state.grid.children.at(-1).dataset.year, '', 'Undated records sort last');
    state.sort.value = 'type'; state.sort.events.change();
    assert.deepEqual(ids(state.grid.children), expectedType, 'Type mode uses the complete catalogue');
    state.sort.value = 'random'; state.sort.events.change();
    previous = checkExplore(state.grid.children, previous);
    assert.match(state.status.textContent, /16 of 43 projects, 4 core projects/);
  }
}
assert.equal(seen.size, cards.length, 'All projects remain discoverable');
for (const smaller of [cards.slice(4), cards.slice(0, 8), [], [cards[0]]]) {
  const {grid} = mount(smaller);
  assert.equal(grid.children.length, Math.min(16, smaller.length), 'Graceful small-catalogue fallback');
  assert.equal(new Set(ids(grid.children)).size, grid.children.length);
}
console.log('PASS: 2,000 Explore transitions, fixed core order, 4/4/4 quotas, >=6 replacements, deduplication, interleaving, global sorting, and small catalogues.');


const firstVisit = mount(cards, 7);
firstVisit.shuffle.events.click();
const saved = firstVisit.history.state.portfolioHome;
const returned = mount(cards, 19, saved);
assert.deepEqual(ids(returned.grid.children), ids(firstVisit.grid.children), 'Back/reload restores the exact Explore selection');
checkExplore(returned.grid.children);
returned.sort.value = 'date'; returned.sort.events.change();
const sortedReturn = mount(cards, 2, returned.history.state.portfolioHome);
assert.equal(sortedReturn.sort.value, 'date');
assert.deepEqual(ids(sortedReturn.grid.children), expectedDate, 'Back/reload preserves the selected sort mode');
for (const invalid of [{mode:'random', ids:['/removed-project/']}, {mode:'random',ids:Array(16).fill(cards[0].dataset.projectId)}]) {
  checkExplore(mount(cards, 1, invalid).grid.children);
}
console.log('PASS: saved selection, sort mode, and stale/duplicate history recovery.');
