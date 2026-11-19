import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import sedan from '../assets/traffic/family-sedan-1.glb';
import sedanDistant from '../assets/traffic/family-sedan-2.glb';
import tourer from '../assets/traffic/family-minivan-1.glb';
import tourerDistant from '../assets/traffic/family-minivan-2.glb';
import delivery from '../assets/traffic/delivery-van-1.glb';
import deliveryDistant from '../assets/traffic/delivery-van-2.glb';

// CC0 original geometry: tevy, https://tevy.dev/ . See assets/traffic/credits.txt.
// Coordinates point forward along -Z. Widths exclude the projecting mirrors.
const cars={
  compact:{name:'Family sedan',src:[sedan,sedanDistant],half:2.45,width:.922,roof:1.45,wheel:.334,
    paints:[0x792f33,0x969f9f,0x35475d,0x616760]},
  camper:{name:'Touring minivan',src:[tourer,tourerDistant],half:2.55,width:.951,roof:1.89,wheel:.368,
    paints:[0x687e7b,0x9f9789,0x565b60]},
  van:{name:'High-roof delivery van',src:[delivery,deliveryDistant],half:2.98,width:.997,roof:2.85,wheel:.352,
    paints:[0xc2c5bd,0x8e979b,0x5e6c6c]}
};

function getSurface(name){
  if(name==='paint'||name==='paint_body')return 'paint';
  if(name==='glass_privacy')return 'privacy';
  if(name==='glass')return 'glass';
  if(name==='lens'||name==='lens_clear')return 'lens';
  if(name.includes('light_front')||name==='projector')return 'front';
  if(name.includes('light_rear')||name.includes('lamp_red')||name==='lens_red')return 'rear';
  if(/chrome|rim_|disc|reflector|mirror_glass|lamp_housing|exhaust/.test(name))return 'metal';
  return 'matte';
}

// The authoring files contain independently hinged body panels. Merge static
// material batches once, while preserving the four wheel pivots for rolling.
function batchGeometry(T,root,rigged){
  root.updateMatrixWorld(true);
  const turn=new T.Matrix4().makeRotationY(Math.PI);
  const wheels=new Map(),streams=new Map(),wheelNames=new Map();
  const emitters=[new T.Box3(),new T.Box3()],plates=[new T.Box3(),new T.Box3()];
  const v=new T.Vector3(),n=new T.Vector3(),transform=new T.Matrix4(),normalMatrix=new T.Matrix3();
  root.traverse(o=>{
    if(rigged&&/^wheel_(FL|FR|RL|RR)$/.test(o.name)){
      const position=o.getWorldPosition(new T.Vector3()).applyMatrix4(turn);
      wheels.set(o.name,position);wheelNames.set(o,o.name);
    }
  });
  root.traverse(o=>{
    if(!o.isMesh)return;
    const material=o.material,source=material.name,surface=getSurface(source),tint=material.color;
    let wheel=null;
    if(rigged)for(let p=o.parent;p;p=p.parent)if(wheelNames.has(p)){wheel=wheelNames.get(p);break;}
    const id=(wheel||'body')+':'+surface;
    if(!streams.has(id))streams.set(id,{surface,wheel,p:[],n:[],c:[],indices:[]});
    const batch=streams.get(id),{position:pos,normal}=o.geometry.attributes;
    const offset=batch.p.length/3,pivot=wheels.get(wheel);
    transform.multiplyMatrices(turn,o.matrixWorld);normalMatrix.getNormalMatrix(transform);
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(transform);if(pivot)v.sub(pivot);
      if(!wheel&&surface==='front'&&v.z<-1&&Math.abs(v.x)>.26)emitters[+(v.x>0)].expandByPoint(v);
      if(!wheel&&source.startsWith('plate')&&Math.abs(v.z)>1)plates[+(v.z>0)].expandByPoint(v);
      n.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
      batch.p.push(v.x,v.y,v.z);batch.n.push(n.x,n.y,n.z);
      if(surface==='matte'||surface==='metal'){
        const dark=source==='tire'?.46:1;
        batch.c.push(tint.r*dark,tint.g*dark,tint.b*dark);
      }
    }
    const indices=o.geometry.index,count=indices?indices.count:pos.count,flipped=transform.determinant()<0;
    for(let j=0;j<count;j+=3){
      const a=indices?indices.getX(j):j,b=indices?indices.getX(j+1):j+1,c=indices?indices.getX(j+2):j+2;
      batch.indices.push(a+offset,(flipped?c:b)+offset,(flipped?b:c)+offset);
    }
  });
  const parts=[];
  for(const batch of streams.values()){
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(batch.p,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(batch.n,3));
    if(batch.c.length)g.setAttribute('color',new T.Float32BufferAttribute(batch.c,3));
    g.setIndex(batch.indices);g.computeBoundingSphere();
    parts.push({geometry:g,kind:batch.surface,wheel:batch.wheel});
  }
  root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  return {parts,wheels,emitters,plates};
}

