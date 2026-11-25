export const service='https://id3-ava-walk.teng-portfolio-11e715bd5693.workers.dev';
export function channel(id,key,onMessage,onEnd){
 const ws=new WebSocket(service.replace('https:','wss:')+'/rooms/'+id,['id3.v1','key.'+key]);
 ws.onmessage=e=>{try{onMessage(JSON.parse(e.data));}catch{}};
 ws.onclose=onEnd;
 return {send(message){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));},close(){ws.onclose=null;ws.close();}};
}
