import {surface} from './tesla-tools.js';

// Bake the fixed panels once per model/LOD. Wheel pivots remain outside these
// batches so the same buffers can be instanced on all four corners and paints.
export function mergeParts(T,source){
  source.updateMatrixWorld(true);
  const batches=new Map(),p=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3();
  const disposable=new Set();
  source.traverse(part=>{
    if(!part.isMesh)return;
    const geo=part.geometry,mat=part.material;
    if(!batches.has(mat))batches.set(mat,{position:[],normal:[],indices:[],uv:[]});
    const data=batches.get(mat),offset=data.position.length/3,mirrored=part.matrixWorld.determinant()<0;
    const points=geo.getAttribute('position');
    if(!geo.getAttribute('normal'))geo.computeVertexNormals();
    const normals=geo.getAttribute('normal');
    nm.getNormalMatrix(part.matrixWorld);
    for(let i=0;i<points.count;i++){
      p.fromBufferAttribute(points,i).applyMatrix4(part.matrixWorld);
      n.fromBufferAttribute(normals,i).applyMatrix3(nm).normalize();
      data.position.push(p.x,p.y,p.z);data.normal.push(n.x,n.y,n.z);
      if(mat.roughnessMap)data.uv.push((p.z+p.x*.34)*.67,p.y*1.4);
    }
    const ix=geo.index,len=ix?ix.count:points.count;
    for(let i=0;i<len;i+=3){
      const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;
      data.indices.push(offset+a,offset+(mirrored?c:b),offset+(mirrored?b:c));
    }
    disposable.add(geo);
  });
  const out=new T.Group();
  for(const [material,data] of batches){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(data.position,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(data.normal,3));
    if(data.uv.length)geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));
    geometry.setIndex(data.indices);geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,material);mesh.name=material.name;
    out.add(mesh);
  }
  for(const geo of disposable)geo.dispose();
  return out;
}

// Positive X is the outer face. The axial/radial section models tread, rolled
// shoulders, sidewall and bead independently of the metal rim.
export function wheelAssembly(T,m,spec,model,detailed){
  const group=new T.Group(),ctx={T,group,m,detailed};
  const r=spec.wheelRadius,w=Math.min(spec.width-spec.track,.32)*.48;
  const pickup=model==='cybertruck',rim=r*(pickup?.585:model==='roadster'?.79:.735);
  const segments=detailed?(pickup?40:48):18;
  function revolve(material,section){
    const profile=section.map(([x,radius])=>new T.Vector2(radius,x));
    const geometry=new T.LatheGeometry(profile,segments);
    geometry.rotateZ(-Math.PI/2);group.add(new T.Mesh(geometry,material));
  }
  revolve(m.black,[[-w*.93,rim*.94],[-w,r*.85],[-w*.96,r*.95],[-w*.71,r],[w*.66,r],[w*.95,r*.96],[w,r*.86],[w*.93,rim*.96]]);
  revolve(m.trim,[[w*.74,.009],[w*.76,rim*.88],[w*.87,rim],[w*.96,rim],[w*.99,rim*.92]]);
  revolve(m.metal,[[w*.72,.008],[w*.72,rim*.69],[w*.76,rim*.71]]);
  if(detailed){
    revolve(m.trim,[[w*.982,r*.92],[w*.992,r*.90],[w*.984,r*.89]]);
    revolve(m.chrome,[[w*.976,rim*.97],[w*.984,rim],[w*.955,rim*1.015]]);
  }
  const count=Number.isInteger(spec.spokes)?spec.spokes:({model3:5,modelY:7,modelS:10,modelX:10,cybertruck:7,roadster:8})[model];
  const step=2*Math.PI/count,sweep=pickup?.025:model==='modelS'?.24:.36;
  const dark=pickup||model==='model3'||model==='modelY';
  for(let k=0;k<count;k++){
    const base=k*step;
    const point=(x,rad,angle)=>[x,rad*Math.cos(base+angle*step),rad*Math.sin(base+angle*step)];
    const blade=[
      point(w*1.02,rim*.18,-.27),point(w*1.11,rim*.38,-.19),point(w*.99,rim*.955,-sweep-.11),
      point(w*1.02,rim*.975,-sweep+(dark?.34:.15)),point(w*1.13,rim*.45,.22),point(w*1.03,rim*.2,.37)
    ];
    const crest=point(w*1.17,rim*.58,-sweep*.5+.05);
    surface(ctx,dark?m.trim:m.metal,[...blade,crest],[0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);
    if(detailed){
      surface(ctx,pickup?m.metal:m.chrome,[blade[2],blade[3],crest],[0,1,2]);
      const a=point(w*1.08,rim*.205,-.20),b=point(w*1.14,rim*.205,-.20);
      const nut=new T.Mesh(new T.CylinderGeometry(.010,.012,b[0]-a[0],6),m.metal);
      nut.rotation.z=Math.PI/2;nut.position.set((a[0]+b[0])*.5,a[1],a[2]);group.add(nut);
    }
  }
  revolve(m.trim,[[w*1.02,.003],[w*1.16,rim*.19],[w*1.19,rim*.13],[w*1.19,.001]]);
  return mergeParts(T,group);
}
