/* Shared floor framing from the ARE practice plan. Model coordinates are in feet. */
(function (W, D) {
  'use strict';
  const initial = {
    ARE02:'whole', ARE03:'bay', ARE04:'opening', ARE06:'bay', ARE11:'whole',
    ARE12:'glazing', ARE14:'bay', ARE15:'column', ARE16:'whole', ARE20:'girder'
  };
  const views = {whole:'Whole frame',bay:'Typical bay',opening:'Floor openings',glazing:'Glazed perimeter bays',column:'Compare columns',girder:'Compare girders'};
  const openings = [
    {label:'G1 · near 1D', x:0, end:20, z:65, far:75, header:65, id:'G1'},
    {label:'G2 · near 5A', x:100, end:120, z:0, far:10, header:10, id:'G2'},
    {label:'Opening near 5D', x:110, end:120, z:65, far:75, header:65, id:'5D header'}
  ];
  const rows='ABCD', level=13, roof=26;
  const colors={column:'#dbe2e5',beam:'#80c7ef',girder:'#edba78',deck:'#94d7be',mark:'#fff092',guide:'#dae6ea'};
  const compareColumns=['1A','2D','3C','5D'];
  const compareGirders=['1A–2A','4B–5B','3C–4C','2D–3D'];
  const traceText=['','1 · Deck. Follow one strip between adjacent floor beams.',
    '2 · Beam. Follow the 25 ft span to its two supporting girders.',
    '3 · Girder. Beam end reactions enter at the beam-to-girder joints. The girder spans between columns.',
    '4 · Column. The girder end reactions continue down the columns toward the foundations.'];
  function grid(x,z){return String(1+x/30)+rows[z/25];}
  function currentBounds(s){
    if(s.focus==='bay')return [60,90,25,50];
    if(s.focus==='opening')return [[0,30,50,75],[90,120,0,25],[90,120,50,75]][s.opening];
    return [0,120,0,75];
  }
  function makeScene(s){
    const [left,right,back,front]=currentBounds(s);
    const items=[],marks=[],details=new Map();
    const local=right-left===30, typical=s.focus==='bay', opening=s.focus==='opening';
    const line=(a,b,color,width=1,dash)=>items.push({type:'line',a,b,color,width,dash});
    const arrow=(a,b)=>items.push({type:'arrow',a,b,color:colors.mark,width:2.8});
    const tag=(p,text,kind='grid')=>marks.push({p,text,kind});
    function member(id,a,b,width,depth,color,description,wide=false){
      details.set(id,description);
      const solid=(p,q,w,h)=>items.push({type:'beam',a:p,b:q,w,h,color,id});
      if(!wide){solid(a,b,width,depth);return;}
      const flange=.13, lift=(p,dy)=>[p[0],p[1]+dy,p[2]];
      for(const sign of [-1,1])solid(lift(a,sign*(depth-flange)/2),lift(b,sign*(depth-flange)/2),width,flange);
      solid(a,b,.15,depth-2*flange);
    }
    function deck(x0,x1,z0,z1,id){
      const strip=id==='tributary',h=s.view==='plan'?level-2.1+(strip?.08:0):level+(strip?.23:.11);
      items.push({type:'poly',id,points:[[x0,h,z0],[x0,h,z1],[x1,h,z1],[x1,h,z0]],color:strip?colors.mark:colors.deck,edges:false});
      details.set(id,'Composite metal deck · supported on adjacent floor beams.');
    }
    const visibleOpenings=openings.filter(o=>o.x>=left&&o.end<=right&&o.z>=back&&o.far<=front);
    for(let x=left;x<=right;x+=30)for(let z=back;z<=front;z+=25){
      const name=grid(x,z), highlight=s.focus==='column'&&name===s.column;
      const baseColor=highlight||typical&&s.step===4&&z===back?colors.mark:colors.column;
      member(name,[x,0,z],[x,level,z],local?.88:1.15,local?.88:1.15,baseColor,'Column '+name+' · grid '+name[0]+' meets line '+name[1]+'.');
      if(s.roof&&!local&&s.view!=='plan'){
        // Upper columns and only the roof perimeter are shown; no roof framing plan is given.
        member(name,[x,level,z],[x,roof,z],.58,.58,baseColor,details.get(name));
      }
      if(s.view==='plan')items.push({type:'node',id:name,p:[x,level+.4,z],color:baseColor});
      if(highlight)tag([x,level+1,z],name,'selected');
    }
    for(let z=back;z<=front;z+=25)for(let x=left;x<right;x+=30){
      const name=grid(x,z)+'–'+grid(x+30,z);
      const selected=s.focus==='girder'&&name===s.girder;
      member(name,[x,level-.95,z],[x+30,level-.95,z],.84,1.9,selected||typical&&s.step===3&&z===back?colors.mark:colors.girder,
        'Girder '+name+' · 30 ft between column centerlines.',local);
      if(selected)tag([x+15,level+1,z],name,'selected');
    }
    for(let x=left;x<=right;x+=10)for(let z=back;z<front;z+=25){
      let a=z,b=z+25;
      for(const o of visibleOpenings)if(x>o.x&&x<o.end){
        if(o.z===a)a=o.far;
        if(o.far===b)b=o.z;
      }
      const id='beam-'+x+'-'+z, sample=typical&&x===70&&s.step===2;
      member(id,[x,level-.65,a],[x,level-.65,b],.62,1.3,sample?colors.mark:colors.beam,
        'Floor beam · '+(b-a)+' ft span'+(b-a===25?' between girder lines.':' to the opening header.'),local);
    }
    for(const o of visibleOpenings){
      member(o.id,[o.x,level-.8,o.header],[o.end,level-.8,o.header],.8,1.6,opening?colors.mark:colors.girder,
        o.id+' · '+(o.end-o.x)+' ft header along the floor opening.',local);
      if(opening||s.focus==='whole')tag([(o.x+o.end)/2,level+1,o.header],o.id==='5D header'?'Opening':o.id,'opening');
    }
    if(s.fullDeck){
      // Tile at each opening boundary so no surface or rib bridges a void.
      const depths=[back,front,...visibleOpenings.flatMap(o=>[o.z,o.far])];
      const zs=[...new Set(depths)].sort((a,b)=>a-b);
      for(let x=left;x<right;x+=10)for(let i=1;i<zs.length;i++){
        const z=zs[i-1],end=zs[i];
        if(visibleOpenings.some(o=>x>=o.x&&x<o.end&&z>=o.z&&end<=o.far))continue;
        deck(x,x+10,z,end,'floor-deck');
        if(local)for(let rib=z+1;rib<end;rib+=2)line([x,level+.15,rib],[x+10,level+.15,rib],'#57978a',1);
      }
    }else if(typical||s.focus==='whole'){
      deck(70,80,32,40,'deck-strip');
      for(let z=32;z<=40;z+=1)line([70,level+.16,z],[80,level+.16,z],'#5f9e91',1);
    }
    if(typical){
      // Extension lines and dimension labels refer to member centerlines.
      function dimension(a,b,label,axis){
        line(a,b,colors.guide,1.35);
        for(const pt of [a,b]){
          const tip=axis==='x'?[0,0,.65]:[.65,0,0];
          line(pt.map((v,i)=>v-tip[i]),pt.map((v,i)=>v+tip[i]),colors.guide,1.4);
        }
        tag(a.map((v,i)=>(v+b[i])/2),label,'dimension');
      }
      dimension([60,level+1,53],[90,level+1,53],'30 ft','x');
      dimension([93,level+1,25],[93,level+1,50],'25 ft','z');
      dimension([70,level+1.8,21],[80,level+1.8,21],'10 ft o.c.','x');
      if(s.tributary){
        deck(65,75,25,50,'tributary');
        details.set('tributary','Tributary strip · half the distance to the next beam on either side.');
        for(const x of [65,75])line([x,level+.3,25],[x,level+.3,50],colors.mark,2.5,[4,3]);
        line([70,level+.32,25],[70,level+.32,50],colors.beam,2.3);
        tag([70,level+.5,44],'5 ft + 5 ft','dimension');
      }
      if(s.step===1){arrow([75,level+1.3,36],[70,level+1.3,36]);arrow([75,level+1.3,36],[80,level+1.3,36]);}
      if(s.step===2){arrow([70,level+1.3,37.5],[70,level+1.3,25]);arrow([70,level+1.3,37.5],[70,level+1.3,50]);}
      if(s.step===3){arrow([72,level+1.5,25],[60,level+1.5,25]);arrow([77,level+1.5,25],[90,level+1.5,25]);}
      if(s.step===4)for(const x of [60,90])arrow([x+1.1,level-1,25],[x+1.1,1,25]);
    }
    if(s.roof&&!local&&s.view!=='plan')for(const [a,b] of [[[0,0],[120,0]],[[0,75],[120,75]],[[0,0],[0,75]],[[120,0],[120,75]]]){
      line([a[0],roof,a[1]],[b[0],roof,b[1]],'#cbd9e0',1.4,[6,4]);
    }
    if(s.focus==='glazing')for(const x of [0,120]){
      const o=x===0?-.6:.6;
      const loop=[[x+o,.35,25],[x+o,.35,50],[x+o,level-.75,50],[x+o,level-.75,25]];
      loop.forEach((p,i)=>line(p,loop[(i+1)%4],colors.mark,2.5));
      tag([x,level+2,37.5],x===0?'1B–1C':'5B–5C','selected');
    }
    for(let x=left;x<=right;x+=30)tag([x,level,front+(local?5:8)],String(1+x/30));
    for(let z=back;z<=front;z+=25)tag([left-(local?3:7),level,z],rows[z/25]);
    const limits=[];
    for(const x of [left,right])for(const z of [back,front])for(const y of [0,s.roof&&!local?roof:level])limits.push([x,y,z]);
    limits.push(...marks.map(m=>m.p));
    return {items,marks,details,limits,center:[(left+right)/2,local?9:13,(back+front)/2],extent:local?54:146};
  }

  class OfficeRenderer extends W.LabRenderer{
    applyDisplay(){this.xray=false;this.materials=false;}
    resize(){if(this.canvas.parentElement?.clientWidth>0&&this.canvas.parentElement?.clientHeight>0)super.resize();}
    fitScene(scene){
      this.center=[...scene.center];this.extent=scene.extent;this.pan=[0,0];this.fitPending=false;
      const box=()=>{
        const pts=scene.limits.map(p=>this.project(p));
        if(pts.some(p=>!p.visible))return null;
        return [Math.min(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.y))];
      };
      let low=.3,high=4;
      for(let i=0;i<14;i++){
        this.zoom=(low+high)/2;
        const b=box();
        if(b&&b[1]-b[0]<this.w-64&&b[3]-b[2]<this.h-46)low=this.zoom;else high=this.zoom;
      }
      this.zoom=low;
      const b=box();if(b)this.pan=[(this.w-b[0]-b[1])/2,(this.h-b[2]-b[3])/2];
    }
    render(){
      if(!this.canvas.isConnected||!this.canvas.parentElement?.clientWidth)return;
      super.render();
      if(!this.marks)return;
      const c=this.ctx,occupied=[];
      c.save();c.font='600 12px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';
      for(const {p,text,kind} of this.marks){
        const q=this.project(p),w=c.measureText(text).width+10,h=18;
        if(!q.visible||q.x<w/2||q.x>this.w-w/2||q.y<h/2||q.y>this.h-h/2)continue;
        if(occupied.some(b=>Math.abs(q.x-b.x)<(w+b.w)/2+1&&Math.abs(q.y-b.y)<h))continue;
        occupied.push({x:q.x,y:q.y,w});
        c.fillStyle=kind==='selected'||kind==='opening'?'#ffedaf':kind==='dimension'?'#e6f3f7':'#253239';
        c.fillRect(q.x-w/2,q.y-h/2,w,h);c.fillStyle=kind==='grid'?'#f4f7f8':'#20303a';c.fillText(text,q.x,q.y+.5);
      }
      c.restore();
    }
  }
  const options = list => list.map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('');
  function guide(s){
    if(s.focus==='bay'){
      if(s.step)return traceText[s.step];
      if(s.tributary)return 'The shaded strip reaches halfway to the next beam on each side. Measure its width across the beams.';
      return 'Bay 3–4 / B–C. Each beam spans 25 ft. The 10 ft spacing is measured from one beam centerline to the next.';
    }
    if(s.focus==='opening')return s.opening===0?'At 1D, locate the 20 × 10 ft opening. Follow the shortened beam from grid C to header G1.':
      'Follow the framing around the opening. The deck stops at its edge.';
    if(s.focus==='glazing')return 'The two outlined bays are the full-height window locations given in the question.';
    if(s.focus==='column')return s.column?'Column '+s.column+' is highlighted. Compare the framing that meets it from each side.':'Choose a column from the question and compare how the framing meets it.';
    if(s.focus==='girder')return s.girder?'Girder '+s.girder+' is highlighted. Count the beam ends on each side and locate the two supporting columns.':'Choose a girder from the question. Compare its beam connections with the other three candidates.';
    return 'Four 30 ft bays along 1–5 and three 25 ft bays along A–D. Choose Typical bay to see the 10 ft beam spacing.';
  }
  function makeViewer(id){
    const s={focus:initial[id],view:'3d',opening:0,column:'',girder:'',step:0,
      roof:true,fullDeck:false,tributary:id==='ARE03',angle:W.LabRenderer.lens.normalize(W.StructureDisplay?.fieldOfView)};
    const el=D.createElement('section');el.className='xr-office';el.setAttribute('aria-label','Interactive two-story steel office');
    el.innerHTML=`<header><h3>Two-story steel office</h3><div class="xo-tabs" role="group" aria-label="Framing view"><button type="button" data-view="3d">3D model</button><button type="button" data-view="plan">Model plan</button><button type="button" data-view="source">Original plan</button></div></header>
      <div class="xo-model"><div class="xo-controls"><label>Study view <select data-control="focus">${options(Object.entries(views))}</select></label><label class="xo-pick" hidden><span></span><select data-control="pick"></select></label></div>
      <div class="xo-stage"><canvas tabindex="0" role="img" aria-label="Interactive office floor model. Use the arrow keys to orbit in 3D, plus and minus to zoom, or Home to fit."></canvas></div>
      <div class="xo-legend" aria-label="Framing colors"><span class="xo-beam">Floor beam</span><span class="xo-girder">Girder / header</span><span class="xo-column">Column</span><span class="xo-deck">Deck</span></div>
      <p class="xo-guide" aria-live="polite"></p><div class="xo-tools">
      <label><input type="checkbox" data-control="fullDeck">Full deck</label><label><input type="checkbox" data-control="roof">Roof outline</label><label><input type="checkbox" data-control="tributary">Tributary strip</label>
      <button type="button" data-tool="trace">Trace gravity load</button><label class="xo-lens">Dolly zoom <input data-control="angle" aria-label="Dolly zoom angle" type="range" min="15" max="75" step="1"><output></output></label><button type="button" data-tool="fit">Fit view</button></div>
      <small>Drag to orbit · Shift-drag to pan · Scroll to zoom. Story heights, member sizes and roof outline are schematic.</small></div>
      <figure class="xo-source" hidden><a href="exam/figures/ARE02-18.webp" target="_blank" rel="noopener"><img src="exam/figures/ARE02-18.webp" alt="Original floor framing plan. Grids 1 through 5 at 30 ft and A through D at 25 ft. Three openings are shown, including G1 near 1D and G2 near 5A."></a><figcaption>Original framing plan · Part 3, p. 2 · Select the image to enlarge.</figcaption></figure>`;
    const canvas=el.querySelector('canvas'),field=k=>el.querySelector('[data-control="'+k+'"]');
    const hint=el.querySelector('.xo-guide'),picker=field('pick'),trace=el.querySelector('[data-tool="trace"]');
    let rr=null,scene=null;
    function sync(){
      const source=s.view==='source',local=s.focus==='bay'||s.focus==='opening';
      for(const b of el.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(s.view===b.dataset.view));
      el.querySelector('.xo-source').hidden=!source;el.querySelector('.xo-model').hidden=source;
      field('focus').value=s.focus;
      for(const key of ['fullDeck','roof','tributary'])field(key).checked=s[key];
      field('roof').parentElement.hidden=local||s.view==='plan';
      field('tributary').parentElement.hidden=s.focus!=='bay';
      trace.hidden=!['bay','whole'].includes(s.focus);
      trace.textContent=s.step===0?'Trace gravity load':s.step===4?'Finish trace':'Next load-path step';
      field('angle').parentElement.hidden=s.view!=='3d';field('angle').value=s.angle;
      field('angle').setAttribute('aria-valuetext',s.angle+' degrees');el.querySelector('output').value=s.angle+'°';
      const choices=s.focus==='opening'?openings.map((o,i)=>[i,o.label]):
        s.focus==='column'?[['','Choose a column'],...compareColumns.map(n=>[n,n])]:
        s.focus==='girder'?[['','Choose a girder'],...compareGirders.map(n=>[n,n])]:[];
      picker.parentElement.hidden=!choices.length;
      if(choices.length){
        picker.parentElement.querySelector('span').textContent=({opening:'Opening',column:'Column',girder:'Girder'})[s.focus];
        picker.innerHTML=options(choices);picker.value=s[s.focus];
      }
      hint.textContent=guide(s);
    }
    function draw(fit=false){
      sync();if(s.view==='source')return;
      scene=makeScene(s);
      if(!rr)rr=new OfficeRenderer(canvas,{onSelect:member=>{
        if(s.focus==='column'&&compareColumns.includes(member)){s.column=member;draw();return;}
        if(s.focus==='girder'&&compareGirders.includes(member)){s.girder=member;draw();return;}
        hint.textContent=scene.details.get(member)||guide(s);
      }});
      rr.mode=s.view==='plan'?'2d':'3d';rr.projection=s.view==='plan'?'orthographic':'perspective';rr.setFieldOfView(s.angle);
      rr.marks=scene.marks;
      if(fit){
        rr.yaw=-.45;rr.pitch=.54;rr.fitScene(scene);
      }
      rr.setScene(scene.items,{center:scene.center,extent:scene.extent,plane:'plan'});
    }
    el.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.dataset.view){
        if(s.view===b.dataset.view)return;
        s.view=b.dataset.view;draw(true);
      }else if(b.dataset.tool==='fit')draw(true);
      else if(b.dataset.tool==='trace'){
        const entering=s.focus!=='bay';s.focus='bay';s.step=(s.step+1)%5;s.tributary=false;s.fullDeck=false;draw(entering);
      }
    });
    el.addEventListener('change',event=>{
      const input=event.target,key=input.dataset.control;
      if(key==='focus'){
        s.focus=input.value;s.step=0;s.tributary=false;s.fullDeck=false;draw(true);
      }else if(key==='pick'){
        s[s.focus]=s.focus==='opening'?Number(input.value):input.value;draw(s.focus==='opening');
      }else if(['fullDeck','roof','tributary'].includes(key)){s[key]=input.checked;draw();}
      else if(key==='angle'&&rr){rr.lensPreview=false;rr.requestRender();}
    });
    field('angle').addEventListener('input',event=>{
      if(!rr)return;
      s.angle=W.LabRenderer.lens.normalize(event.target.valueAsNumber);
      rr.setFieldOfView(s.angle);rr.lensPreview=true;rr.requestRender();
      event.target.setAttribute('aria-valuetext',s.angle+' degrees');el.querySelector('output').value=s.angle+'°';
    });
    for(const type of ['blur','pointercancel'])field('angle').addEventListener(type,()=>{if(rr?.lensPreview){rr.lensPreview=false;rr.requestRender();}});
    canvas.addEventListener('keydown',event=>{
      if(!rr)return;
      const key=event.key;
      if(key==='Home'){event.preventDefault();draw(true);return;}
      if(['+','=','-'].includes(key))rr.zoom=Math.min(5,Math.max(.3,rr.zoom*(key==='-'?.85:1.18)));
      else if(s.view==='3d'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){
        rr.yaw+=key==='ArrowLeft'?.13:key==='ArrowRight'?-.13:0;
        rr.pitch=Math.max(-1.45,Math.min(1.45,rr.pitch+(key==='ArrowUp'?.1:key==='ArrowDown'?-.1:0)));
      }else return;
      event.preventDefault();rr.requestRender();
    });
    return {id,el,start:()=>draw(true),context:()=>views[s.focus]+'. '+hint.textContent,
      dispose(){rr?.resizeObserver.disconnect();if(rr?.renderFrame)W.cancelAnimationFrame(rr.renderFrame);rr=null;}};
  }
  let active=null;
  W.OfficeFrame={
    has:id=>Object.hasOwn(initial,id),
    mount(slot,id){
      if(active?.id!==id||!slot){active?.dispose();active=null;}
      if(!slot)return;
      if(active){slot.replaceWith(active.el);return;}
      active=makeViewer(id);slot.replaceWith(active.el);active.start();
    },
    context:id=>active?.id===id?active.context():null
  };
})(window,document);
