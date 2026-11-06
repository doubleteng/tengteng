/* Structure Studio: presentation and workflow layer over the original teaching engines. */
(function (W) {
  'use strict';
  const D = document, $ = id => D.getElementById(id), api = W.StructureLabUI;
  if (!api) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const terms = [
    ['Loads', [['load','Load'],['dead','Dead load'],['live','Live load'],['snow','Snow'],['wind','Wind'],['point','Point load'],['line','Line load'],['area','Area load'],['tributary','Tributary area']]],
    ['Forces & response', [['reaction','Reaction'],['axial','Axial force'],['tension','Tension'],['compression','Compression'],['shear','Shear'],['moment','Bending moment'],['torsion','Torsion'],['stress','Stress'],['deflection','Deflection']]],
    ['Read diagrams', [['read-shear','Shear diagram'],['read-moment','Moment diagram'],['read-torque','Torque diagram'],['read-axial','Axial diagram']]],
    ['Members & models', [['node','Node'],['member','Member'],['support','Support'],['span','Span'],['section','Section'],['beam','Beam'],['girder','Girder'],['column','Column'],['truss','Truss'],['bay','Bay'],['path','Load path']]]
  ];
  const steelGroups = [
    ['Roof concepts', [['material','Steel behaviour'],['anatomy','Members & connections'],['spans','Span & spacing'],['loads','Follow the load'],['workflow','Connect the evidence']]],
    ['1.1 · Roof project', [['brief','Set the brief'],['layout','Arrange the roof'],['deck-table','Select deck'],['load-bridge','Trace the loads'],['joist-table','Select joists'],['girder-table','Select girders'],['evidence','Explain the roof']]],
    ['Floor concepts', [['floor-system','Floor system'],['floor-members','Floor members'],['floor-lateral','Lateral path'],['floor-continuity','Continuity']]],
    ['2.1 · Floor project', [['floor-brief','Set the floor brief'],['floor-layout','Shape the partial floor'],['floor-deck','Select deck / slab'],['floor-beam','Select beams'],['floor-girder','Select girders'],['floor-column','Trace column loads'],['floor-evidence','Explain the floor']]],
    ['Column & foundation concepts', [['column-path','Column load path'],['column-area','Tributary area'],['column-buckling','Buckling & restraint'],['foundation-system','Foundation system']]],
    ['3.1 · Columns & foundations', [['foundation-brief','Set the brief'],['foundation-grid','Locate columns'],['foundation-load','Collect reactions'],['foundation-column','Select a column'],['foundation-footing','Study the footing'],['foundation-assembly','Assemble the building'],['foundation-evidence','Explain the design']]]
  ];
  const spaceInfo = {
    terms:['Terminology','Learn by looking','Select a member or a term. Change one condition and describe what you see.'],
    fundamentals:['Fundamentals','Experiment with structure','Change one condition, compare the response, then explain the mechanism.'],
    wood:['Wood building','Build a coordinated project','Carry your roof, truss, floor and support choices into one building.'],
    steel:['Steel building','Build from evidence','Connect each member to its geometry, load, original source and trial selection.'],
    concrete:['Concrete building','Connect material behaviour and assembly','Explore elastic response and review the precast project sequence.'],
    coach:['Structure Coach','Explain your design','Describe the selected member, its conditions and the evidence behind your choice.']
  };
  const missions = {
    origins:['Choose a structural form','Apply a load. Observe how the chosen system carries it to its supports.'],
    bays:['Organize a structural bay','Change span or spacing. Compare the structural depth and spatial consequences.'],
    hierarchy:['Follow the hierarchy','Distinguish the spanning surface, secondary members, primary members and supports.'],
    stability:['Restrain the structure','Change a support or connection. Identify whether a stable load path exists.'],
    loads:['Follow one load to the ground','Select a beam, girder or column. Read its tributary load and support reaction.'],
    materials:['Change one member condition','Keep the loading comparable. Explore how geometry and material affect elastic response.'],
    roof:['Lay out the timber roof','Coordinate deck span, purlin spacing and truss spacing with the assigned source.'],
    truss:['Design and test your truss','Place members and supports, define the load case, then inspect the force path.'],
    floor:['Build the floor that your space needs','Set the floor boundary, arrange panels and framing, and trace loads into the supports.'],
    building:['Connect the whole building','Coordinate roof and floor reactions, columns, lateral restraint and foundations.']
  };
  let data = {version:1, activities:{}, lastVisited:{}, concrete:false, termView:'model'}, queued=false, decorating=false;
  let resourceOpen=false, lastRoute='', railSignature='', lastModelRoute='fundamentals:loads', termRenderer=null, memberSelection=null, arrangedPanelFirst=null;
  const handles=api.getHandles();
  function route() {
    const s=W.StructureLab.getState();
    const space=s.screen==='glossary'?'terms':s.screen==='steel'?'steel':s.screen==='coach'?'coach':data.concrete&&s.active==='materials'?'concrete':W.WoodProject.has(s.active)?'wood':'fundamentals';
    const id=space==='terms'?handles.glossary.id:space==='steel'?handles.steel.state.lesson:space==='coach'?'coach':s.active;
    return {s,space,id,key:space+':'+id};
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
  function activity(key=route().key){return data.activities[key]??={visited:true,changed:false};}
  function go(space,id) {
    id=id||data.lastVisited[space];
    resourceOpen=false; data.concrete=space==='concrete';
    if(space==='terms')api.navigate('terms',id||handles.glossary.id);
    else if(space==='steel')api.navigate('steel',id||handles.steel.state.lesson||'lecture1.1');
    else if(space==='coach')api.navigate('coach');
    else if(space==='concrete'){api.navigate('lab','materials');api.setMaterial('concrete');}
    else api.navigate('lab',id||(space==='wood'?'roof':'origins'));
    railSignature='';sync();
  }
  function buttonRoute(space,id,name,current){const a=data.activities[space+':'+id];return `<button class="studio-route" data-studio-space="${space}" data-studio-id="${esc(id)}" ${current?'aria-current="page"':''}><span class="studio-route-dot ${a?.changed?'changed':''}"></span><span>${esc(name)}</span>${a?.changed?'<span class="studio-route-mark" title="Model explored">•</span>':''}</button>`;}
  function bindRoutes(el){el.querySelectorAll('[data-studio-space]').forEach(b=>b.onclick=()=>go(b.dataset.studioSpace,b.dataset.studioId));}
  function buildShell(){
    D.body.classList.add('studio-enabled');
    const head=D.querySelector('.topbar');
    const nav=D.createElement('nav');nav.className='studio-spaces';nav.setAttribute('aria-label','Learning workspaces');
    nav.innerHTML=Object.entries(spaceInfo).map(([id,v])=>`<button data-studio-space="${id}" data-space="${id}">${esc(v[0])}</button>`).join('');
    head.after(nav);bindRoutes(nav);
    const rail=D.createElement('aside');rail.id='studioRail';rail.className='studio-rail';rail.setAttribute('aria-label','Tasks and learning progress');$('workspace').prepend(rail);
    const menu=D.createElement('button');menu.id='studioTaskToggle';menu.className='studio-task-toggle';menu.textContent='Tasks & chapters';menu.setAttribute('aria-expanded','false');nav.prepend(menu);
    menu.onclick=()=>{const open=D.body.classList.toggle('studio-rail-open');menu.setAttribute('aria-expanded',String(open));};
    const library=D.createElement('button');library.id='studioLibrary';library.className='top-btn';library.textContent='Find a topic';library.onclick=openLibrary;
    $('courseMap').replaceWith(library); // Original course-map content is kept in the complete topic index below.
    $('brand').onclick=e=>{e.preventDefault();go('terms');};
    const note=D.querySelector('.study-file-note');if(note){note.textContent='Your study travels with you';note.title='Save study downloads your model choices, source records and notes. Open study resumes them.';}
    D.querySelectorAll('#labInspector [data-tab]').forEach(b=>b.textContent=({model:'Adjust',explain:'Inspect',exercise:'Explain'})[b.dataset.tab]);
    const action=D.createElement('div');action.className='studio-model-actions';action.innerHTML='<button data-action="sources">Sources & assumptions</button><button data-action="trial">Keep trial A</button><button data-action="compare">Compare A / B</button><button data-action="next" hidden></button>';
    $('labWorkspace').append(action);
    action.querySelector('[data-action="sources"]').onclick=()=>{if(W.WoodProject.has(route().id)&&$('courseReferences'))$('courseReferences').click();else{api.setPanel('explain');$('sourceLink').focus();}};
    action.querySelector('[data-action="trial"]').onclick=()=>{api.checkpoint();activity().trial=true;schedule();};
    action.querySelector('[data-action="compare"]').onclick=()=>api.compare();
    action.querySelector('[data-action="next"]').onclick=()=>{const order=['roof','truss','floor','building'],next=order[order.indexOf(route().id)+1];if(next)go('wood',next);else api.setPanel('exercise');};
    D.addEventListener('keydown',e=>{if(e.key==='Escape'){if(e.target.closest?.('.sn-calculator')||D.querySelector('.sn-calculator-expanded'))return;if(resourceOpen){resourceOpen=false;sync();$('studioOpenSources')?.focus();}D.body.classList.remove('studio-rail-open');$('studioTaskToggle').setAttribute('aria-expanded','false');}});
    $('workspace').addEventListener('click',e=>{if(e.target.closest('.sr-pdf-overlay button,[data-family-choice],[data-option-choice],[data-use-choice],[data-floor-option],[data-floor-family]')){activity().changed=true;schedule();}});
    $('workspace').addEventListener('change',e=>{if(!e.target.matches('input,select,textarea')||e.target.closest('#coachScreen'))return;activity().changed=true;schedule();});
    $('workspace').addEventListener('input',e=>{if(e.target.matches('textarea')&&!e.target.closest('#coachScreen'))schedule();});
  }
  function groupsFor(r){
    if(r.space==='terms')return terms;
    if(r.space==='steel')return steelGroups;
    if(r.space==='wood')return [['Project stages',W.LAB_MODULES.filter(x=>W.WoodProject.has(x.id)).map(x=>[x.id,W.WoodProject.labels[x.id]])]];
    if(r.space==='concrete')return [['Available studies',[['materials','Concrete elastic response']]]];
    if(r.space==='coach')return [];
    return [['Experiments',W.LAB_MODULES.filter(x=>!W.WoodProject.has(x.id)).map(x=>[x.id,x.title])]];
  }
  function notesFor(r){
    if(r.space==='steel'){const lab=handles.steel;return lab.state.notes?.[r.id]||lab.floorState?.notes?.[r.id]||lab.foundationState?.notes?.[r.id]||lab.conceptLab?.state?.notes?.[r.id]||'';}
    if(r.space==='terms')return data.activities[r.key]?.note||'';
    return r.s.reflections?.[r.id]||'';
  }
  function renderRail(r){
    const info=spaceInfo[r.space], a=activity(r.key), notes=notesFor(r), signature=JSON.stringify([r.space,r.id,a.changed,a.trial,!!notes,handles.glossary.id]);
    if(signature===railSignature)return;railSignature=signature;
    let title,goal;
    if(r.space==='terms'){title=handles.glossary.term.name;goal=handles.glossary.term.try;}
    else if(r.space==='steel'){title=steelGroups.flatMap(g=>g[1]).find(x=>x[0]===r.id)?.[1]||'Choose your project';goal=$('steelScreen').querySelector('.sr-head>div>p:last-child,.steel-head p')?.textContent?.trim()||'Select a member. Check its geometry and loads, read the original source, and explain your trial choice.';}
    else [title,goal]=missions[r.id]||[info[1],info[2]];
    const groups=groupsFor(r);
    $('studioRail').innerHTML=`<div class="studio-rail-heading"><span class="studio-eyebrow">STRUCTURE LAB</span><h1>${esc(info[0])}</h1><p>${esc(info[2])}</p></div><section class="studio-mission"><div class="studio-eyebrow">CURRENT TASK</div><h2>${esc(title)}</h2><p>${esc(goal)}</p>${r.space==='coach'?'':`<p class="studio-observation-status">${notes.trim()?'Observation recorded':'Keep a short explanation after testing.'}</p><button id="studioNextAction" class="studio-primary">${r.space==='terms'?'Try the related model':r.space==='steel'?'Open source & tools':'Inspect the response'}</button>`}</section>${W.StructureCourseGuide?.checkpoint(r.space,r.id)||''}<div class="studio-chapters">${groups.map(([name,items])=>`<details ${items.some(x=>x[0]===r.id)?'open':''}><summary>${esc(name)} <span>${items.length}</span></summary>${items.map(([id,label])=>buttonRoute(r.space,id,label,id===r.id)).join('')}</details>`).join('')}</div>${r.space==='concrete'?'<section class="studio-availability"><strong>Concrete project</strong><p>Review the Oct 27 / Nov 3 briefing. This workspace currently models elastic member behaviour; the precast project model and sizing-table workflow are not yet available.</p><button id="studioConcreteScope">View available concrete content</button></section>':''}${r.space==='coach'?'<button id="studioBackToModel" class="studio-primary">Return to your model</button><p class="studio-progress-note">Model notes are attached when you choose Ask Coach from a model. Check and confirm them before using them.</p>':''}<div class="studio-rail-bottom"><button id="studioCourseGuide">Course sequence & evidence</button><button id="studioFind">All topics & original course map</button><span>Developed by Teng Teng, PhD<br>and Ralph Nelson</span></div>`;
    bindRoutes($('studioRail'));
    $('studioFind').onclick=openLibrary;$('studioCourseGuide').onclick=()=>openCourseGuide(r.space);$('studioRail').querySelector('[data-course-guide]')?.addEventListener('click',()=>openCourseGuide(r.space));
    if($('studioNextAction'))$('studioNextAction').onclick=()=>{if(r.space==='terms')go(W.WoodProject.has(handles.glossary.term.lab)?'wood':'fundamentals',handles.glossary.term.lab);else if(r.space==='steel'){if($('steelScreen').querySelector('.sr-reading')){resourceOpen=true;sync();}else{const control=$('steelScreen').querySelector('.sr-picker button,.steel-aside input,.steel-aside select');control?.focus();control?.scrollIntoView({block:'nearest'});}}else api.setPanel('explain');};
    if($('studioBackToModel'))$('studioBackToModel').onclick=()=>{if(lastModelRoute.includes(':')){const [space,id]=lastModelRoute.split(':');go(space,id);}else go(W.WoodProject.has(lastModelRoute)?'wood':'fundamentals',lastModelRoute);};
    if($('studioConcreteScope'))$('studioConcreteScope').onclick=()=>openCourseGuide('concrete');
  }
  function openCourseGuide(space){api.dialog('Course sequence & evidence',W.StructureCourseGuide.html(space));$('dialog').querySelectorAll('[data-course-space]').forEach(b=>b.onclick=()=>{$('dialog').close();go(b.dataset.courseSpace,b.dataset.courseId);});}
  function openLibrary(){
    const original=D.querySelector('.sidebar #modules');
    api.dialog('Find a topic','<label class="studio-search-label">Search the complete course<input id="studioTopicSearch" type="search" placeholder="Try tributary, joist, floor, buckling…" autocomplete="off"></label><div id="studioTopicResults"></div><details class="studio-original-map"><summary>Original course navigation</summary><button id="studioOriginalSources">Open original lecture and source map</button><button id="studioOriginalHelp">How to use Structure Lab</button><div id="studioOriginalMap"></div></details>');
    $('studioOriginalSources').onclick=()=>api.courseMap();$('studioOriginalHelp').onclick=()=>api.help();
    // Course map is recreated with real navigation actions; the original navigation remains in the page.
    if(original){$('studioOriginalMap').innerHTML=original.innerHTML;$('studioOriginalMap').querySelectorAll('[data-module]').forEach(b=>b.onclick=()=>{$('dialog').close();go(W.WoodProject.has(b.dataset.module)?'wood':'fundamentals',b.dataset.module);});$('studioOriginalMap').querySelectorAll('[data-steel-lecture]').forEach(b=>b.onclick=()=>{$('dialog').close();go('steel','lecture'+b.dataset.steelLecture);});$('studioOriginalMap').querySelector('#coachNav')?.removeAttribute('id');$('studioOriginalMap').querySelector('.coach-nav')?.addEventListener('click',()=>{$('dialog').close();go('coach');});}
    const entries=[...terms.flatMap(([g,a])=>a.map(([id,name])=>({space:'terms',id,name,group:g}))),...W.LAB_MODULES.map(m=>({space:W.WoodProject.has(m.id)?'wood':'fundamentals',id:m.id,name:m.title,group:m.lecture})),...steelGroups.flatMap(([group,a])=>a.map(([id,name])=>({space:'steel',id,name,group}))),{space:'concrete',id:'materials',name:'Concrete behaviour',group:'Existing material model'},{space:'coach',id:'coach',name:'Structure Coach',group:'Explain & communicate'}];
    const draw=()=>{const q=$('studioTopicSearch').value.toLowerCase().trim(), found=entries.filter(x=>(x.name+' '+x.id+' '+x.group).toLowerCase().includes(q));$('studioTopicResults').innerHTML=found.length?found.map(x=>`<button class="studio-search-result" data-studio-space="${x.space}" data-studio-id="${esc(x.id)}"><strong>${esc(x.name)}</strong><span>${esc(spaceInfo[x.space][0])} / ${esc(x.group)}</span></button>`).join(''):'<p>No matching topic. Try a member name or a broader term.</p>';$('studioTopicResults').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('dialog').close();go(b.dataset.studioSpace,b.dataset.studioId);});};
    $('studioTopicSearch').oninput=draw;draw();$('studioTopicSearch').focus();
  }
  function arrangeGlossary(){
    const host=$('glossaryScreen'), visual=host.querySelector('.glossary-visual');
    if(!host.querySelector('.studio-term-tools')){
      const tools=D.createElement('div');tools.className='studio-term-tools';tools.innerHTML='<div role="group" aria-label="Term view"><button data-term-view="model">Building context</button><button data-term-view="diagram">Precise diagram</button></div><button id="studioTermCoach">Ask Coach about this term</button>';
      const stage=D.createElement('div');stage.className='studio-term-stage';visual.before(stage);stage.append(tools);
      const model=D.createElement('div');model.className='studio-term-model';model.innerHTML='<div class="studio-term-canvas"><canvas id="studioTermCanvas" tabindex="0" role="img" aria-label="Three-dimensional framing model. Select a beam, girder or column to learn its role. Drag to orbit; scroll to zoom."></canvas><span class="studio-canvas-label">CONTEXT MODEL · SCHEMATIC FRAMING</span></div><p class="studio-term-caption">Click a beam, girder or column to identify it. The controls open the <strong>Precise diagram</strong> for the selected term; they do not change this context model.</p>';
      stage.append(model,visual);
      stage.querySelectorAll('[data-term-view]').forEach(b=>b.onclick=()=>{data.termView=b.dataset.termView;sync();});
      $('studioTermCoach').onclick=()=>api.askCoach();
      termRenderer=new W.LabRenderer($('studioTermCanvas'),{onSelect:id=>{const term=/girder/i.test(id)?'girder':/column|col/i.test(id)?'column':/beam/i.test(id)?'beam':/slab|deck|panel/i.test(id)?'area':null;if(term){activity().changed=true;handles.glossary.choose(term,true);railSignature='';schedule();}}});
      termRenderer.mode='3d';termRenderer.projection='perspective';const scene=api.makeTermScene();termRenderer.setScene(scene.items,scene);
      const note=D.createElement('details');note.className='studio-term-notes';note.innerHTML='<summary>Keep an observation</summary><label for="studioTermNote">What did you change, and what did you learn?</label><textarea id="studioTermNote" rows="3" placeholder="Use the term, its units and the model’s assumptions."></textarea><small>Included in Save study.</small>';
      host.querySelector('.glossary-explanation').append(note);$('studioTermNote').oninput=e=>{activity().note=e.target.value.slice(0,12000);schedule();};
    }
    const diagram=data.termView==='diagram';visual.hidden=!diagram;host.querySelector('.studio-term-model').hidden=diagram;
    host.querySelectorAll('[data-term-view]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.termView==='diagram')===diagram)));
    const note=$('studioTermNote');if(D.activeElement!==note)note.value=activity('terms:'+handles.glossary.id).note||'';
    const open=host.querySelector('#glossaryOpenLab');open.textContent='Apply this in the model →';
    termRenderer?.resize();
  }
  function arrangePanel(){
    const p=$('panelContent');if(p.dataset.studioArranged==='yes'&&p.firstElementChild===arrangedPanelFirst)return;p.dataset.studioArranged='yes';
    if(api.getModel().tab==='model'){
      const direct=[...p.children], firstInput=direct.find(el=>el.matches('.learning-step,.control,.studio-field,.assignment-tabs'));
      const brief=direct.find(el=>el.classList.contains('project-brief'));
      if(brief){
        const box=D.createElement('details');box.className='studio-project-brief';
        const summary=D.createElement('summary'), choice=brief.querySelector('select'), loads=brief.querySelector('p');
        summary.innerHTML='<span>Shared project brief</span><strong>'+esc(choice?.selectedOptions?.[0]?.textContent||'Project conditions')+'</strong>'+(loads?'<small>'+esc(loads.textContent)+'</small>':'');
        brief.before(box);box.append(summary,brief);
      }
      // Move the existing bound nodes. Inputs, source evidence and export actions keep their original handlers.
      if(firstInput&&!p.querySelector('.studio-project-guidance')){
        const before=direct.slice(0,direct.indexOf(firstInput));
        const notes=before.filter(el=>el.matches('.panel-intro,.studio-note,.response-card:not(.warn)')||el.querySelector('#courseLinkRoof')||(['roof','truss'].includes(route().id)&&el.matches('.studio-actions')));
        if(notes.length){
          const guidance=D.createElement('details');guidance.className='studio-project-guidance';guidance.innerHTML='<summary>'+(W.WoodProject.has(route().id)?'Project notes, evidence & drawings':'How to use this model')+'</summary>';
          const end=p.querySelector(':scope > .unit-note');if(end)end.before(guidance);else p.append(guidance);
          notes.forEach(el=>guidance.append(el));
        }
      }
    }
    p.querySelectorAll('.panel-intro,.unit-note').forEach(el=>{el.classList.add('studio-secondary-copy');});
    p.querySelectorAll('.unit-note').forEach(el=>{el.textContent=el.textContent.replace('Full assumptions are listed in Explain.','Full assumptions are listed in Inspect.');});
    const analysis=$('labWorkspace').querySelector('.analysis-strip>span');if(analysis)analysis.textContent=analysis.textContent.replace('Analysis assumptions in Explain','Analysis assumptions in Inspect');
    arrangedPanelFirst=p.firstElementChild;
  }
  function arrangeSteel(){
    const host=$('steelScreen'), reading=host.querySelector('.sr-reading');
    host.classList.add('studio-steel');
    if(!host.querySelector('.studio-steel-tools')){
      const toolbar=D.createElement('div');toolbar.className='studio-steel-tools';toolbar.innerHTML='<span>SELECT → ADJUST → READ → EXPLAIN</span><div><button id="studioOpenSources">Sources & tools</button><button id="studioSteelReason">Keep my reasoning</button><button id="studioSteelCoach">Ask Coach</button></div>';
      const work=host.querySelector('.sr-work,.steel-layout');if(work)work.before(toolbar);else host.querySelector('header')?.after(toolbar);
      $('studioOpenSources').onclick=()=>{resourceOpen=!resourceOpen;sync();};
      $('studioSteelReason').onclick=()=>{const note=host.querySelector('.sr-reflect,.steel-note');if(note){note.open=true;note.scrollIntoView({block:'nearest'});note.querySelector('textarea')?.focus();}else{const aside=host.querySelector('.steel-aside,.sr-aside');aside?.scrollTo({top:aside.scrollHeight,behavior:'smooth'});}};
      $('studioSteelCoach').onclick=()=>api.askCoach();
    }
    const open=$('studioOpenSources');if(open){open.disabled=!reading;open.textContent=reading?(resourceOpen?'Close sources':'Sources & tools'):'Sources in this task';open.setAttribute('aria-expanded',String(resourceOpen&&!!reading));}
    const next=$('studioNextAction');if(next)next.textContent=reading?'Open source & tools':host.querySelector('.sr-picker')?'Choose the project below':'Try a model condition';
    if(reading){
      reading.classList.add('studio-source-drawer');reading.inert=!resourceOpen;reading.setAttribute('aria-hidden',String(!resourceOpen));
      if(!reading.querySelector('.studio-source-heading')){const bar=D.createElement('div');bar.className='studio-source-heading';bar.innerHTML='<div><span class="studio-eyebrow">REFERENCE WORKSPACE</span><strong>Original sources & calculation tools</strong><nav class="studio-reference-nav" aria-label="Reference sections"><button data-ref="document">PDF / source</button><button data-ref="calculator">Calculator</button><button data-ref="brief">Assignment</button></nav></div><button type="button" data-ref="close" aria-label="Close reference workspace">Back to model ×</button>';reading.prepend(bar);bar.querySelector('[data-ref="close"]').onclick=()=>{resourceOpen=false;sync();$('studioOpenSources')?.focus();};bar.querySelectorAll('[data-ref]:not([data-ref="close"])').forEach(button=>{const target=reading.querySelector(({document:'.sr-pdf-host,.sr-linked-tables',calculator:'.sn-calculator',brief:'.sr-project-brief'})[button.dataset.ref]);button.disabled=!target;button.onclick=()=>{if(target.tagName==='DETAILS')target.open=true;const box=reading.getBoundingClientRect(),rect=target.getBoundingClientRect();reading.scrollTop+=rect.top-box.top-bar.offsetHeight-12;};});}
    }
    host.classList.toggle('studio-sources-open',resourceOpen&&!!reading);
    // Keep the same bound form nodes; collapse reflection only after a real render.
    host.querySelectorAll('.sr-reflect').forEach(ref=>{if(ref.tagName==='DETAILS'||ref.parentElement.classList.contains('studio-reflection'))return;const box=D.createElement('details');box.className='studio-reflection';box.innerHTML='<summary>My reasoning & evidence</summary>';ref.before(box);box.append(ref);});
    host.querySelectorAll('.studio-reflection').forEach(box=>{if($('studioSteelReason'))$('studioSteelReason').onclick=()=>{box.open=true;box.scrollIntoView({block:'nearest'});box.querySelector('textarea')?.focus();};});
    const renderer=handles.steel.renderer||handles.steel.conceptLab?.renderer;
    if(renderer&&!renderer.studioSelection){renderer.studioSelection=true;const select=renderer.cb.onSelect;renderer.cb.onSelect=id=>{select?.(id);activity().changed=true;
      const lesson=handles.steel.state.lesson, foundation=W.SteelFoundation.isFoundation(lesson), floorId=String(id).startsWith('floor-'), sharedScene=handles.steel.floorState?.modelScope==='building', floor=floorId||(W.SteelFloor.isFloor(lesson)&&!sharedScene);
      const kind=/footing|pedestal/.test(id)?'footing':/column|support/.test(id)?'column':/girder/.test(id)?'girder':/joist/.test(id)?'joist':/beam/.test(id)?'beam':/deck|slab/.test(id)?'deck':null;
      const target=foundation&&/^(support|footing|pedestal):/.test(id)?(kind==='footing'?'foundation-footing':'foundation-column'):floor?({deck:'floor-deck',beam:'floor-beam',girder:'floor-girder',column:'floor-column'})[kind]:({deck:'deck-table',joist:'joist-table',girder:'girder-table',column:'foundation-grid'})[kind];
      memberSelection=kind?{id,kind,target}:null;renderer.selected=id;renderer.render();schedule();};}
    if(memberSelection&&host.querySelector('.sr-left')){
      let context=host.querySelector('.studio-object-context');if(!context){context=D.createElement('div');context.className='studio-object-context';host.querySelector('.sr-left').prepend(context);}
      context.innerHTML=`<span><small>SELECTED IN YOUR MODEL</small><strong>${esc(memberSelection.kind[0].toUpperCase()+memberSelection.kind.slice(1))}</strong></span>${memberSelection.target?'<button>Work on this member →</button>':''}`;
      context.querySelector('button')?.addEventListener('click',()=>go('steel',memberSelection.target));
    }
    renderer?.resize();
  }
  function arrangeCoach(){
    const host=$('coachScreen');if(!host.querySelector('.studio-coach-tools')){
    const bar=D.createElement('div');bar.className='studio-coach-tools';bar.innerHTML='<div><span class="studio-eyebrow">COMMUNICATE YOUR STRUCTURE</span><p>State the member, span, supports, loads and question. Attach model notes when they help.</p></div><button id="studioBriefToggle" aria-expanded="false">Calculation brief</button>';
    const grid=host.querySelector('.coach-grid');if(grid)grid.before(bar);else return;
    const panel=host.querySelector('.coach-draft-panel');const hasDraft=!!handles.coach.state.draft?.trim?.();host.classList.toggle('studio-brief-open',hasDraft);
    $('studioBriefToggle').setAttribute('aria-expanded',String(hasDraft));if(panel)panel.inert=!hasDraft;
    $('studioBriefToggle').onclick=()=>{const show=host.classList.toggle('studio-brief-open');if(panel)panel.inert=!show;$('studioBriefToggle').setAttribute('aria-expanded',String(show));};
    }
    host.querySelectorAll('.coach-update-record').forEach(el=>{if(el.tagName==='DETAILS'||el.closest('details'))return;const box=D.createElement('details');box.className='studio-coach-record';box.innerHTML='<summary>Prompt update record</summary>';el.before(box);box.append(el);});
  }
  function sync(){
    if(decorating)return;decorating=true;
    try{
      const r=route();activity(r.key);D.body.dataset.studioSpace=r.space;
      data.lastVisited[r.space]=r.id;
      if(r.space!=='coach')lastModelRoute=r.key;
      if(lastRoute!==r.key){resourceOpen=r.space==='steel'&&['deck-table','joist-table','girder-table','floor-deck','floor-beam','floor-girder','foundation-column','foundation-footing'].includes(r.id);memberSelection=null;lastRoute=r.key;D.body.classList.remove('studio-rail-open');$('studioTaskToggle').setAttribute('aria-expanded','false');}
      D.querySelectorAll('.studio-spaces [data-space]').forEach(b=>{const active=b.dataset.space===r.space;b.setAttribute('aria-current',active?'page':'false');});
      renderRail(r);
      if(r.space==='terms')arrangeGlossary();
      else if(r.space==='steel')arrangeSteel();
      else if(r.space==='coach')arrangeCoach();
      else {arrangePanel();D.querySelectorAll('#labInspector [data-tab]').forEach(b=>b.textContent=({model:'Adjust',explain:'Inspect',exercise:'Explain'})[b.dataset.tab]);const compare=D.querySelector('.studio-model-actions [data-action="compare"]');if(compare)compare.disabled=!data.activities[r.key]?.trial;const sources=D.querySelector('.studio-model-actions [data-action="sources"]');if(sources)sources.textContent=r.space==='wood'&&$('courseReferences')?'Sources & tables':'Sources & assumptions';const next=D.querySelector('.studio-model-actions [data-action="next"]');if(next){next.hidden=r.space!=='wood';next.textContent=({roof:'Next: Truss →',truss:'Next: Floor →',floor:'Next: Building →',building:'Explain your building →'})[r.id]||'';}}
    }finally{decorating=false;}
  }
  function wrap(obj,method){if(!obj||typeof obj[method]!=='function')return;const original=obj[method];obj[method]=function(...args){const result=original.apply(this,args);schedule();return result;};}
  buildShell();
  const originalRefresh=handles.steel.refreshReading?.bind(handles.steel);if(originalRefresh)handles.steel.refreshReading=(...args)=>{const scrollTop=$('steelScreen').querySelector('.sr-reading')?.scrollTop||0;const result=originalRefresh(...args);const reading=$('steelScreen').querySelector('.sr-reading');if(reading&&!reading.querySelector('.sr-project-brief'))reading.insertAdjacentHTML('afterbegin',(W.SteelProjectBrief?.html(handles.steel,1.1)||'')+handles.steel.assignmentGuide());requestAnimationFrame(()=>{if(reading?.isConnected)reading.scrollTop=scrollTop;});return result;};
  // Rendering stays owned by the original lessons. Reapply the layout when they replace their DOM.
  for(const method of ['render','renderFloor','renderFloorPicker','renderFoundation','refreshReading','renderBriefPicker','refreshAside'])wrap(handles.steel,method);
  for(const method of ['render','refreshAside'])wrap(handles.steel.conceptLab,method);
  wrap(handles.coach,'render');
  const chooseTerm=handles.glossary.choose.bind(handles.glossary);handles.glossary.choose=(id,...args)=>{data.termView=['beam','girder','column','bay','path','member'].includes(id)?'model':'diagram';const result=chooseTerm(id,...args);schedule();return result;};
  const changeTerm=handles.glossary.change.bind(handles.glossary);handles.glossary.change=(...args)=>{data.termView='diagram';activity('terms:'+handles.glossary.id).changed=true;const result=changeTerm(...args);schedule();return result;};
  handles.glossary.choose('beam');
  // RenderPanel replaces the children but not its root; reset the one-time grouping marker.
  const panelObserver=new MutationObserver(records=>{if(records.some(r=>r.target===$('panelContent')&&r.addedNodes.length)&&$('panelContent').firstElementChild!==arrangedPanelFirst)schedule();});
  panelObserver.observe($('panelContent'),{childList:true});
  W.StructureStudio={
    sync:schedule,
    getData(){return {...data,glossary:{term:handles.glossary.id,values:handles.glossary.values},lastModelRoute};},
    restore(raw){data={version:1,activities:{},lastVisited:{},concrete:false,termView:'model'};lastModelRoute='fundamentals:loads';handles.glossary.values={};chooseTerm('beam');if(raw&&typeof raw==='object'){
      data.concrete=raw.concrete===true;data.termView=raw.termView==='diagram'?'diagram':'model';
      const valid=new Set([...terms.flatMap(g=>g[1].map(x=>'terms:'+x[0])),...steelGroups.flatMap(g=>g[1].map(x=>'steel:'+x[0])),...W.LAB_MODULES.map(x=>(W.WoodProject.has(x.id)?'wood':'fundamentals')+':'+x.id),'concrete:materials','coach:coach']);
      for(const [space,id]of Object.entries(raw.lastVisited||{})){if(valid.has(space+':'+id))data.lastVisited[space]=id;}
      for(const [key,value]of Object.entries(raw.activities||{})){if(valid.has(key)&&value&&typeof value==='object')data.activities[key]={visited:true,changed:value.changed===true,note:typeof value.note==='string'?value.note.slice(0,12000):''};}
      const termIds=terms.flatMap(g=>g[1].map(x=>x[0]));
      if(raw.glossary?.values&&typeof raw.glossary.values==='object'){for(const id of termIds){const value=raw.glossary.values[id];if(value&&typeof value==='object'){chooseTerm(id);for(const c of handles.glossary.term.controls){const v=value[c.key];if(c.type==='choice'){if(c.options.some(o=>o[0]===v))changeTerm(c.key,v);}else if(typeof v==='number'&&Number.isFinite(v))changeTerm(c.key,Math.min(c.max,Math.max(c.min,v)));}}}}
      chooseTerm(termIds.includes(raw.glossary?.term)?raw.glossary.term:'beam');
      if(typeof raw.lastModelRoute==='string'&&raw.lastModelRoute!=='coach:coach'&&(valid.has(raw.lastModelRoute)||W.LAB_MODULES.some(x=>x.id===raw.lastModelRoute)))lastModelRoute=raw.lastModelRoute;
    }railSignature='';lastRoute='';schedule();},
    go,inventory:{terms:terms.flatMap(g=>g[1].map(x=>x[0])),modules:W.LAB_MODULES.map(x=>x.id),steel:steelGroups.flatMap(g=>g[1].map(x=>x[0]))}
  };
  sync();
})(window);
