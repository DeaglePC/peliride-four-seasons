import {sedans} from './tesla-sedans.js';
import {crossovers} from './tesla-crossovers.js';
import {specials} from './tesla-specials.js';
import {wheelAssembly,mergeParts,fixedBrake} from './tesla-wheels.js';
import {tireCompound} from './tesla-tire.js';
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

function lampPool(T,front,spec,sockets){
  const g=new T.BufferGeometry(),positions=[],uv=[],indices=[];
  const sign=front?-1:1,anchors=front?sockets.headlights:sockets.rearSignals;
  for(const [x,height] of anchors){
    const a=positions.length/3,z=sign*(spec.length*.5+.035),mount=Math.sign(x);
    const end=z+sign*(front?8.5+height*4.5:2.8),w=front?2.05:.69,center=x+mount*(front?.27:.12);
    positions.push(x-.21,.066,z,x+.21,.066,z,center-w,.071,end,center+w,.071,end);
    uv.push(0,0,1,0,0,1,1,1);indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingSphere();
  return g;
}

function contactShadow(T,spec){
  const position=[],uv=[],index=[];
  function patch(x,z,width,length){
    const a=position.length/3;
    position.push(x-width/2,0,z-length/2,x+width/2,0,z-length/2,x-width/2,0,z+length/2,x+width/2,0,z+length/2);
    uv.push(0,0,1,0,0,1,1,1);index.push(a,a+2,a+1,a+1,a+2,a+3);
  }
  patch(0,0,spec.width*1.21,spec.length*1.10);
  for(const side of [-1,1])for(const axle of [-1,1])
    patch(side*spec.track*.5,(spec.axleMid??0)+axle*spec.wheelbase*.5,.41,spec.wheelRadius*1.78);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(index);g.computeBoundingSphere();return g;
}

function brushedSurface(T){
  const w=48,h=256,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const index=(y*w+x)*4;
    const v=222+Math.round(9*Math.sin(y*91.713)+4*Math.cos(x*.28+y*2.61));
    data.set([v,v,v,255],index);
  }
  const tex=new T.DataTexture(data,w,h);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  return tex;
}

