export const service='https://id3-ava-walk.teng-portfolio-11e715bd5693.workers.dev';
export function channel(id,key,onMessage,onEnd){
 const ws=new WebSocket(service.replace('https:','wss:')+'/rooms/'+id,['id3.v1','key.'+key]);
 ws.binaryType='arraybuffer';
 ws.onmessage=e=>{try{onMessage(typeof e.data==='string'?JSON.parse(e.data):e.data);}catch{}};
 ws.onclose=onEnd;
 return {send(message){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));},sendFrame(bytes){if(ws.readyState===WebSocket.OPEN)ws.send(bytes);},close(){ws.onclose=null;ws.close();}};
}
