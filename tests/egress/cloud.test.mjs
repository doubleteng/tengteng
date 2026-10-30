import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudConnection, validEndpoint, discoverFrames } from '../../teaching/egress/src/cloud.mjs';
function fixture() {
 const messages=[],child={length:0,frames:[],postMessage:(m,o)=>messages.push({m,o})};
 const popup={closed:false,length:1,frames:[child],postMessage(){},close(){this.closed=true;}};
 const host={addEventListener(){},open:()=>popup};
 const connection=new CloudConnection(host);
 connection.connect('https://script.google.com/macros/s/deployment-id/exec');
 return {connection,child,popup,messages};
}
test('Reject arbitrary destinations before opening a Google window',()=>{
 assert.equal(validEndpoint('https://evil.example/exec'),false);
 assert.equal(validEndpoint('https://script.google.com.evil.example/macros/s/id/exec'),false);
 assert.equal(validEndpoint('https://script.google.com/macros/s/id/exec?redirect=evil'),false);
});
test('Discover nested frame identities without reading frame documents',()=>{
 const child={length:0},root={length:1,frames:[child]};
 assert.deepEqual([...discoverFrames(root)],[root,child]);
});
test('Ignore forged ready messages and correlate replies with the connected window',async()=>{
 const {connection:c,child,messages}=fixture();
 const ready={type:'egress-cloud-ready',nonce:c.nonce},origin='https://n-example-script.googleusercontent.com';
 c.receive({origin:'https://evil.example',source:child,data:ready});assert.equal(c.connected,false);
 c.receive({origin,source:{},data:ready});assert.equal(c.connected,false);
 c.receive({origin,source:child,data:{...ready,nonce:'wrong'}});assert.equal(c.connected,false);
 c.receive({origin,source:child,data:ready});assert.equal(c.connected,true);
 const answer=c.request({action:'list'}),sent=messages.at(-1);
 assert.equal(sent.o,origin);assert.equal(sent.m.request.action,'list');
 const data={type:'egress-cloud-result',nonce:c.nonce,requestId:sent.m.requestId,result:{projects:[]}};
 c.receive({origin,source:{},data});assert.equal(c.pending.size,1);
 c.receive({origin,source:child,data});assert.deepEqual(await answer,{projects:[]});c.disconnect();
});
test('Closed connection rejects saves instead of claiming they succeeded',async()=>{
 const {connection:c,popup}=fixture();popup.closed=true;
 await assert.rejects(c.request({action:'save'}),/Connect Google/);c.disconnect();
});