function bytes(dataUrl){
  const encoded=dataUrl.slice(dataUrl.indexOf(',')+1),data=atob(encoded);
  return Uint8Array.from(data,c=>c.charCodeAt(0)).buffer;
}

function maskTexture(T,beam){
  const size=64, bytes=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const u=(i+.5)/size*2-1,t=(j+.5)/size,y=t*2-1;
    const alpha=beam
      ?Math.exp(-3.2*u*u)*(1-Math.exp(-t*18))*Math.exp(-1.35*t)*((1-t)**.78)
      :Math.exp(-3.5*(u**4+y**4))*Math.max(0,1-u*u)*Math.max(0,1-y*y);
    const k=(j*size+i)*4;bytes[k]=bytes[k+1]=bytes[k+2]=255;bytes[k+3]=Math.round(255*alpha);
  }
  const texture=new T.DataTexture(bytes,size,size,T.RGBAFormat);
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
  return texture;
}

function lampPool(T,front,d){
  const g=new T.BufferGeometry(),positions=[],uv=[],indices=[];
  for(const s of [-1,1]){
    const a=positions.length/3,x=s*d.width*.68,sign=front?-1:1;
    const z=sign*(d.half+.04),end=z+sign*(front?8.8:3.2),w=front?1.9:.72;
    positions.push(x-.31,.079,z,x+.31,.079,z,x-w+s*.30,.082,end,x+w+s*.30,.082,end);
    uv.push(0,0,1,0,0,1,1,1);indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingSphere();
  return g;
}

export function createCoachbuilder(T){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),source=new Map(),paints=new Map(),pools=new Map();
  const physical=options=>new T.MeshPhysicalMaterial(options),standard=options=>new T.MeshStandardMaterial(options);
  const glass=(opacity,color)=>physical({color,opacity,transparent:true,side:T.DoubleSide,depthWrite:false,
    metalness:.12,roughness:.095,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1.18});
  const mats={
    matte:standard({vertexColors:true,roughness:.73,metalness:.06}),
    metal:standard({vertexColors:true,roughness:.27,metalness:.81}),
    glass:glass(.57,0x587070),privacy:glass(.79,0x263e42),lens:glass(.17,0xdbe1dd),
    front:standard({color:0xf0efe1,metalness:.17,roughness:.18,emissive:0xfff2d7,emissiveIntensity:.31}),
    rear:physical({color:0x81141b,roughness:.20,clearcoat:1,emissive:0xd11d1c,emissiveIntensity:.20}),
    rubber:standard({color:0x202427,roughness:.8}),signal:new T.MeshBasicMaterial({color:0xffad37,toneMapped:false})
  };
  const footprint=new T.MeshBasicMaterial({color:0x141917,map:maskTexture(T,false),transparent:true,opacity:.68,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const headPool=new T.MeshBasicMaterial({color:0xfff4cc,map:maskTexture(T,true),transparent:true,opacity:0,
    depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
  const redPool=headPool.clone();redPool.color.set(0xd9382b);
  const glow=new T.SpriteMaterial({map:maskTexture(T,false),color:0xfff2cb,transparent:true,
    opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  const registration=new Map();
  function plateMaterial(type,palette){
    const id=type+palette;
    if(!registration.has(id)){
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#dddcca';ctx.fillRect(0,0,256,64);
      ctx.strokeStyle='#495457';ctx.lineWidth=3;ctx.strokeRect(3,3,250,58);
      ctx.fillStyle='#273138';ctx.font='bold 43px monospace';ctx.textAlign='center';
      const prefix={camper:'TR',compact:'RS',van:'DL'}[type];ctx.fillText(prefix+' '+(372+palette*104),128,47);
      const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
      registration.set(id,standard({map:tex,roughness:.42,metalness:.16}));
    }
    return registration.get(id);
  }
  const contactGeometry=new T.PlaneGeometry(1,1);contactGeometry.rotateX(-Math.PI/2);
  const box=new RoundedBoxGeometry(1,1,1,1,.13);
  const tire=new T.CylinderGeometry(1,1,1,14);tire.rotateZ(Math.PI/2);
  const plateGeometry=new T.PlaneGeometry(1,1);
  let cargoDoors, cargoPlate;
  function rearFittings(target,paintMesh,d){
    if(cargoDoors){target.add(cargoDoors.clone());return cargoPlate;}
    cargoDoors=new T.Group();target.add(cargoDoors);
    const ray=new T.Raycaster(),direction=new T.Vector3(0,0,-1);
    const positions=paintMesh.geometry.attributes.position;
    paintMesh.geometry.computeBoundingBox();const back=paintMesh.geometry.boundingBox.max.z;
    let rearRoof=0;
    for(let i=0;i<positions.count;i++)if(positions.getZ(i)>back-.24)rearRoof=Math.max(rearRoof,positions.getY(i));
    const availableHeight=Math.min(1,(rearRoof-.13)/2.60);
    function surface(x,y){
      y*=availableHeight;
      ray.set(new T.Vector3(x,y,d.half+1),direction);const hit=ray.intersectObject(paintMesh,false)[0];
      return new T.Vector3(x,y,(hit?.point.z??back)+.010);
    }
    const seam=points=>{
      const path=new T.CatmullRomCurve3(points.map(([x,y])=>surface(x,y)));
      const mesh=new T.Mesh(new T.TubeGeometry(path,Math.max(12,points.length*4),.006,5,false),mats.rubber);cargoDoors.add(mesh);
    };
    seam([[0,.64],[0,1.23],[0,1.86],[0,2.38],[0,2.60]]);
    for(const s of [-1,1]){
      seam([[0,2.60],[s*.32,2.60],[s*.64,2.56],[s*.72,2.46],[s*.75,1.96],[s*.76,1.35],[s*.76,.72],[s*.69,.62],[s*.35,.60],[s*.04,.60]]);
    }
    const handle=new T.Mesh(box,mats.rubber);handle.position.copy(surface(.16,1.27));handle.scale.set(.225,.067,.044);cargoDoors.add(handle);
    const panelLine=[[-.60,.55],[-.62,1.26],[-.58,1.91],[-.43,2.02],[.82,2.02],[.96,1.92],[1.00,1.33],[.99,.57],[.87,.51],[-.51,.51],[-.60,.55]];
    const points=panelLine.map(([z,y])=>{
      ray.set(new T.Vector3(d.width+1,y,z),new T.Vector3(-1,0,0));const hit=ray.intersectObject(paintMesh,false)[0];
      return new T.Vector3((hit?.point.x??d.width)+.005,y,z);
    });
    cargoDoors.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),54,.005,5,false),mats.rubber));
    cargoPlate=surface(0,.815);return cargoPlate;
  }
  function paint(hex){
    if(!paints.has(hex))paints.set(hex,physical({color:hex,metalness:.53,roughness:.28,clearcoat:1,clearcoatRoughness:.10,envMapIntensity:1.2}));
    return paints.get(hex);
  }
  function load(type){
    if(!source.has(type))source.set(type,cars[type].src.map((url,i)=>{
      const job=loader.parseAsync(bytes(url),'').then(gltf=>batchGeometry(T,gltf.scene,i===0));
      // If WebAssembly is unavailable, retain the synchronous drivable model.
      return job.catch(error=>{console.warn('Traffic model unavailable',type,i,error);return null;});
    }));
    return source.get(type);
  }
  function loadingModel(d,color){
    const group=new T.Group();
    function part(g,m,x,y,z,sx,sy,sz){
      const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);group.add(mesh);
    }
    const belt=d.roof*.53;
    part(box,color,0,belt*.64,0,d.width*1.97,belt*.78,d.half*1.96);
    part(box,mats.privacy,0,(d.roof+belt)*.5,d.half*.1,d.width*1.72,d.roof-belt,d.half*1.4);
    for(const s of [-1,1])for(const z of [-1,1])part(tire,mats.rubber,s*(d.width-.08),d.wheel,z*d.half*.62,.19,d.wheel,d.wheel);
    return group;
  }
  function build(type,palette){
    const d=cars[type],root=new T.Group(),coat=paint(d.paints[palette]),fallback=loadingModel(d,coat);
    const near=new T.Group(),far=new T.Group(),pivots=[];
    const halos=new T.Group();halos.visible=false;
    let hasNear=false,hasFar=false,angle=0,latestRelative=0;
    root.name=d.name;root.add(fallback,near,far,halos);
    function choose(){
      const useNear=Math.abs(latestRelative)<53;
      near.visible=hasNear&&(useNear||!hasFar);
      far.visible=hasFar&&!near.visible;fallback.visible=!near.visible&&!far.visible;
    }
    load(type).forEach((task,i)=>task.then(model=>{
      if(!model)return;
      const target=i===0?near:far,rig=new Map();let paintMesh;
      for(const [name,position] of model.wheels){
        const wheel=new T.Group();wheel.position.copy(position);target.add(wheel);rig.set(name,wheel);pivots.push(wheel);
      }
      for(const {geometry,kind,wheel} of model.parts){
        const mesh=new T.Mesh(geometry,kind==='paint'?coat:mats[kind]);
        if(kind==='paint'&&!wheel)paintMesh=mesh;
        mesh.castShadow=i===0&&(kind==='paint'||kind==='matte');
        mesh.receiveShadow=!['lens','glass','privacy'].includes(kind);
        (wheel?rig.get(wheel):target).add(mesh);
      }
      if(i===0){
        for(const bounds of model.emitters){
          if(bounds.isEmpty())continue;
          const sprite=new T.Sprite(glow);bounds.getCenter(sprite.position);sprite.position.z=bounds.min.z-.024;
          sprite.scale.set(.30,.17,1);halos.add(sprite);
        }
        let panel;
        if(type==='van'&&paintMesh)panel=rearFittings(near,paintMesh,d);
        model.plates.forEach((bounds,j)=>{
          if(bounds.isEmpty()&&!(panel&&j===1))return;
          const plate=new T.Mesh(plateGeometry,plateMaterial(type,palette));const sign=j===0?-1:1;
          if(bounds.isEmpty())plate.position.copy(panel);else{
            bounds.getCenter(plate.position);plate.position.z=(j?bounds.max.z:bounds.min.z)+sign*.006;
          }
          plate.rotation.y=j?0:Math.PI;plate.scale.set(.42,.105,1);target.add(plate);
        });
      }
      if(i===0)hasNear=true;else hasFar=true;choose();
    }));
    const shadow=new T.Mesh(contactGeometry,footprint);shadow.position.y=.052;
    shadow.scale.set(d.width*2.34,1,d.half*2.1);root.add(shadow);
    if(!pools.has(type))pools.set(type,[lampPool(T,true,d),lampPool(T,false,d)]);
    const [headGeometry,tailGeometry]=pools.get(type);
    const front=new T.Mesh(headGeometry,headPool),rear=new T.Mesh(tailGeometry,redPool);
    root.add(front,rear);front.visible=rear.visible=false;
    const indicator=new T.Mesh(box,mats.signal);indicator.scale.set(.12,.039,.025);indicator.visible=false;root.add(indicator);
    function draw({rel,elapsed,velocity,night,wet,signal,signalDirection}){
      latestRelative=rel;choose();
      if(near.visible&&elapsed){angle=(angle-velocity*elapsed/d.wheel)%(Math.PI*2);for(const wheel of pivots)wheel.rotation.x=angle;}
      front.visible=night>.10&&Math.abs(rel)<100;
      halos.visible=front.visible;
      rear.visible=wet>.08&&night>.10&&Math.abs(rel)<75;
      indicator.visible=signal;
      if(signal)indicator.position.set(signalDirection*d.width*.79,type==='van'?1.13:type==='compact'?.80:.94,d.half+.008);
    }
    return {root,draw,width:d.width,length:d.half};
  }
  function light(night,wet){
    mats.front.emissiveIntensity=.31+night*4.6;mats.rear.emissiveIntensity=.20+night*1.8;
    glow.opacity=night*.68;
    headPool.opacity=night*(.21+.31*wet);redPool.opacity=night*wet*.36;
  }
  return {build,light,paletteCount:type=>cars[type].paints.length};
}
