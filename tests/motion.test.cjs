// Regression checks for interrupted motion and cleanup; no browser dependencies.
const assert = require('node:assert/strict'), fs=require('fs'), vm=require('vm');
const source=fs.readFileSync(require('node:path').join(__dirname, '../assets/js/motion.js'),'utf8');
const rect=(x,y=100)=>({left:x,top:y,width:200,height:150,right:x+200,bottom:y+150});
function setup(reduce=false){
 const events={},docEvents={},stored=new Map(),ghosts=[],animations=[];
 class Element {
  constructor(x=0){this.r=rect(x);this.isConnected=true;this.hidden=false;this.style={};this.dataset={};this.opacity='1';this.classList={add(){},remove(){}};this.tagName='ARTICLE';}
  closest(){return this.hidden?{}:null} getBoundingClientRect(){return this.r} querySelector(){return null} querySelectorAll(){return []}
  setAttribute(k,v){this[k]=v} removeAttribute(k){delete this[k]} remove(){this.isConnected=false;ghosts.splice(ghosts.indexOf(this),1)}
  cloneNode(){const c=new Element();c.r=this.r;return c}
  animate(frames,options){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b});const a={target:this,frames,options,finished,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'))},finish(){resolve()}};animations.push(a);return a;}
 }
 const document={documentElement:{dataset:{}},body:{appendChild(g){ghosts.push(g)}},addEventListener(k,f){docEvents[k]=f},querySelector(){return null},querySelectorAll(){return []},getElementById(){return null}};
 const window={addEventListener(k,f){events[k]=f}};
 const context={window,document,Element,matchMedia:()=>({matches:reduce}),sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},location:{href:'https://example.org/',origin:'https://example.org',search:''},history:{length:1},URL,URLSearchParams,innerWidth:1200,innerHeight:800,scrollX:0,scrollY:0,getComputedStyle:e=>({opacity:e.opacity,fontSize:'16px'}),setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),performance:{getEntriesByType:()=>[]}};
 vm.runInNewContext(source,context);
 return {Element,document,window,events,animations,ghosts};
}
(async()=>{
 let s=setup(),a=new s.Element(0),b=new s.Element(250),c=new s.Element(500),grid={children:[a,b,c]};
 s.window.portfolioMotion.reorder(grid,()=>{grid.children=[c,a];b.isConnected=false;c.r=rect(0);a.r=rect(250)});
 assert.equal(s.ghosts.length,1,'An outgoing visible card has a temporary exit layer');
 assert.equal(s.ghosts[0].inert,true,'Exit layers cannot capture clicks or focus');
 const aMove=s.animations.find(x=>x.target===a);assert.ok(aMove.frames[0].transform.includes('-250px'),'Existing identities start at their old screen position');
 // The visitor changes the sort before the first animation finishes.
 a.r=rect(110);c.r=rect(390);
 s.window.portfolioMotion.reorder(grid,()=>{grid.children=[a,c];a.r=rect(0);c.r=rect(250)});
 const moves=s.animations.filter(x=>x.target===a);
 assert.ok(moves.at(-1).frames[0].transform.includes('110px'),'An interrupted move starts from its interpolated position');
 assert.equal(aMove.cancelled,true);assert.equal(s.ghosts.length,0,'Old exit layers are removed on interruption');
 await new Promise(r=>setImmediate(r));
 assert.equal(moves.at(-1).cancelled,false,'Finishing cleanup from an old sort cannot cancel the new sort');
 s.animations.filter(x=>!x.cancelled).forEach(x=>x.finish());await new Promise(r=>setImmediate(r));
 assert.equal(s.ghosts.length,0);
 s=setup(true);a=new s.Element();b=new s.Element(250);grid={children:[a,b]};let changed=false;
 s.window.portfolioMotion.reorder(grid,()=>{changed=true;grid.children=[b,a]});
 assert.equal(changed,true);assert.equal(s.animations.length,0);assert.equal(s.ghosts.length,0);
 // Filtering to zero results must clear the exit layers on navigation too.
 s=setup();a=new s.Element();grid={children:[a]};
 s.window.portfolioMotion.reorder(grid,()=>{a.hidden=true});assert.equal(s.ghosts.length,1);
 s.events.pagehide();assert.equal(s.ghosts.length,0);
 console.log('PASS: identity-preserving movement, interrupted sorting, inert exit layers, cleanup, reduced motion, navigation during filtering.');
})().catch(e=>{console.error(e);process.exit(1)});
