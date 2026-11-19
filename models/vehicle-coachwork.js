import {sedans} from './tesla-sedans.js';
import {crossovers} from './tesla-crossovers.js';
import {specials} from './tesla-specials.js';
import {wheelAssembly,mergeParts} from './tesla-wheels.js';
import {addCabin} from './tesla-cabin.js';

const fleet={...sedans,...crossovers,...specials};
export const modelIds=['model3','modelY','modelS','modelX','cybertruck','roadster'];

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

function brushedSurface(T){
  const w=32,h=128,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const index=(y*w+x)*4;
    const v=207+Math.round(24*Math.sin(y*91.713)+7*Math.cos(x*.41+y*2.61));
    data.set([v,v,v,255],index);
  }
  const tex=new T.DataTexture(data,w,h);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  return tex;
}

export function createCoachbuilder(T){
  const standard=(color,roughness,metalness=0,more={})=>new T.MeshStandardMaterial({color,roughness,metalness,side:T.DoubleSide,...more});
  const physical=(color,options)=>new T.MeshPhysicalMaterial({color,side:T.DoubleSide,...options});
  const paintOptions={metalness:.32,roughness:.28,clearcoat:1,clearcoatRoughness:.11,envMapIntensity:1.18};
  const m={
    paint:physical(0xffffff,paintOptions),
    glass:physical(0x354954,{metalness:.12,roughness:.14,clearcoat:.70,clearcoatRoughness:.07,envMapIntensity:.92,
      transparent:true,opacity:.59,depthWrite:false}),
    roofGlass:physical(0x202f3a,{metalness:.27,roughness:.14,clearcoat:.95,clearcoatRoughness:.065,envMapIntensity:1.35}),
    black:standard(0x1c1e21,.87),
    trim:standard(0x363b40,.49,.18),
    metal:standard(0x717981,.31,.77),
    chrome:standard(0xc7ced2,.23,.78),
    badge:standard(0xc7ccd2,.26,.73),
    interior:standard(0x252b31,.86),
    upholstery:standard(0x535452,.8),
    jacket:standard(0x373f46,.93),
    skin:standard(0x98745f,.83),
    steel:physical(0xbcc3c8,{metalness:.83,roughness:.43,roughnessMap:brushedSurface(T),envMapIntensity:1.22}),
    front:standard(0xe9f4f8,.19,.22,{emissive:0xe1f1ff,emissiveIntensity:.45}),
    rear:standard(0x991320,.22,.13,{emissive:0xec0a1c,emissiveIntensity:.26}),
    amber:standard(0x9a572b,.36,.16)
  };
  for(const [name,material] of Object.entries(m))material.name=name;
  m.glass.forceSinglePass=true;
  const distantGlass=m.glass.clone();distantGlass.name='Distant glazing';
  distantGlass.transparent=false;distantGlass.opacity=1;distantGlass.depthWrite=true;
  const paints=new Map(),models=new Map();
  function coat(color){
    if(!paints.has(color)){
      const material=physical(color,paintOptions);material.name='Paint '+material.color.getHexString();
      paints.set(color,material);
    }
    return paints.get(color);
  }
  const footprint=new T.MeshBasicMaterial({color:0x17181b,map:maskTexture(T,false),transparent:true,opacity:.62,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const headPool=new T.MeshBasicMaterial({color:0xe8effc,map:maskTexture(T,true),transparent:true,depthWrite:false,
    blending:T.AdditiveBlending,side:T.DoubleSide});
  const redPool=headPool.clone();redPool.color.set(0xe73034);
  const haloMaterial=new T.SpriteMaterial({map:maskTexture(T,false),color:0xe7f3ff,transparent:true,
    depthWrite:false,blending:T.AdditiveBlending});
  const contactGeom=new T.PlaneGeometry(1,1);contactGeom.rotateX(-Math.PI/2);
  const indicatorGeom=new T.SphereGeometry(1,7,5);
  const indicatorMat=new T.MeshBasicMaterial({color:0xffa137,toneMapped:false});

  function makeLevel(spec,type,detailed){
    const unmerged=new T.Group(),ctx={T,group:unmerged,m:detailed?m:{...m,glass:distantGlass},detailed};
    const sockets=spec.build(ctx)??{};
    if(detailed)addCabin(ctx,type,spec);
    const wheel=wheelAssembly(T,m,spec,type,detailed),level=new T.Group();
    for(const side of [-1,1])for(const axle of [-1,1]){
      const pivot=new T.Group();
      pivot.position.set(side*spec.track*.5,spec.wheelRadius,(spec.axleMid??0)+axle*spec.wheelbase*.5);
      const hub=wheel.clone();if(side<0)hub.rotation.y=Math.PI;
      pivot.name='Wheel '+(side<0?'L':'R')+(axle<0?'F':'R');
      pivot.add(hub);(detailed?level:unmerged).add(pivot);
    }
    const body=mergeParts(T,unmerged);
    body.children.forEach(mesh=>{
      mesh.castShadow=detailed&&(mesh.material===m.paint||mesh.material===m.steel||mesh.material===m.roofGlass);
      mesh.receiveShadow=true;
    });
    level.add(body);
    return {level,sockets};
  }
  function model(type){
    if(!models.has(type)){
      const spec=fleet[type],dimensions={half:spec.length*.5,width:spec.width*.5};
      const near=makeLevel(spec,type,true),far=makeLevel(spec,type,false);
      models.set(type,{spec,near:near.level,far:far.level,sockets:near.sockets,
        head:lampPool(T,true,dimensions),tail:lampPool(T,false,dimensions)});
    }
    return models.get(type);
  }
  function build(type,palette){
    const item=model(type),spec=item.spec,root=new T.Group();
    root.name=spec.name;root.userData.model=type;
    const near=item.near.clone(),far=item.far.clone(),glows=new T.Group(),signals=new T.Group();
    near.name='Near body';far.name='Distant body';far.visible=false;
    const painted=[],wheels=[];
    for(const level of [near,far]){
      level.traverse(obj=>{
        if(obj.material===m.paint)painted.push(obj);
        if(obj.name.startsWith('Wheel '))wheels.push(obj);
      });
    }
    function repaint(index){
      const material=coat(spec.paints[index%spec.paints.length]);
      painted.forEach(mesh=>mesh.material=material);
    }
    repaint(palette);
    const sockets=item.sockets;
    const fallback=(sign,front)=>[sign*spec.width*.37,spec.height*.42,(front?-1:1)*spec.length*.496];
    for(const xyz of sockets.headlights??[-1,1].map(s=>fallback(s,true))){
      const sprite=new T.Sprite(haloMaterial);sprite.position.fromArray(xyz);sprite.position.z-=.022;
      sprite.scale.set(.27,.13,1);glows.add(sprite);
    }
    for(const xyz of sockets.rearSignals??[-1,1].map(s=>fallback(s,false))){
      const blink=new T.Mesh(indicatorGeom,indicatorMat);blink.position.fromArray(xyz);
      blink.position.z+=.012;blink.scale.set(.087,.021,.025);signals.add(blink);
    }
    const shadow=new T.Mesh(contactGeom,footprint);shadow.position.y=.052;
    shadow.scale.set(spec.width*1.15,1,spec.length*1.05);
    const head=new T.Mesh(item.head,headPool),tail=new T.Mesh(item.tail,redPool);
    root.add(near,far,glows,signals,shadow,head,tail);
    let angle=0;
    function draw({rel,elapsed,velocity,night,wet,signal,signalDirection}){
      const range=Math.abs(rel);near.visible=range<52;far.visible=!near.visible;
      if(elapsed){
        angle=(angle-Math.abs(velocity)*elapsed/spec.wheelRadius)%(Math.PI*2);
        for(const wheel of wheels)wheel.rotation.x=angle;
      }
      glows.visible=night>.11&&range<76;head.visible=night>.10&&range<100;
      tail.visible=wet>.08&&night>.10&&range<75;signals.visible=signal;
      if(signal)signals.children.forEach(lamp=>lamp.visible=Math.sign(lamp.position.x)===signalDirection);
    }
    return {root,draw,repaint,width:spec.width/2,length:spec.length/2};
  }
  function light(night,wet){
    m.front.emissiveIntensity=.42+night*4.6;m.rear.emissiveIntensity=.23+night*1.85;
    haloMaterial.opacity=night*.60;headPool.opacity=night*(.18+.31*wet);redPool.opacity=night*wet*.34;
  }
  return {build,light,paletteCount:type=>fleet[type].paints.length};
}