export function createCoachbuilder(T){
  const standard=(color,roughness,metalness=0,more={})=>new T.MeshStandardMaterial({color,roughness,metalness,side:T.DoubleSide,...more});
  const physical=(color,options)=>new T.MeshPhysicalMaterial({color,side:T.DoubleSide,...options});
  const paintOptions={metalness:.54,roughness:.315,clearcoat:1,clearcoatRoughness:.073,ior:1.5};
  const m={
    paint:physical(0xffffff,paintOptions),
    glass:physical(0x1e2c30,{metalness:.06,roughness:.092,clearcoat:.98,clearcoatRoughness:.045,ior:1.52,
      transparent:true,opacity:.67,depthWrite:false}),
    roofGlass:physical(0x11191b,{metalness:.10,roughness:.11,clearcoat:1,clearcoatRoughness:.048}),
    black:standard(0x1c1e21,.87),
    trim:standard(0x363b40,.49,.18),
    metal:standard(0x717981,.31,.77),
    chrome:standard(0xc7ced2,.23,.78),
    badge:standard(0xc7ccd2,.26,.73),
    interior:standard(0x252b31,.86),
    upholstery:standard(0x535452,.8),
    jacket:standard(0x373f46,.93),
    skin:standard(0x98745f,.83),
    steel:physical(0xc0c3c4,{metalness:.91,roughness:.38,roughnessMap:brushedSurface(T)}),
    rubber:standard(0x252525,.91),
    wheelAlloy:physical(0x999c9c,{metalness:.83,roughness:.29,clearcoat:.55,clearcoatRoughness:.23}),
    wheelGraphite:physical(0x54575a,{metalness:.76,roughness:.32,clearcoat:.52,clearcoatRoughness:.18}),
    wheelInset:standard(0x282a2c,.43,.36),
    brakeDisc:standard(0x515252,.49,.74),
    caliper:standard(0x393c3d,.54,.44),
    lampHousing:standard(0x171a1d,.27,.33),
    reflector:standard(0xd0d3d2,.17,.91),
    projector:physical(0x637989,{metalness:.42,roughness:.11,clearcoat:1,clearcoatRoughness:.045,emissive:0xd4e7fc,emissiveIntensity:0}),
    opticLens:physical(0xd8e1e4,{metalness:0,roughness:.095,clearcoat:1,clearcoatRoughness:.037,transparent:true,opacity:.19,depthWrite:false}),
    rearLens:physical(0x8f0b18,{metalness:.04,roughness:.14,clearcoat:1,clearcoatRoughness:.055,transparent:true,opacity:.39,depthWrite:false}),
    front:standard(0xe9f4f8,.19,.22,{emissive:0xe1f1ff,emissiveIntensity:.45}),
    rear:standard(0x991320,.22,.13,{emissive:0xec0a1c,emissiveIntensity:.26}),
    amber:standard(0x9a572b,.36,.16)
  };
  m.touring=m.rubber.clone();m.touring.normalMap=tireCompound(T,false);
  m.allTerrain=m.rubber.clone();m.allTerrain.normalMap=tireCompound(T,true);
  m.privacyGlass=m.glass.clone();m.privacyGlass.color.set(0x101919);m.privacyGlass.opacity=.80;
  for(const [name,material] of Object.entries(m))material.name=name;
  for(const shell of [m.glass,m.privacyGlass,m.opticLens,m.rearLens])shell.forceSinglePass=true;
  const distantGlass=m.glass.clone();distantGlass.name='Distant glazing';
  distantGlass.transparent=false;distantGlass.opacity=1;distantGlass.depthWrite=true;
  const paints=new Map(),models=new Map();
  const reflecting=new Set([m.glass,m.privacyGlass,distantGlass,m.roofGlass,m.steel,m.chrome,m.wheelAlloy,m.wheelGraphite,
    m.projector,m.reflector,m.opticLens,m.rearLens]);
  const nextEnvironment={value:null},environmentBlend={value:0};
  let environment=null;
  function bindReflection(material){
    const first=!material.envMap;
    material.envMap=environment;material.envMapIntensity=1.38;
    if(!first)return;
    material.onBeforeCompile=shader=>{
      shader.uniforms.nextRoadProbe=nextEnvironment;shader.uniforms.roadProbeMix=environmentBlend;
      const sample=T.ShaderChunk.envmap_physical_pars_fragment.replaceAll(
        'textureCubeUV( envMap,','sampleRoadProbe(');
      shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
        '#ifdef ENVMAP_TYPE_CUBE_UV\nuniform sampler2D nextRoadProbe;uniform float roadProbeMix;\n'+
        'vec4 sampleRoadProbe(vec3 d,float r){vec4 v=textureCubeUV(envMap,d,r);'+
        'if(roadProbeMix>0.)v=mix(v,textureCubeUV(nextRoadProbe,d,r),roadProbeMix);return v;}\n#endif\n'+sample);
    };
    material.customProgramCacheKey=()=> 'peliride-vehicle-reflection';
    material.needsUpdate=true;
  }
  function setReflection(first,second,blend){
    nextEnvironment.value=second;environmentBlend.value=blend;
    if(first===environment)return;
    environment=first;for(const material of reflecting)bindReflection(material);
  }
  function coat(color){
    if(!paints.has(color)){
      const material=physical(color,paintOptions);material.name='Paint '+material.color.getHexString();
      reflecting.add(material);if(environment)bindReflection(material);
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
  const indicatorGeom=new T.SphereGeometry(1,7,5);
  const indicatorMat=new T.MeshBasicMaterial({color:0xffa137,toneMapped:false});

  function makeLevel(spec,type,detailed){
    const unmerged=new T.Group(),ctx={T,group:unmerged,m:detailed?m:{...m,glass:distantGlass,privacyGlass:distantGlass},detailed};
    const sockets=spec.build(ctx)??{};
    if(detailed)addCabin(ctx,type,spec);
    const wheel=wheelAssembly(T,m,spec,type,detailed),level=new T.Group();
    if(detailed)for(const mesh of wheel.children){
      mesh.receiveShadow=true;
      mesh.castShadow=mesh.material===m.touring||mesh.material===m.allTerrain;
    }
    for(const side of [-1,1])for(const axle of [-1,1]){
      if(detailed)fixedBrake(ctx,spec,type,side,axle);
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
    if(detailed&&sockets.deployedHeadlights)level.add(sockets.deployedHeadlights);
    return {level,sockets};
  }
  function model(type){
    if(!models.has(type)){
      const spec=fleet[type];
      const near=makeLevel(spec,type,true),far=makeLevel(spec,type,false);
      models.set(type,{spec,near:near.level,far:far.level,sockets:near.sockets,
        shadow:contactShadow(T,spec),head:lampPool(T,true,spec,near.sockets),tail:lampPool(T,false,spec,near.sockets)});
    }
    return models.get(type);
  }
  function build(type,palette){
    const item=model(type),spec=item.spec,root=new T.Group();
    root.name=spec.name;root.userData.model=type;
    const near=item.near.clone(),far=item.far.clone(),glows=new T.Group(),signals=new T.Group();
    near.name='Near body';far.name='Distant body';far.visible=false;
    const painted=[],wheels=[],headlampLids=[];
    for(const level of [near,far]){
      level.traverse(obj=>{
        if(obj.material===m.paint)painted.push(obj);
        if(obj.name.startsWith('Wheel '))wheels.push(obj);
        if(obj.name.startsWith('Roadster headlamp lid ')&&obj.isGroup)headlampLids.push(obj);
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
    const shadow=new T.Mesh(item.shadow,footprint);shadow.position.y=.045;
    const head=new T.Mesh(item.head,headPool),tail=new T.Mesh(item.tail,redPool);
    root.add(near,far,glows,signals,shadow,head,tail);
    let angle=0;
    function draw({rel,elapsed,velocity,night,wet,signal,signalDirection}){
      const range=Math.abs(rel);near.visible=range<52;far.visible=!near.visible;
      const lidAngle=.46*T.MathUtils.smoothstep(Math.max(night,wet*.65),.10,.55);
      for(const lid of headlampLids)lid.rotation.x=lidAngle;
      if(elapsed){
        angle=(angle-Math.abs(velocity)*elapsed/spec.wheelRadius)%(Math.PI*2);
        for(const wheel of wheels)wheel.rotation.x=angle;
      }
      const lowBeam=Math.max(night,wet*.61);
      glows.visible=lowBeam>.17&&range<76;head.visible=lowBeam>.15&&range<100;
      tail.visible=wet>.08&&night>.10&&range<75;signals.visible=signal;
      if(signal)signals.children.forEach(lamp=>lamp.visible=Math.sign(lamp.position.x)===signalDirection);
    }
    return {root,draw,repaint,width:spec.width/2,length:spec.length/2};
  }
  function light(night,wet){
    const lowBeam=Math.max(night,wet*.61);
    m.front.emissiveIntensity=.31+lowBeam*3.6;m.rear.emissiveIntensity=.13+Math.max(night,wet*.48)*1.70;
    m.projector.emissiveIntensity=lowBeam**1.4*2.75;
    haloMaterial.opacity=lowBeam*.36;headPool.opacity=lowBeam*(.20+.30*wet);redPool.opacity=night*wet*.34;
  }
  return {build,light,setReflection,paletteCount:type=>fleet[type].paints.length};
}
