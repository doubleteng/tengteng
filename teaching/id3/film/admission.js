const members = [
  'Ava Barbat', 'Evan Bergsma', 'Caleigh Bovensiep', 'Hannah Brown',
  'Bryce Butler', 'Amelia Day', 'Aaron Freeman', 'Ayden Key', 'Eva Kola',
  'Anna Matushevskiy', 'Madison Pounall', 'James Skinner', 'Madilyn Vue',
  'Donovan Yousif', 'Teng Teng'
];
function normalize(name) {
  const parts = name.trim().split(',');
  const ordered = parts.length === 2 ? parts.reverse().join(' ') : name;
  return ordered.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}
const names = new Map(members.map(name => [normalize(name), name]));
names.set('madi vue', 'Madilyn Vue');
const byId = id => document.getElementById(id);
byId('leave').onclick = () => location.reload();
byId('signin').onsubmit = async event => {
  event.preventDefault();
  const director = names.get(normalize(byId('director').value));
  if (!director) {
    byId('gate-message').textContent = 'Enter the full name listed on the studio roster.';
    byId('director').focus();
    return;
  }
  byId('admission').hidden = true;
  byId('director-name').textContent = director;
  byId('session').hidden = false;
  byId('studio').hidden = false;
  try {
    const {openEditor} = await import('./editor.js?v=b770ca984f');
    await openEditor(director);
  } catch (error) {
    byId('status').textContent = 'The model could not load. Close the editor and try again.';
    console.error(error);
  }
};
