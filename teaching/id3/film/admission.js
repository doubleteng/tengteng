import {loadProject, projectKey, showFilms} from './cloud-film.js?v=1';
const projectReady = loadProject();
projectReady.then(project => {
  byId('project-author').textContent = ' · ' + project.author;
  document.title = 'Film · ' + project.author + ' · Integrated Design III';
  byId('project-back').href = '../#model-' + encodeURIComponent(project.key);
  byId('project-back').textContent = '← ' + project.author + '’s project';
  showFilms(project);
}).catch(error => { byId('gate-message').textContent = error.message; });
document.getElementById('featured').hidden = projectKey !== 'ava-barbat';
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
const isAva = projectKey === 'ava-barbat';
const editingReview = isAva && new URLSearchParams(location.search).get('edit') === 'common-center';
let reviewPath;
async function getReview() {
  if (!reviewPath) {
    const response = await fetch('./ava-common-center.json?v=1');
    if (!response.ok) throw Error('The camera sequence could not load.');
    reviewPath = await response.json();
  }
  return reviewPath;
}
async function showReview() {
  byId('sequence-review').hidden = false;
  try {
    const path = await getReview();
    const clock = s => Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
    let time = 0;
    path.shots.forEach((shot,index) => {
      const li = document.createElement('li'), button = document.createElement('button');
      const stamp = document.createElement('time'), title = document.createElement('span');
      stamp.textContent = clock(time); title.textContent = shot.name;
      button.type = 'button'; button.append(stamp,title);
      button.onclick = () => explore(index);
      li.append(button); byId('review-shots').append(li);
      time += shot.seconds;
    });
    byId('review-length').textContent = '· ' + path.shots.length + ' shots · ' + clock(time);
    byId('review-explore').onclick = () => explore(0);
  } catch (error) {
    byId('review-status').hidden = false; byId('review-status').textContent = error.message;
    byId('review-explore').disabled = true;
  }
}
async function explore(selected) {
  byId('sequence-review').hidden = byId('admission').hidden = true;
  byId('review-return').hidden = byId('studio').hidden = false;
  byId('studio').classList.add('review-only');
  try {
    const {openEditor} = await import('./editor.js?v=ava-shots-1');
    await openEditor('',await projectReady,{path:await getReview(),readOnly:true,selected});
    byId('stage').scrollIntoView({block:'nearest'});
  } catch {
    byId('status').textContent = 'The model could not load. Return to the shot overview to try again.';
  }
}
if (isAva && !editingReview) showReview();
if (editingReview) {
  byId('signin').querySelector('button').textContent = 'Edit A Common Center';
  byId('director').focus();
}
byId('leave').onclick = () => location.reload();
byId('signin').onsubmit = async event => {
  event.preventDefault();
  const director = names.get(normalize(byId('director').value));
  if (!director) {
    byId('gate-message').textContent = 'Enter the full name listed on the studio roster.';
    byId('director').focus();
    return;
  }
  byId('admission').hidden = byId('sequence-review').hidden = true;
  byId('director-name').textContent = director;
  byId('session').hidden = false;
  byId('studio').hidden = false;
  try {
    const {openEditor} = await import('./editor.js?v=ava-shots-1');
    await openEditor(director, await projectReady, editingReview ? {path:await getReview(),readOnly:false} : null);
  } catch (error) {
    byId('status').textContent = 'The model could not load. Close the editor and try again.';
    console.error(error);
  }
};
