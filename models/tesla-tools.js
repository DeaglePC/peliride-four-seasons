import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function add(ctx,geometry,material){
  const mesh=new ctx.T.Mesh(geometry,material);
  ctx.group.add(mesh);
  return mesh;
}

export function surface(ctx,material,vertices,indices){
  const g=new ctx.T.BufferGeometry();
  g.setAttribute('position',new ctx.T.Float32BufferAttribute(vertices.flat(),3));
  g.setIndex(indices.flat());g.computeVertexNormals();
  return add(ctx,g,material);
}

export function panel(ctx,material,points){
  const indices=[];
  for(let i=1;i+1<points.length;i++)indices.push(0,i,i+1);
  return surface(ctx,material,points,indices);
}

export function box(ctx,material,center,size,bevel=0){
  const geometry=bevel>0?new RoundedBoxGeometry(...size,ctx.detailed?2:1,bevel):new ctx.T.BoxGeometry(...size);
  const mesh=add(ctx,geometry,material);
  mesh.position.fromArray(center);
  return mesh;
}

export function line(ctx,material,points,radius=.009,smooth=false){
  const T=ctx.T,vertices=points.map(p=>new T.Vector3(...p));
  let path;
  if(smooth&&vertices.length>2){
    path=new T.CatmullRomCurve3(vertices);
  }else{
    path=new T.CurvePath();
    for(let i=1;i<vertices.length;i++)path.add(new T.LineCurve3(vertices[i-1],vertices[i]));
  }
  return add(ctx,new T.TubeGeometry(path,Math.max(2,(points.length-1)*(smooth?4:3)),radius,ctx.detailed?6:4,false),material);
}

// Interpolate the designer's longitudinal cross-sections without overshooting
// the nose, trunk or full width near a turning point.
function sectionValue(rows,i,z,column){
  const a=rows[i],b=rows[i+1],span=b[0]-a[0],t=clamp((z-a[0])/span,0,1);
  const value=row=>row[column]??.25;
  const slope=(left,right)=>(value(right)-value(left))/(right[0]-left[0]);
  const m=slope(a,b);
  const tangent=(v,w)=>v*w>0?2*v*w/(v+w):0;
  const d0=i?tangent(slope(rows[i-1],a),m):m;
  const d1=i+2<rows.length?tangent(m,slope(b,rows[i+2])):m;
  return (1-t)*value(a)+t*value(b)+t*(1-t)*((1-t)*(span*d0-(value(b)-value(a)))+t*((value(b)-value(a))-span*d1));
}

export function shellProfile(spec,stations,z){
  let i=0;while(i<stations.length-2&&stations[i+1][0]<z)i++;
  const width=sectionValue(stations,i,z,1),topY=sectionValue(stations,i,z,3),lowerY=sectionValue(stations,i,z,4);
  const radius=spec.wheelRadius+.04;
  const dz=Math.abs(Math.abs(z-(spec.axleMid??0))-spec.wheelbase/2);
  const archY=dz<radius?Math.max(lowerY,spec.wheelRadius+Math.sqrt(radius**2-dz**2)):lowerY;
  return {width,topY,lowerY,archY,shoulderY:Math.max(sectionValue(stations,i,z,2),archY+.029)};
}

const flank=[[0,.951],[.22,.988],[.72,1],[1,.992]];
const crown=[[0,1],[.51,.96],[.80,.74],[.94,.38],[1,0]];
function sampleProfile(points,t){
  for(let i=1;i<points.length;i++){
    const [lo,a]=points[i-1],[hi,b]=points[i];
    if(t<=hi)return a+(b-a)*clamp((t-lo)/(hi-lo),0,1);
  }
  return points.at(-1)[1];
}
function sideAt(p,z,y,side,offset=0){
  const t=clamp((y-p.archY)/(p.shoulderY-p.archY),0,1);
  return [side*(p.width*sampleProfile(flank,t)+offset),y,z];
}
function deckAt(p,z,u,lift=0){
  return [u*p.width*.992,p.shoulderY+(p.topY-p.shoulderY)*sampleProfile(crown,Math.abs(u))+lift,z];
}
export function sidePoint(spec,stations,z,y,side,offset=0){return sideAt(shellProfile(spec,stations,z),z,y,side,offset)}
export function deckPoint(spec,stations,z,u,lift=0){return deckAt(shellProfile(spec,stations,z),z,u,lift)}

export function bodyShell(ctx,spec,stations){
  const first=stations[0][0],last=stations.at(-1)[0],zs=new Set(stations.map(s=>s[0]));
  const n=Math.ceil((last-first)/(ctx.detailed?.12:.25));
  for(let i=1;i<n;i++)zs.add(first+(last-first)*i/n);
  const radius=spec.wheelRadius+.04;
  for(const wheel of [-1,1]){
    const axle=(spec.axleMid??0)+wheel*spec.wheelbase*.5;
    const segments=ctx.detailed?26:12;
    for(let j=0;j<=segments;j++)zs.add(axle+radius*Math.cos(Math.PI*j/segments));
    for(const sign of [-1,1])zs.add(axle+sign*(radius+.006));
  }
  const rings=[...zs].filter(z=>z>=first&&z<=last).sort((a,b)=>a-b).filter((z,i,a)=>!i||z-a[i-1]>.0001);
  // A hairline pair at each wheel arch tangent gives the arch a vertical lower
  // return, instead of stretching the entire rocker up to the axle height.
  const vertices=[],indices=[],liners=[],linerFaces=[];
  let ringSize=0;
  for(const [i,z] of rings.entries()){
    const p=shellProfile(spec,stations,z),ring=[];
    for(const [t] of flank.slice(0,-1))ring.push(sideAt(p,z,p.archY+t*(p.shoulderY-p.archY),-1));
    for(const u of [-1,-.94,-.80,-.51,0,.51,.80,.94,1])ring.push(deckAt(p,z,u));
    for(const [t] of flank.slice(0,-1).reverse())ring.push(sideAt(p,z,p.archY+t*(p.shoulderY-p.archY),1));
    ringSize=ring.length;vertices.push(...ring);
    if(i){
      const k=(i-1)*ringSize;
      for(let j=0;j<ringSize-1;j++)indices.push(k+j,k+j+ringSize,k+j+1,k+j+1,k+j+ringSize,k+j+ringSize+1);
    }
    for(const s of [-1,1]){
      liners.push(sideAt(p,z,p.archY,s),[s*p.width*.67,p.archY-.015,z]);
      if(i){
        const k=(i-1)*4+(s>0?2:0);
        linerFaces.push(k,k+1,k+4,k+1,k+5,k+4);
      }
    }
    if(i===0||i===rings.length-1){
      const cap=panel(ctx,ctx.m.paint,i===0?ring:ring.slice().reverse());
      cap.name=i?'Tail fascia':'Nose fascia';
    }
  }
  const shell=surface(ctx,ctx.m.paint,vertices,indices);
  shell.name='Sculpted body with open wheel arches';
  surface(ctx,ctx.m.black,liners,linerFaces);
  return shell;
}
