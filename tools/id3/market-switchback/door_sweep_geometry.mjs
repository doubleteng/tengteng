// Export the actual runtime leaf positions, including folding leaves and fittings,
// for the structural opening audit. Coordinates follow the design grid in metres.
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';

const bytes=await readFile(process.argv[2]);
const input=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const {scene}=await new GLTFLoader().parseAsync(input,'');
const doors=new WalkDoors(scene,{caseStudy:true});
const sections=40;

function components(mesh){
  const geometry=mesh.geometry, pos=geometry.attributes.position, index=geometry.index;
  if(!index || index.count%36)throw new Error('Unexpected leaf geometry '+mesh.name);
  // The gallery exports closed boxes for each panel, stile, rail and handle.
  const boxes=[];
  for(let start=0;start<index.count;start+=36){
    const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    const vertices=new Set();
    for(let i=start;i<start+36;i++){
      const v=index.getX(i),point=[pos.getX(v),pos.getY(v),pos.getZ(v)];
      vertices.add(point.join(','));
      point.forEach((coord,d)=>{low[d]=Math.min(low[d],coord);high[d]=Math.max(high[d],coord);});
    }
    if(vertices.size!==8)throw new Error('Unexpected vertices in '+mesh.name);
    boxes.push([...low,...high]);
  }
  return boxes;
}

const result=doors.entries.map((door,id)=>{
  const leaves=door.meshes.map(mesh=>({boxes:components(mesh),poses:[]}));
  for(let step=0;step<=sections;step++){
    door.pose(step/sections);
    door.meshes.forEach((mesh,i)=>{
      mesh.updateWorldMatrix(true,false);
      const e=mesh.matrixWorld.elements;
      if(Math.abs(e[1])+Math.abs(e[4])+Math.abs(e[6])+Math.abs(e[9])>1e-6||Math.abs(e[5]-1)>1e-6)
        throw new Error('Door no longer rotates about a vertical hinge: '+mesh.name);
      leaves[i].poses.push([e[0],e[8],e[12]+82.906,e[2],e[10],e[14],e[13]]);
    });
  }
  door.pose(door.initial);
  return {id,label:door.label,leaves};
});
process.stdout.write(JSON.stringify(result));
