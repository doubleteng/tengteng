(function (W, D) {
  'use strict';
  const {questions, priority, files} = W.ExamReviewData;
  const parts = [['priority','Priority review'],['guide','Exam 1 answer guide'],['practice','ARE structures practice']];
  const ids = {
    priority: priority.map(row => row.id),
    guide: Object.keys(questions).filter(id => questions[id].part === 2),
    practice: Object.keys(questions).filter(id => questions[id].part === 3)
  };
  const priorityById = Object.fromEntries(priority.map(row => [row.id,row]));
  const root = D.getElementById('examScreen'), chat = D.getElementById('examCoachScreen');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const own = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const displayId = id => id.replace(/^ARE/,'ARE ');
  const partNumber = () => 1 + parts.findIndex(([id]) => id === state.part);
  const cleanState = () => ({part:'priority',selected:{priority:'Q74',guide:'Q01',practice:'ARE01'},attempts:{},threads:{}});
  let state = cleanState(), filter = '', group = '', resumeChat = false, epoch = 0;
  const pending = new Set(), errors = new Map();
  const current = () => questions[state.selected[state.part]];
  const record = id => state.attempts[id] || (state.attempts[id] = {choices:[],text:'',revealed:false});
  const thread = id => state.threads[id] || (state.threads[id] = {messages:[],draft:''});
  const pdf = (part,page) => 'exam/'+files[part]+(page?'#page='+page:'');
  const pdfLink = (part,page,label) => '<a class="xr-link" target="_blank" rel="noopener" href="'+pdf(part,page)+'">'+escape(label)+'</a>';
  function setPart(id) {
    if(own(ids,id) && state.part !== id){state.part=id;filter='';group='';}
  }
  function show(id) {
    setPart(id); render();
  }
  function select(id,part=state.part) {
    if(!ids[part]?.includes(id))return;
    setPart(part);state.selected[part]=id;render();
    root.querySelector('.xr-detail').scrollTop=0;
    root.querySelector('.xr-question-title')?.focus({preventScroll:true});
  }
  function groupFor(id) {
    if(state.part==='priority') return priorityById[id].group;
    if(state.part==='practice')return '';
    if(!id.startsWith('Q'))return 'Optional calculations';
    return 'Lecture '+(Math.floor((Number(id.slice(1))-1)/15)+1);
  }
  function filtered() {
    const terms=filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return ids[state.part].filter(id=>{
      if(group && group!==groupFor(id))return false;
      const q=questions[id], search=[id,displayId(id),q.title,q.stem,priorityById[id]?.review].join(' ').toLowerCase();
      return terms.every(t=>search.includes(t));
    });
  }
  function renderList() {
    const found=filtered(), active=current().id;
    root.querySelector('#xr-count').textContent=found.length+' '+(found.length===1?'question':'questions');
    root.querySelector('#xr-results').innerHTML=found.length?found.map(id=>{
      const q=questions[id], selected=active===id;
      return '<button type="button" class="xr-item" data-question="'+id+'" '+(selected?'aria-current="page"':'')+'><span class="xr-id">'+displayId(id)+'</span><span>'+escape(q.title)+'</span></button>';
    }).join(''):'<p class="xr-muted">No matching questions.</p>';
    const chooser=root.querySelector('#xr-mobile-select');
    chooser.innerHTML=found.map(id=>'<option value="'+id+'" '+(id===active?'selected':'')+'>'+displayId(id)+' · '+escape(questions[id].title)+'</option>').join('');
    if(!found.includes(active))chooser.selectedIndex=-1;
  }
  function render() {
    const q=current(), p=partNumber(), pr=priorityById[q.id], a=record(q.id), part=state.part;
    const groups=[...new Set(ids[part].map(groupFor).filter(Boolean))];
    const captions = {priority:'These 30 questions are grouped by topic and ordered by the share of students who earned full credit. Exam 2 draws 15 of its 25 questions from this list.',guide:'Look up the original Exam 1 question number. The guide also includes the optional beam and girder calculations.',practice:'Work through each scenario, then compare your reasoning with the course explanation.'};
    const previousScroll = root.querySelector('#xr-results')?.scrollTop || 0;
    const multi = q.options?.filter(o=>o.correct).length>1;
    const entry = q.options ? '<fieldset class="xr-options"><legend>'+ (multi?'Select all that apply':'Select one answer')+'</legend>'+q.options.map(o=>'<label><input type="'+(multi?'checkbox':'radio')+'" name="xr-choice" value="'+o.letter+'" '+(a.choices.includes(o.letter)?'checked':'')+'><b>'+o.letter+'</b><span>'+escape(o.label)+'</span></label>').join('')+'</fieldset>' : '<label class="xr-write">Your response<textarea id="xr-attempt" rows="2" maxlength="900" placeholder="Write your answer or trace the load path.">'+escape(a.text)+'</textarea></label>';
    const isPriority = part === 'priority';
    const priorityMeta = isPriority
      ? '<div class="xr-priority"><div><span>'+escape(pr.group)+'</span><span>'+escape(pr.rate)+' earned full credit on Exam 1</span></div></div>'
      : '';
    const checkButton = isPriority
      ? (multi ? '<button class="xr-secondary" data-action="check-priority" '+(a.choices.length ? '' : 'disabled')+'>Check answer</button>' : '')
      : '<button class="xr-secondary" data-action="reveal">'+(a.revealed?'Hide explanation':'Check answer & reasoning')+'</button>';
    const feedback = isPriority
      ? '<div id="xr-priority-feedback" aria-live="polite">'+priorityFeedback(q,a)+'</div>'
      : (a.revealed ? explanation(q,a) : '');
    const guideLink = isPriority ? '<button class="xr-link" data-action="guide">Open '+q.id+' in answer guide</button>' : '';
    root.innerHTML='<div class="xr-shell"><header class="xr-header"><div><span class="xr-kicker">ARC 2713 &nbsp; / &nbsp; Fall 2026</span><h1>Exam 2 Review</h1></div><nav aria-label="Exam review materials" class="xr-tabs">'+parts.map(([id,label],i)=>'<button data-part="'+id+'" '+(id===part?'aria-current="page"':'')+'><small>Part '+(i+1)+'</small>'+escape(label)+'</button>').join('')+'</nav></header><div class="xr-body"><aside class="xr-index"><div class="xr-tools"><label>Find a question<input type="search" id="xr-search" placeholder="Question number or topic" value="'+escape(filter)+'"></label>'+(groups.length?'<label>Chapter<select id="xr-group"><option value="">All chapters</option>'+groups.map(g=>'<option '+(g===group?'selected':'')+'>'+escape(g)+'</option>').join('')+'</select></label>':'')+'<span id="xr-count" class="xr-kicker" aria-live="polite"></span><label class="xr-mobile">Question<select id="xr-mobile-select"></select></label></div><div id="xr-results"></div><div class="xr-index-foot">'+pdfLink(p,null,'Open Part '+p+' PDF')+'</div></aside><article class="xr-detail"><div class="xr-content"><div class="xr-meta"><span>Part '+p+' / '+escape(parts[p-1][1])+'</span><span>'+displayId(q.id)+'</span></div><h2 class="xr-question-title" tabindex="-1">'+escape(q.title)+'</h2>'+priorityMeta+'<p class="xr-stem">'+escape(q.stem)+'</p>'+figures(q)+entry+'<div class="xr-actions">'+checkButton+'<button class="xr-primary" data-action="coach">Ask Structure Coach</button></div>'+feedback+'<footer class="xr-source">'+pdfLink(p,part==='priority'?pr.page:q.page,'Original PDF · p. '+(part==='priority'?pr.page:q.page))+guideLink+'<div>'+pager()+'</div></footer><p class="xr-footnote">'+captions[part]+'</p></div></article></div></div>';
    renderList();root.querySelector('#xr-results').scrollTop=previousScroll;
  }
  function figures(q) {
    if(!q.figs.length)return '';
    return '<div class="xr-figures">'+q.figs.map((file,i)=>'<a href="exam/figures/'+escape(file)+'" target="_blank" rel="noopener" title="Open figure at full size"><img src="exam/figures/'+escape(file)+'" alt="'+escape(q.title+' — course figure '+(i+1))+'"></a>').join('')+'</div>';
  }
  function priorityFeedback(q,a) {
    if (!a.revealed || !a.choices.length) return '';
    const chosen = new Set(a.choices);
    const correct = q.options.filter(option => option.correct).map(option => option.letter);
    const matched = q.options.every(option => chosen.has(option.letter) === option.correct);
    const items = q.options.map(option => {
      const selected = chosen.has(option.letter);
      const status = selected
        ? (option.correct ? 'Correctly selected' : 'Incorrectly selected')
        : (option.correct ? 'Missed correct choice' : 'Correctly left out');
      return '<li><b>'+escape(option.letter)+' · '+status+'</b><p>'+escape(option.reason)+'</p></li>';
    }).join('');
    return '<section class="xr-explanation xr-graded" data-result="'+(matched?'correct':'incorrect')+'"><h3>'+
      (matched?'Correct.':'Incorrect.')+'</h3><p>Your selection: <b>'+escape(a.choices.join(', '))+
      '</b> · Correct answer: <b>'+escape(correct.join(', '))+'</b></p><ul>'+items+
      '</ul><p class="xr-review-note"><b>Review note</b> '+escape(priorityById[q.id].review)+'</p></section>';
  }
  function updatePriorityFeedback(q,attempt) {
    root.querySelector('#xr-priority-feedback').innerHTML = priorityFeedback(q,attempt);
    const check = root.querySelector('[data-action="check-priority"]');
    if (check) check.disabled = !attempt.choices.length;
  }
  function explanation(q,a) {
    const checked=a.choices.length && q.options, matches=checked && q.options.every(o=>o.correct===a.choices.includes(o.letter));
    const feedback=checked?'<strong>'+(matches?'Your selection matches the guide.':'Compare your selection with the guide.')+'</strong>':'';
    const body=q.options?.some(o=>o.reason)?'<ul>'+q.options.map(o=>'<li><b>'+o.letter+' · '+(o.correct?'Correct':'Incorrect')+'</b> '+escape(o.reason)+'</li>').join('')+'</ul>':'<p>'+escape(q.answer)+'</p>';
    return '<section class="xr-explanation" aria-live="polite"><h3>Answer & reasoning</h3>'+feedback+body+'</section>';
  }
  function pager() {
    const list=filtered(), ix=list.indexOf(current().id);
    return '<button data-step="-1" '+(ix<=0?'disabled':'')+'>Previous</button><button data-step="1" '+(ix<0||ix===list.length-1?'disabled':'')+'>Next</button>';
  }
  root.addEventListener('click', e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.part){setPart(b.dataset.part);W.StructureStudio.go('exam',state.part);return;}
    if(b.dataset.question)select(b.dataset.question);
    if(b.dataset.step){const list=filtered();select(list[list.indexOf(current().id)+Number(b.dataset.step)]);}
    if(b.dataset.action==='guide'){select(current().id,'guide');W.StructureStudio.sync();}
    if(b.dataset.action==='check-priority'){
      const q=current(), attempt=record(q.id);
      if(!attempt.choices.length)return;
      attempt.revealed=true;
      updatePriorityFeedback(q,attempt);
      root.querySelector('#xr-priority-feedback h3')?.scrollIntoView({block:'nearest'});
    }
    if(b.dataset.action==='reveal'){const a=record(current().id);a.revealed=!a.revealed;const sc=root.querySelector('.xr-detail').scrollTop;render();root.querySelector('.xr-detail').scrollTop=sc;if(a.revealed)root.querySelector('.xr-explanation')?.scrollIntoView({block:'nearest'});}
    if(b.dataset.action==='coach')discuss();
  });
  root.addEventListener('input', e=>{
    if(e.target.id==='xr-search'){filter=e.target.value;renderList();root.querySelector('.xr-source div').innerHTML=pager();}
    if(e.target.id==='xr-attempt')record(current().id).text=e.target.value;
  });
  root.addEventListener('change', e=>{
    if(e.target.name==='xr-choice'){
      const a=record(current().id);a.choices=[...root.querySelectorAll('[name=xr-choice]:checked')].map(x=>x.value);
      if(state.part==='priority'){
        a.revealed=e.target.type==='radio' && a.choices.length>0;
        updatePriorityFeedback(current(),a);
        return;
      }
      if(a.revealed){a.revealed=false;root.querySelector('.xr-explanation')?.remove();root.querySelector('[data-action=reveal]').textContent='Check answer & reasoning';}
    }
    if(e.target.id==='xr-group'){group=e.target.value;renderList();root.querySelector('.xr-source div').innerHTML=pager();}
    if(e.target.id==='xr-mobile-select')select(e.target.value);
  });
  function discuss() {
    W.StructureStudio.go('coach');
    D.body.classList.add('exam-discussing');chat.hidden=false;renderChat();
    chat.querySelector('textarea').focus({preventScroll:true});
  }
  function renderChat() {
    const q=current(), t=thread(q.id), a=record(q.id);
    const source=pdfLink(q.part,q.page,'Part '+q.part+' · p. '+q.page);
    chat.innerHTML='<div class="xr-chat"><header><div><span class="xr-kicker">Structure Coach / Exam discussion</span><h1>'+displayId(q.id)+' · '+escape(q.title)+'</h1></div><button class="xr-secondary" data-chat="back">Return to question</button></header><div class="xr-chat-body"><aside><h2>Question reference</h2><p>'+escape(q.stem)+'</p>'+figures(q)+(q.options?'<ol class="xr-reference-options">'+q.options.map(o=>'<li><b>'+o.letter+'.</b> '+escape(o.label)+'</li>').join('')+'</ol>':'')+(a.choices.length||a.text?'<p><b>Your response</b> '+escape(a.choices.join(', ')||a.text)+'</p>':'')+source+'</aside><section><div class="xr-log" role="log" aria-label="Question discussion" aria-live="polite">'+(t.messages.length?t.messages.map(m=>'<div class="xr-bubble"><b>'+(m.role==='student'?'You':'Structure Coach')+'</b><p>'+escape(m.text)+'</p></div>').join(''):'<p class="xr-muted">Ask about a diagram, a choice, or a step in the reasoning. The question and the course explanation travel with your message.</p>')+(pending.has(q.id)?'<p role="status">Structure Coach is responding…</p>':'')+'</div><form id="xr-chat-form"><label>Ask a follow-up<textarea maxlength="1200" rows="3" placeholder="Which part of the question would you like to discuss?">'+escape(t.draft)+'</textarea></label><div class="xr-actions"><button class="xr-primary" type="submit" '+(pending.has(q.id)?'disabled':'')+'>Send to Coach</button><button class="xr-secondary" type="button" data-chat="source">Read course explanation</button></div><p role="status" class="xr-chat-error">'+escape(errors.get(q.id)||'')+'</p></form></section></div></div>';
    const log=chat.querySelector('.xr-log');log.scrollTop=log.scrollHeight;
  }
  function context(q) {
    const rows=[];
    function add(label,text) {
      const words=String(text||'').split(/\s+/);let chunk='';
      for(const word of words){
        if((chunk+' '+word).length>175 && chunk){rows.push({label,value:chunk,unit:''});chunk='';}
        chunk=chunk?chunk+' '+word:word;
      }
      if(chunk)rows.push({label,value:chunk,unit:''});
    }
    add('Question',q.stem);
    if(q.options)add('Options',q.options.map(o=>o.letter+'. '+o.label).join(' '));
    add('Source',parts[q.part-1][1]+', page '+q.page+'. '+(q.figs.length?'Use the course description to interpret the figure. The figure pixels are not attached.':''));
    const a=record(q.id);add('Student attempt',a.choices.join(', ')||a.text);
    add('Course answer & reasoning',q.answer);
    for(const o of q.options||[])if(!o.correct&&o.reason)add('Choice '+o.letter,o.reason);
    if(priorityById[q.id])add('Priority review',priorityById[q.id].review);
    return {module:'exam-review',selected:q.id,title:displayId(q.id)+' · '+q.title,confirmed:true,note:'Use the course explanation. Answer directly and end with the reasoning or result. Ask a focused question only when a missing detail changes the answer or the student requests guided practice. For a hint, give the next step and leave the answer undisclosed.',rows};
  }
  async function send() {
    const q=current(), id=q.id, t=thread(id), message=t.draft.trim(), generation=epoch;
    if(!message||pending.has(id))return;
    const coach=W.StructureLabUI.getHandles().coach;
    const history=t.messages.slice(-4).map(m=>({role:m.role,text:m.text.slice(0,600)}));
    pending.add(id);errors.delete(id);t.messages.push({role:'student',text:message});t.draft='';renderChat();
    try {
      const response=await fetch(coach.endpoint+'/coach',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(110000),body:JSON.stringify({project:'fundamentals',task:'conversation',focus:'I04',message,draft:'',history,context:context(q),clientId:coach.clientId,requestId:crypto.randomUUID(),classCode:coach.classCode||'',stream:false})});
      let result;
      try {result=await response.json();} catch {throw Error('The course service returned an unreadable reply.');}
      if(!response.ok||!result?.ok||!result.reply?.text)throw Error(result?.message||'The course service could not complete this reply.');
      if(generation===epoch)t.messages.push({role:'coach',text:result.reply.text});
    } catch(err) {
      if(generation===epoch){
        t.messages.pop();if(!t.draft)t.draft=message;
        errors.set(id,(err.message==='Failed to fetch'?'The live Coach could not be reached from this page.':err.message)+' Your question is saved here. You can retry or open the course explanation.');
      }
    } finally {
      if(generation===epoch){pending.delete(id);if(!chat.hidden && current().id===id)renderChat();}
    }
  }
  chat.addEventListener('input',e=>{if(e.target.tagName==='TEXTAREA')thread(current().id).draft=e.target.value;});
  chat.addEventListener('submit',e=>{e.preventDefault();send();});
  chat.addEventListener('click',e=>{
    const action=e.target.closest('[data-chat]')?.dataset.chat;
    if(action==='back')W.StructureStudio.go('exam',state.part);
    if(action==='source'){
      const q=current();record(q.id).revealed=true;select(q.id,q.part===2?'guide':'practice');W.StructureStudio.go('exam',state.part);
      root.querySelector('.xr-explanation')?.scrollIntoView({block:'nearest'});
    }
  });
  function restore(raw) {
    epoch++;pending.clear();errors.clear();state=cleanState();filter='';group='';resumeChat=false;
    if(!raw||typeof raw!=='object')return;
    setPart(raw.part);
    for(const part of Object.keys(ids))if(ids[part].includes(raw.selected?.[part]))state.selected[part]=raw.selected[part];
    for(const q of Object.values(questions)){
      const a=raw.attempts?.[q.id],t=raw.threads?.[q.id];
      if(a)state.attempts[q.id]={choices:(q.options||[]).filter(o=>Array.isArray(a.choices)&&a.choices.includes(o.letter)).map(o=>o.letter),text:typeof a.text==='string'?a.text.slice(0,900):'',revealed:a.revealed===true};
      if(t)state.threads[q.id]={draft:typeof t.draft==='string'?t.draft.slice(0,1200):'',messages:(Array.isArray(t.messages)?t.messages:[]).filter(m=>m&&['student','coach'].includes(m.role)&&typeof m.text==='string').slice(-40).map(m=>({role:m.role,text:m.text.slice(0,3000)}))};
    }
    resumeChat=raw.discussing===true;
  }
  W.ExamReview={parts,show,discuss,restore,get part(){return state.part;},get wasDiscussing(){return resumeChat;},getData:()=>({...state,discussing:!chat.hidden})};
})(window,document);
