// Original game geometry, eye-modelled against Tesla's current exterior photos.
// https://www.tesla.cn/cybertruck and https://www.tesla.cn/roadster
import {bodyShell,box,deckPoint,line,panel,shellProfile,sidePoint,surface} from './tesla-tools.js';
import {mergeParts} from './tesla-wheels.js';

const mix=(a,b,t)=>a+(b-a)*t;
function blend(a,b,t){return a.map((v,i)=>mix(v,b[i],t));}
function facing(ctx,material,vertices,outward){
  const a=vertices[0],b=vertices[1],c=vertices[2];
  const ab=b.map((x,i)=>x-a[i]),ac=c.map((x,i)=>x-a[i]);
  const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  return panel(ctx,material,normal.reduce((s,v,i)=>s+v*outward[i],0)<0?[...vertices].reverse():vertices);
}
function patch(ctx,mat,fn,out,nu,nv){
  const vs=[],ix=[],T=ctx.T;
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)vs.push(fn(i/nu,j/nv));
  const a=new T.Vector3(...fn(.49,.49));
  const u=new T.Vector3(...fn(.51,.49)).sub(a),v=new T.Vector3(...fn(.49,.51)).sub(a);
  const flip=u.cross(v).dot(new T.Vector3(...out))<0;
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const k=j*(nu+1)+i,l=k+nu+1;
    ix.push(...(flip?[k,l,k+1,k+1,l,l+1]:[k,k+1,l,k+1,l+1,l]));
  }
  return surface(ctx,mat,vs,ix);
}
function linear(rows,z,index){
  for(let i=1;i<rows.length;i++)if(z<=rows[i][0]){
    const a=rows[i-1],b=rows[i];return mix(a[index],b[index],Math.max(0,(z-a[0])/(b[0]-a[0])));
  }
  return rows.at(-1)[index];
}

// Optical light guides have a front face, a polished return and a separate
// curved cover. Their cross sections continue around the bends at the corners.
function lightGuide(ctx,path,sign,material,height,depth,lift=0,yOffset=0){
  const verts=[],idx=[],ring=ctx.detailed?10:6;
  for(let i=0;i<path.length;i++){
    const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],p=path[i];
    const length=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
    const nx=-(b[2]-a[2])/length*sign,nz=(b[0]-a[0])/length*sign;
    for(let j=0;j<ring;j++){
      const angle=2*Math.PI*j/ring,d=lift+Math.cos(angle)*depth*.5;
      verts.push([p[0]+nx*d,p[1]+yOffset+Math.sin(angle)*height*.5,p[2]+nz*d]);
      if(i){const k=(i-1)*ring+j,l=(i-1)*ring+(j+1)%ring;idx.push(k,k+ring,l,l,k+ring,l+ring);}
    }
  }
  if(sign<0)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  return surface(ctx,material,verts,idx);
}
function blade(ctx,path,sign,tail,housingHeight,guideHeight){
  const {m,detailed}=ctx;
  lightGuide(ctx,path,sign,m.lampHousing,housingHeight,.032);
  if(detailed)lightGuide(ctx,path,sign,m.reflector,guideHeight*1.42,.009,.014,-guideHeight*.12);
  lightGuide(ctx,path,sign,tail?m.rear:m.front,guideHeight,.011,.022);
  if(detailed)lightGuide(ctx,path,sign,tail?m.rearLens:m.opticLens,housingHeight*.82,.021,.026);
}

// A cutaway projector: a dark bezel, a polished tapered reflector, a convex
// optical element and a small emitter. On an unlit car the lens remains dark.
function projector(ctx,x,y,z,rx,ry){
  const {m}=ctx,verts=[],indices=[],n=16;
  const rings=[[1.17,.005],[1,0],[.78,.010]];
  for(let r=0;r<rings.length;r++)for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;
    verts.push([x+Math.cos(a)*rx*rings[r][0],y+Math.sin(a)*ry*rings[r][0],z+rings[r][1]]);
    if(r){const k=(r-1)*n+i,l=(r-1)*n+(i+1)%n;indices.push(k,l,k+n,k+n,l,l+n);}
  }
  surface(ctx,m.reflector,verts,indices);
  patch(ctx,m.projector,(u,v)=>{const a=u*2*Math.PI,r=.995*(1-v);
    return [x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r,z-.012*Math.sqrt(Math.max(0,1-r*r))];},[0,0,-1],16,5);
  const chip=box(ctx,m.front,[x,y-.09*ry,z-.013],[rx*.74,ry*.24,.004],.0015);
  chip.name='Projector light source';
}

// The outer edge of the Cybertruck nose folds back in plan. Applying the same
// fold to the steel panels, bumper and front lighting keeps the joints flush.
function truckNosePoint(p,front){
  const near=Math.max(0,Math.min(1,(front+.47-p[2])/.43));
  const corner=Math.max(0,Math.abs(p[0])-.61)*.44;
  const rake=Math.max(0,.938-p[1])*.095;
  return [p[0],p[1],p[2]+near*(corner+rake)];
}
function foldNose(ctx,first,front){
  const p=new ctx.T.Vector3(),inv=new ctx.T.Matrix4();
  for(const mesh of ctx.group.children.slice(first)){
    if(!mesh.isMesh)continue;
    mesh.updateMatrix();inv.copy(mesh.matrix).invert();
    const pos=mesh.geometry.attributes.position;
    let changed=false;
    for(let i=0;i<pos.count;i++){
      p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrix);
      if(p.z>=front+.47)continue;
      p.fromArray(truckNosePoint(p.toArray(),front)).applyMatrix4(inv);
      pos.setXYZ(i,p.x,p.y,p.z);changed=true;
    }
    if(changed){pos.needsUpdate=true;mesh.geometry.computeVertexNormals();}
  }
}

const cybertruck={
  name:'Cybertruck',width:2.20,length:5.683,height:1.795,wheelRadius:.445,wheelbase:3.635,axleMid:.001,
  track:1.870,paints:[0xa5aaab],spokes:7,build:truckBody
};
const roadster={
  name:'Roadster',width:2.010,length:4.786,height:1.260,wheelRadius:.385,wheelbase:3.100,axleMid:.066,
  track:1.720,paints:[0xb5b9bd,0xa32632,0x353b44],spokes:5,build:sportsBody
};
export const specials={cybertruck,roadster};

function truckBody(ctx){
  const {m,detailed}=ctx,half=cybertruck.length/2,first=ctx.group.children.length;
  const axle=cybertruck.wheelbase/2,mid=cybertruck.axleMid;
  // z, half width, shoulder height, roof or sail height. The long straight
  // windshield and descending sail rails meet at a single steel ridge.
  const slices=[[-half,.92,.940,.940],[-2.63,.997,.974,.974],
    [-1.97,1.018,1.103,1.103],[-.34,1.027,1.198,1.795],
    [.85,1.025,1.243,1.577],[1.22,1.025,1.247,1.509],
    [2.65,.995,1.245,1.267],[half,.937,1.225,1.232]];
  const width=z=>linear(slices,z,1),belt=z=>linear(slices,z,2),ridge=z=>linear(slices,z,3);
  const sideX=(z,y)=>width(z)-.067*Math.max(0,(belt(z)-y)/Math.max(.2,belt(z)-.360));
  const side=(s,z,y,extra=0)=>[s*(sideX(z,y)+extra),y,z];
  const capX=z=>width(z)-.275*(ridge(z)-belt(z));
  const cap=(s,z)=>[s*capX(z),ridge(z),z];
  const atUpper=(s,z,t,extra=0)=>[s*(mix(width(z),capX(z),t)+extra),mix(belt(z),ridge(z),t),z];
  const outer=[[-.640,.365],[-.635,.642],[-.349,.990],[.345,.990],[.620,.685],[.644,.365]];
  const inner=[[-.504,.365],[-.511,.591],[-.286,.918],[.290,.918],[.503,.632],[.510,.365]];
  const lower=z=>{
    for(const a of [mid-axle,mid+axle])if(z>=a+outer[0][0]&&z<=a+outer.at(-1)[0])return linear(outer,z-a,1);
    return .365;
  };
  const divisions=new Set(slices.map(s=>s[0]));
  for(const a of [mid-axle,mid+axle])for(const [dz] of outer)divisions.add(a+dz);
  const zs=[...divisions].sort((a,b)=>a-b);
  for(const s of [-1,1]){
    for(let i=1;i<zs.length;i++){
      const a=zs[i-1],b=zs[i],bottomA=lower(a),bottomB=lower(b);
      const coords=[side(s,a,bottomA),side(s,b,bottomB),side(s,b,belt(b)),side(s,a,belt(a))];
      facing(ctx,m.steel,coords,[s,0,0]);
    }
    for(const a of [mid-axle,mid+axle]){
      const toward=(shape,i,edge)=>{const [dz,y]=shape[i];return [s*(width(a+dz)+edge),y,a+dz];};
      for(let i=1;i<outer.length;i++){
        const lo=toward(inner,i-1,.061),hi=toward(inner,i,.061);
        const ol=toward(outer,i-1,.022),oh=toward(outer,i,.022);
        facing(ctx,m.trim,[ol,oh,hi,lo],[s,0,0]);
        const sa=side(s,ol[2],ol[1]),sb=side(s,oh[2],oh[1]);
        facing(ctx,m.black,[sa,sb,oh,ol],[s,1,0]);
        const inside=[lo[0]-s*.255,lo[1],lo[2]],inside2=[hi[0]-s*.255,hi[1],hi[2]];
        facing(ctx,m.black,[lo,hi,inside2,inside],[0,-.8,(a-(lo[2]+hi[2])*.5)]);
      }
    }
    // Dark rocker is interrupted by the tires and tapers into both bumpers.
    for(const [a,b] of [[-half,mid-axle-.63],[mid-axle+.64,mid+axle-.64],[mid+axle+.64,half]]){
      facing(ctx,m.trim,[side(s,a,.367,.008),side(s,b,.367,.008),side(s,b,.280,-.015),side(s,a,.280,-.015)],[s,0,0]);
    }
    const glassStart=-1.86,glassEnd=.91;
    for(const [a,b] of [[-1.97,glassStart],[glassStart,-.34],[-.34,glassEnd],[glassEnd,1.22],[1.22,2.65],[2.65,half]]){
      const edge=(z,t)=>atUpper(s,z,t);
      if(a<glassStart||a>=glassEnd){
        facing(ctx,m.steel,[edge(a,0),edge(b,0),edge(b,1),edge(a,1)],[s,.15,0]);continue;
      }
      const lo=.115,hi=.94;
      facing(ctx,m.steel,[edge(a,0),edge(b,0),edge(b,lo),edge(a,lo)],[s,0,0]);
      facing(ctx,a>=-.34?m.privacyGlass:m.glass,[edge(a,lo),edge(b,lo),edge(b,hi),edge(a,hi)],[s,.1,0]);
      facing(ctx,m.steel,[edge(a,hi),edge(b,hi),edge(b,1),edge(a,1)],[s,.1,0]);
    }
    const z0=-.32;
    facing(ctx,m.black,[atUpper(s,z0-.025,.113,.001),atUpper(s,z0+.045,.113,.001),
      atUpper(s,z0+.077,.945,.001),atUpper(s,z0+.004,.945,.001)],[s,0,0]);
    line(ctx,m.trim,[atUpper(s,.897,.13,.001),atUpper(s,.900,.94,.001)],.014);
    if(detailed){
      for(const [zt,zb] of [[-1.27,-1.11],[-.285,-.24],[.94,1.05]]){
        const y0=Math.max(lower(zb)+.04,.464);
        line(ctx,m.trim,[side(s,zt,belt(zt),.004),side(s,mix(zt,zb,.6),.72,.005),side(s,zb,y0,.004)],.006);
      }
      line(ctx,m.trim,[side(s,-1.09,.462,.004),side(s,-.24,.426,.006),side(s,1.05,.464,.004)],.0055);
      const stalk=side(s,-1.27,1.20);
      line(ctx,m.trim,[stalk,[s*1.16,1.238,-1.29]],.022);
      const upper=[[s*1.055,1.284,-1.425],[s*1.222,1.277,-1.255],[s*1.055,1.281,-1.177]];
      const base=upper.map(([x,y,z])=>[x,y-.080,z+.01]);
      facing(ctx,m.black,upper,[0,1,0]);
      for(let j=0;j<3;j++)facing(ctx,j===1?m.chrome:m.trim,[upper[j],upper[(j+1)%3],base[(j+1)%3],base[j]],
        [s,0,j===0?-1:1]);
      const charge=side(s,2.42,1.095,.008);
      line(ctx,m.trim,[[charge[0],1.091,2.38],[charge[0],1.091,2.46],[charge[0],1.045,2.46]],.006);
    }
  }
  // Steel hood, windshield with a thick frit surround, glass roof and the
  // retractable vault cover. The tonneau blades run across, between the sails.
  for(const [a,b] of [[-half,-2.63],[-2.63,-1.97]]){
    const across=[-1,-.66,0,.66,1];
    for(let i=1;i<across.length;i++){
      const l=across[i-1],r=across[i];
      facing(ctx,m.steel,[cap(l,a),cap(r,a),cap(r,b),cap(l,b)],[0,1,-.15]);
    }
  }
  const glass=(z,w,up=0)=>[capX(z)*w,ridge(z)+up,z];
  function topZone(a,b,mat,edge=.942){
    const top=(z,u)=>glass(z,u);
    facing(ctx,mat,[top(a,-edge),top(a,edge),top(b,edge),top(b,-edge)],[0,1,0]);
    for(const s of [-1,1])facing(ctx,m.steel,[top(a,s*edge),top(a,s),top(b,s),top(b,s*edge)],[0,1,0]);
  }
  topZone(-1.97,-1.922,m.black);topZone(-1.922,-.363,m.glass);topZone(-.363,-.34,m.black);
  topZone(-.34,.72,m.roofGlass);topZone(.72,.79,m.black);
  topZone(.79,2.65,m.trim,.927);topZone(2.65,half,m.steel,.927);
  if(detailed){
    for(let z=.85;z<2.65;z+=.101)line(ctx,m.black,[glass(z,-.914,.004),glass(z,.914,.004)],.005);
    line(ctx,m.trim,[glass(-1.88,-.90,.014),glass(-1.33,-.902,.014),glass(-.59,-.90,.014)],.014);
  }
  const front=-half,rear=half;
  for(const [z,sign] of [[front,-1],[rear,1]]){
    const w=width(z),facet=(u,y,depth=0)=>[u*w,y,z+sign*depth];
    const xs=[-1,-.66,0,.66,1];
    for(let i=1;i<xs.length;i++){
      const a=xs[i-1],b=xs[i],top=sign<0?.691:.365;
      facing(ctx,m.steel,[facet(a,top),facet(b,top),facet(b,belt(z)),facet(a,belt(z))],[0,0,sign]);
      if(sign<0){
        facing(ctx,m.lampHousing,[facet(a,.547,-.036),facet(b,.547,-.036),facet(b,.691,-.036),facet(a,.691,-.036)],[0,0,-1]);
        facing(ctx,m.metal,[facet(a,.691),facet(b,.691),facet(b,.691,-.036),facet(a,.691,-.036)],[0,-1,0]);
        facing(ctx,m.trim,[facet(a,.548,.011),facet(b,.548,.011),facet(b,.547,-.036),facet(a,.547,-.036)],[0,1,0]);
      }
      const seam=sign<0?.548:.515;
      facing(ctx,m.trim,[facet(a,seam,.016),facet(b,seam,.016),facet(b*.87,.281,.013),facet(a*.87,.281,.013)],[0,0,sign]);
    }
    facing(ctx,m.black,[facet(-.7,.385,.019),facet(.7,.385,.019),facet(.63,.282,.016),facet(-.63,.282,.016)],[0,0,sign]);
  }
  const truckBrow=[[-.919,.938,front+.009],[-.840,.931,front+.004],[-.607,.927,front],[0,.927,front],[.607,.927,front],[.840,.931,front+.004],[.919,.938,front+.009]];
  blade(ctx,truckBrow,-1,false,.060,.027);
  // The liftgate bar and two body-mounted rear clusters are separate units.
  blade(ctx,[[-.782,1.196,rear+.006],[0,1.196,rear+.008],[.782,1.196,rear+.006]],1,true,.070,.024);
  for(const s of [-1,1]){
    const upper=[[s*.84,.496,front-.028],[s*.993,.504,front+.221],[s*1.004,.498,front+.291]],
      lowerBumper=[[s*.793,.298,front-.017],[s*.948,.282,front+.205],[s*.970,.302,front+.292]];
    facing(ctx,m.trim,[[s*.770,.282,front-.020],[s*.919,.364,front-.021],[s*.976,.401,front+.152],
      [s*.970,.302,front+.292],[s*.948,.282,front+.205]],[s,0,-.6]);
    for(let j=1;j<upper.length;j++)facing(ctx,m.trim,[upper[j-1],upper[j],lowerBumper[j],lowerBumper[j-1]],[s,0,-.4]);
    facing(ctx,m.black,[upper[0],upper[1],side(s,front+.231,.476),side(s,front,.468)],[0,1,-.4]);
    facing(ctx,m.trim,[side(s,front,.504,.016),side(s,front+.225,.504,.015),side(s,front+.30,.483,.014),
      side(s,front+.29,.304,.014),side(s,front+.18,.285,.011),side(s,front,.308,.014)],[s,0,0]);
    const chart=(x,y,d)=>[s*x,y,front-d];
    const bezel2=[[.266,.571],[.291,.656],[.800,.669],[.926,.652],[.911,.571],[.849,.554],[.31,.553]];
    const face=(loop,depth)=>loop.map(([x,y])=>chart(x,y,depth));
    const scaled=(u,v)=>bezel2.map(([x,y])=>[mix(.596,x,u),mix(.609,y,v)]);
    const outside=face(bezel2,.004),rim=face(scaled(.979,.86),.011),throat=face(scaled(.94,.70),-.026);
    for(let j=0;j<outside.length;j++){
      const k=(j+1)%outside.length;
      facing(ctx,m.black,[outside[j],outside[k],rim[k],rim[j]],[0,0,-1]);
      facing(ctx,m.lampHousing,[rim[j],rim[k],throat[k],throat[j]],[0,0,-1]);
    }
    facing(ctx,m.lampHousing,throat,[0,0,-1]);
    if(detailed){
      for(const x of [.383,.530,.667]){
        const cell=box(ctx,m.reflector,chart(x,.607,-.011),[.121,.060,.016],.012);cell.rotation.z=-s*.022;
        box(ctx,m.lampHousing,chart(x,.607,.000),[.110,.054,.010],.008);
        projector(ctx,s*x,.610,front-.007,.046,.021);
      }
      for(const x of [.770,.830]){
        const prism=box(ctx,m.reflector,chart(x,.611,-.002),[.049,.053,.019],.004);prism.rotation.y=s*.105;
        box(ctx,m.front,chart(x,.603,.011),[.034,.013,.004],.002);
      }
      patch(ctx,m.opticLens,(u,t)=>chart(mix(.279,.917,u),mix(.562,.653,t)+.010*Math.sin(Math.PI*u),
        .018+.007*Math.sin(Math.PI*t)),[0,0,-1],12,5);
      for(const x of [.864,.879,.894])box(ctx,m.amber,chart(x,.613,.017),[.007,.045,.008],.003);
    }else{
      lightGuide(ctx,[chart(.36,.612,.009),chart(.82,.612,.009)].sort((a,b)=>a[0]-b[0]),-1,m.front,.023,.010);
    }
    const corner=[chart(.916,.935,-.018),chart(.976,.940,-.154)].sort((a,b)=>a[0]-b[0]);
    lightGuide(ctx,corner,-1,m.amber,.018,.018);
    const tailPath=[[s*.795,1.196,rear+.005],[s*.901,1.196,rear+.005],
      [s*.937,1.202,rear-.020],[s*.965,1.212,rear-.108]].sort((a,b)=>a[0]-b[0]);
    blade(ctx,tailPath,1,true,.072,.029);
    if(detailed){
      for(let j=0;j<4;j++)box(ctx,m.rearLens,[s*(.811+j*.022),1.196,rear+.039],[.006,.036,.006],.001);
      const back=box(ctx,m.reflector,[s*.758,.441,rear+.026],[.118,.036,.018],.007);
      box(ctx,m.opticLens,[back.position.x,.442,rear+.040],[.125,.046,.010],.004);
    }
  }
  if(detailed){
    const lowerSlot=[[-.491,.384,front-.012],[-.424,.424,front-.012],[.424,.424,front-.012],[.491,.384,front-.012],[.463,.318,front-.012],[-.463,.318,front-.012]];
    facing(ctx,m.lampHousing,lowerSlot,[0,0,-1]);
    for(let i=-5;i<=5;i++)box(ctx,m.trim,[i*.074,.370,front-.023],[.014,.072,.012],.002);
    box(ctx,m.lampHousing,[0,.617,front+.012],[.45,.113,.025],.006);
    box(ctx,m.projector,[0,.635,front-.007],[.037,.028,.011],.008);
    // Vertical tailgate shut lines coincide with the break between the fixed
    // combination lamps and the cross-car lamp in the moving metal panel.
    for(const s of [-1,1]){
      line(ctx,m.lampHousing,[[s*.789,1.150,rear+.005],[s*.791,.797,rear+.005],[s*.787,.526,rear+.006]],.0043);
      line(ctx,m.metal,[[s*.780,1.147,rear+.004],[s*.782,.535,rear+.004]],.0024);
    }
    box(ctx,m.lampHousing,[0,.443,rear+.024],[.426,.127,.034],.007);
    box(ctx,m.metal,[0,.444,rear+.044],[.387,.103,.007],.004);
    for(let i=0;i<6;i++)box(ctx,m.black,[.04*(i-2.5),.444,rear+.050],[.015,.037,.006]);
    box(ctx,m.trim,[0,.269,rear+.009],[.110,.094,.115],.007);
    box(ctx,m.black,[0,.269,rear+.069],[.073,.061,.006],.004);
  }
  foldNose(ctx,first,front);
  return {headlights:[-.54,.54].map(x=>truckNosePoint([x,.610,front-.025],front)),
    rearSignals:[[-.858,1.196,rear+.043],[.858,1.196,rear+.043]]};
}

// Cut the shutter out of the upper skin itself. Intersection vertices carry
// the original surface normal, so the flush lid matches the surrounding paint.
function splitLid(T,shell,side,outline){
  const g=shell.geometry,pos=g.attributes.position,norm=g.attributes.normal;
  const keep={p:[],n:[]},lid={p:[],n:[]};
  const area=outline.reduce((v,[x,z],i)=>{const b=outline[(i+1)%outline.length];return v+x*b[1]-z*b[0];},0);
  function piece(poly,target){
    for(let j=1;j+1<poly.length;j++)for(const v of [poly[0],poly[j],poly[j+1]]){
      target.p.push(v[0],v[1],v[2]);target.n.push(v[3],v[4],v[5]);
    }
  }
  for(let i=0,count=g.index?g.index.count:pos.count;i<count;i+=3){
    let poly=[];
    for(let j=0;j<3;j++){
      const k=g.index?g.index.getX(i+j):i+j;
      poly.push([pos.getX(k),pos.getY(k),pos.getZ(k),norm.getX(k),norm.getY(k),norm.getZ(k)]);
    }
    if(poly.every(v=>side*v[0]<.61)||poly.every(v=>side*v[0]>.95)||poly.every(v=>v[2]<-2.36)||poly.every(v=>v[2]>-1.92)||poly.every(v=>v[4]<.43)){
      piece(poly,keep);continue;
    }
    for(let j=0;j<outline.length&&poly.length;j++){
      const [x,z]=outline[j],[ex,ez]=outline[(j+1)%outline.length];
      const dist=p=>Math.sign(area)*((ex-x)*(p[2]-z)-(ez-z)*(side*p[0]-x));
      const inside=[],outside=[];
      for(let k=0;k<poly.length;k++){
        const a=poly[k],b=poly[(k+1)%poly.length],da=dist(a),db=dist(b);
        (da>=0?inside:outside).push(a);
        if((da>=0)!==(db>=0)){
          const v=blend(a,b,da/(da-db));inside.push(v);outside.push(v);
        }
      }
      piece(outside,keep);poly=inside;
    }
    piece(poly,lid);
  }
  function geometry(data){
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(data.p,3));
    geom.setAttribute('normal',new T.Float32BufferAttribute(data.n,3));geom.normalizeNormals();return geom;
  }
  shell.geometry=geometry(keep);g.dispose();return geometry(lid);
}

function roadsterHeadlamps(ctx,shell,rows){
  const {T,m}=ctx,assembly=new T.Group(),stationary=new T.Group();
  assembly.name='Roadster concealed headlamps';
  const fixed={...ctx,group:stationary};
  // Front hinge, shallow triangular door that drops away from a fixed pair of
  // jewel optics. The notch is narrow at the nose and opens at the front wing.
  const outline=[[.687,-2.348],[.753,-2.300],[.879,-2.066],[.912,-1.981],[.847,-1.955],[.682,-2.075],[.665,-2.183]];
  const anchors=[];
  for(const s of [-1,1]){
    const profile=(x,z)=>deckPoint(roadster,rows,z,s*x/(shellProfile(roadster,rows,z).width*.992));
    const cut=outline.map(([x,z])=>profile(x,z));
    const hinge=profile(.703,-2.350),pivot=new T.Group();pivot.position.fromArray(hinge);
    pivot.name='Roadster headlamp lid '+(s<0?'L':'R');
    const flap=new T.Mesh(splitLid(T,shell,s,outline),m.paint);
    flap.name='Body-colour flush shutter';flap.position.set(-hinge[0],-hinge[1],-hinge[2]);pivot.add(flap);assembly.add(pivot);
    for(let j=0;j<cut.length;j++){
      const a=cut[j],b=cut[(j+1)%cut.length];
      facing(fixed,m.lampHousing,[a,b,[b[0],b[1]-.163,b[2]],[a[0],a[1]-.163,a[2]]],[s,0,-1]);
    }
    facing(fixed,m.black,cut.map(([x,y,z])=>[x,y-.163,z]),[0,1,0]);
    // A single shallow seal catches a restrained highlight when the lid is shut.
    line(fixed,m.trim,[...cut,cut[0]],.0018);
    const y=profile(.815,-2.025)[1]-.052,z=-2.029;
    const backs=box(fixed,m.lampHousing,[s*.816,y,z+.022],[.130,.067,.043],.008);
    backs.rotation.y=s*.065;
    projector(fixed,s*.795,y,z,.032,.021);
    projector(fixed,s*.856,y+.007,z+.011,.022,.018);
    patch(fixed,m.opticLens,(u,t)=>[s*mix(.757,.885,u),mix(y-.031,y+.038,t)+.007*u,
      z-.014+.012*u-.004*Math.sin(Math.PI*t)],[0,0,-1],7,3);
    anchors.push([s*.795,y,z-.017]);
  }
  const fields=mergeParts(T,stationary);fields.name='Fixed optics and aperture seals';assembly.add(fields);
  return {group:assembly,anchors};
}

function sportsBody(ctx){
  const {m,detailed}=ctx,half=roadster.length/2;
  // Lower hood center than the front-fender crowns, pinched middle and
  // elevated rear haunches, as on the silver Performance coupe.
  const rows=[[-half,.715,.475,.481,.144],[-2.29,.805,.523,.500,.150],[-2.05,.924,.665,.570,.154],
    [-1.71,.987,.817,.787,.166],[-1.46,.993,.849,.829,.181],[-1.18,.965,.828,.808,.187],
    [-.79,.922,.786,.808,.190],[-.1,.912,.805,.834,.194],[.67,.933,.877,.866,.198],
    [1.12,.967,.931,.878,.200],[1.62,1.005,.946,.890,.209],[1.98,.994,.937,.906,.223],
    [2.24,.954,.889,.887,.259],[half,.910,.848,.854,.307]];
  const shell=bodyShell(ctx,roadster,rows);
  const rearClosure=ctx.group.children.find(mesh=>mesh.name==='Tail fascia');
  ctx.group.remove(rearClosure);rearClosure.geometry.dispose();
  const side=(s,z,y,extra=.003)=>sidePoint(roadster,rows,z,y,s,extra);
  const deck=(z,u,lift=.005)=>deckPoint(roadster,rows,z,u,lift);
  // Windshield and rear glass boundaries are bowed across the car. The
  // rear glass narrows between broad painted flying buttresses.
  function windshield(t,u,lift=0){
    const w=mix(.778,.637,t),z=mix(-1.400,-.255,t)+u*u*mix(.148,.056,t);
    return [u*w,mix(.786,1.236,t)+.036*Math.sin(Math.PI*t)-u*u*mix(.008,.033,t)+lift,z];
  }
  function backlight(t,u,lift=0){
    return [u*mix(.523,.609,t),mix(.908,1.224,t)-u*u*mix(.006,.032,t)+.019*Math.sin(Math.PI*t)+lift,
      mix(1.764,.598,t)-u*u*mix(.117,.048,t)];
  }
  function greenhouse(s,t,k,extra=0){
    const a=windshield(t,s),b=backlight(t,s);
    const endWidth=mix(.850,.626,t);
    b[0]=s*endWidth;
    const p=blend(a,b,k);p[0]+=s*(.042*Math.sin(Math.PI*k)*(1-t)+extra);
    p[1]+=.015*Math.sin(Math.PI*k)*t;return p;
  }
  const steps=detailed?14:7;
  for(const [fn,dir] of [[windshield,-1],[backlight,1]]){
    patch(ctx,m.glass,(u,t)=>fn(t,u*2-1),[0,1,dir],steps,steps/2|0);
    if(detailed)for(const s of [-1,1]){
      line(ctx,m.trim,Array.from({length:8},(_,i)=>fn(i/7,s,.004)),.009,true);
    }
  }
  for(const s of [-1,1]){
    function sidePatch(t0,t1,k0,k1,mat){
      patch(ctx,mat,(u,t)=>greenhouse(s,mix(t0,t1,t),mix(k0,k1,u)),[s,.15,0],steps,5);
    }
    // Painted sill rises toward the rear, shortening the visible quarter light.
    sidePatch(0,.12,0,1,m.paint);sidePatch(.12,.938,0,.017,m.trim);
    sidePatch(.12,.938,.017,.433,m.glass);sidePatch(.12,.938,.433,.454,m.trim);
    sidePatch(.12,.938,.454,.793,m.privacyGlass);sidePatch(.12,.938,.793,1,m.paint);
    sidePatch(.938,1,0,1,m.paint);
    patch(ctx,m.paint,(u,t)=>blend(backlight(t,s),greenhouse(s,t,1),u),[s,1,.3],4,steps);
    const frontAxle=roadster.axleMid-roadster.wheelbase/2,rearAxle=roadster.axleMid+roadster.wheelbase/2;
    const sillZ0=frontAxle+.435,sillZ1=rearAxle-.435;
    const rocker=[side(s,sillZ0,.311,.008),side(s,-.14,.320,.008),side(s,.703,.359,.008),
      side(s,sillZ1,.421,.008),side(s,sillZ1,.211,.001),side(s,sillZ0,.181,.001)];
    facing(ctx,m.trim,rocker,[s,0,0]);
    const bumperEdge=[[1.92,.473],[2.045,.495],[2.18,.551],[half,.681]];
    patch(ctx,m.trim,(u,t)=>{
      const z=mix(1.955,half,u),bottom=shellProfile(roadster,rows,z).archY;
      return side(s,z,mix(bottom,Math.max(bottom+.001,linear(bumperEdge,z,1)),t),.012);
    },[s,0,.1],detailed?26:14,8);
    patch(ctx,m.trim,(u,t)=>{
      const z=mix(-half,-1.922,u),p=shellProfile(roadster,rows,z);
      return side(s,z,mix(p.archY,Math.max(p.archY+.001,mix(.214,.268,u)),t),.008);
    },[s,0,-.15],detailed?22:10,5);
    if(detailed){
      const f=greenhouse(s,.125,.098),b=greenhouse(s,.125,.721);
      line(ctx,m.trim,[f,side(s,-.920,.712,.006),side(s,-.844,.365,.006),side(s,-.75,.327,.006),
        side(s,.602,.348,.006),side(s,.699,.447,.006),side(s,.80,.725,.006),b],.0045,true);
      line(ctx,m.trim,[side(s,-1.175,.744,.007),side(s,-.999,.749,.007)],.012);
      line(ctx,m.trim,[side(s,.673,.807,.006),side(s,.780,.816,.006)],.008);
      const stalk=greenhouse(s,.233,.081);
      line(ctx,m.trim,[stalk,[stalk[0]+s*.063,stalk[1]+.017,stalk[2]-.012]],.013);
      const lens=box(ctx,m.paint,[stalk[0]+s*.088,stalk[1]+.024,stalk[2]-.022],[.112,.057,.131],.024);
      lens.rotation.z=-s*.1;
      line(ctx,m.lampHousing,Array.from({length:8},(_,i)=>{const t=i/7;return deck(mix(-1.955,-1.385,t),s*mix(.847/(shellProfile(roadster,rows,-1.955).width*.992),.826,t),.002);}),.0019,true);
    }
  }
  patch(ctx,m.roofGlass,(u,t)=>{
    const a=windshield(1,u*2-1),b=backlight(1,u*2-1),p=blend(a,b,t);
    p[1]+=.027*Math.sin(Math.PI*t)*(1-(u*2-1)**2)+.013*Math.sin(Math.PI*t);return p;
  },[0,1,0],steps,steps);
  if(detailed){
    line(ctx,m.trim,[windshield(.047,-.84,.008),windshield(.070,-.31,.009),windshield(.075,.21,.009)],.0075,true);
    line(ctx,m.trim,[windshield(.041,.17,.009),windshield(.064,.58,.009),windshield(.081,.83,.009)],.006,true);
  }
  const front=-half,rear=half;
  const nose=(x,y,extra=0)=>[x,y,front-extra];
  // The body-colour pop-down headlamp doors occupy the fender corners. The
  // narrow white blade below them is a separate running light, over a bowed
  // black brow and a deep cooling slot with a moulded lower splitter.
  patch(ctx,m.lampHousing,(u,t)=>{const q=u*2-1;return nose(q*mix(.673,.711,t),mix(.309,.463,t)-.012*q*q,
    .009+.021*Math.sin(Math.PI*t)+.011*(1-q*q));},[0,0,-1],detailed?18:8,5);
  const frontGuide=[[-.702,.459,front-.009],[-.630,.463,front-.012],[0,.467,front-.016],
    [.630,.463,front-.012],[.702,.459,front-.009]];
  blade(ctx,frontGuide,-1,false,.035,.0125);
  const outerMouth=[[-.675,.307],[-.534,.302],[0,.307],[.534,.302],[.675,.307],
    [.641,.169],[.475,.164],[-.475,.164],[-.641,.169]];
  const innerMouth=outerMouth.map(([x,y])=>[x*.968,mix(.234,y,.69)]);
  patch(ctx,m.lampHousing,(u,t)=>nose((u*2-1)*mix(.664,.688,t),
    mix(.161,.332,t),.003),[0,0,-1],8,2);
  facing(ctx,m.black,innerMouth.map(([x,y])=>nose(x,y,.005)),[0,0,-1]);
  for(let j=0;j<outerMouth.length;j++){
    const k=(j+1)%outerMouth.length,a=outerMouth[j],b=outerMouth[k],c=innerMouth[k],d=innerMouth[j];
    facing(ctx,m.trim,[nose(...a,.043),nose(...b,.043),nose(...c,.006),nose(...d,.006)],[0,0,-1]);
  }
  const splitter=[[-.710,.151,front-.017],[-.620,.147,front-.060],[0,.153,front-.076],[.620,.147,front-.060],[.710,.151,front-.017]];
  lightGuide(ctx,splitter,-1,m.trim,.037,.049);
  if(detailed){
    for(const x of [-.466,-.252,.252,.466]){
      const guide=box(ctx,m.lampHousing,nose(x,.235,.017),[.018,.101,.048],.002);
      guide.rotation.z=-Math.sign(x)*.18;
    }
    box(ctx,m.projector,nose(0,.284,.022),[.034,.024,.014],.007);
  }
  // A deep diffuser rises behind the rear tires; the thin red blade floats
  // beneath the rear deck, with a crease continuing around each corner.
  const tail=(x,y,extra=.006)=>[x,y,rear+extra];
  patch(ctx,m.paint,(u,t)=>{
    const v=2*u-1,top=deck(rear,v,0);
    return blend(tail(v*.904,.783,-.004),top,t);
  },[0,.04,1],12,2);
  patch(ctx,m.metal,(u,t)=>tail((2*u-1)*mix(.898,.903,t),mix(.749,.781,t),mix(-.014,.006,t)),[0,.15,1],8,2);
  patch(ctx,m.paint,(u,t)=>{
    const q=2*u-1,edge=.573+.105*Math.abs(q)**2;
    return tail(q*mix(.899,.898,t),mix(edge,.750,t),-.012-.031*(1-t)*(1-q*q));
  },[0,-.07,1],12,4);
  const duct=[[-.637,.529],[-.514,.568],[.514,.568],[.637,.529],[.606,.299],[.498,.256],[-.498,.256],[-.606,.299]];
  // The inner dish sits fourteen centimetres inside the outer lip; the floor
  // and sidewalls converge into the recess and meet the diffuser strakes.
  const rim=duct.map(([x,y])=>tail(x,y,.013)),well=duct.map(([x,y])=>tail(x*.865,mix(.406,y,.74),-.143));
  facing(ctx,m.black,well,[0,0,1]);
  for(let j=0;j<rim.length;j++){
    const k=(j+1)%rim.length;
    facing(ctx,m.lampHousing,[rim[j],rim[k],well[k],well[j]],[0,0,1]);
  }
  facing(ctx,m.trim,[tail(-.899,.677,-.011),tail(-.670,.631,-.025),tail(0,.573,-.043),tail(.670,.631,-.025),tail(.899,.677,-.011),
    rim[3],rim[2],rim[1],rim[0]],[0,0,1]);
  for(const s of [-1,1]){
    const edge=(y)=>side(s,rear,y);
    facing(ctx,m.trim,[edge(.676),tail(s*.637,.529,.013),tail(s*.606,.299,.013),tail(s*.498,.256,.013),
      edge(.309),edge(.406)],[s*.3,0,1]);
  }
  // The curved trailing floor closes the undertray below the fins.
  patch(ctx,m.trim,(u,t)=>{
    const x=2*u-1,a=Math.abs(x);
    return tail(x*mix(.810,.765,t),mix(.199,.218,t)+a*a*.073,
      mix(-.320,.020,t)-.047*a*a);
  },[0,1,.15],18,3);
  patch(ctx,m.lampHousing,(u,t)=>{
    const x=2*u-1,a=Math.abs(x);
    return tail(x*.765,.218+a*a*.073-.021*t,.020-.047*a*a-.022*t);
  },[0,0,1],18,2);
  const rearGuide=[[-.905,.823,rear+.004],[-.802,.826,rear+.008],[0,.826,rear+.010],[.802,.826,rear+.008],[.905,.823,rear+.004]];
  blade(ctx,rearGuide,1,true,.080,.018);
  for(const s of [-1,1]){
    const marker=[side(s,1.978,.478,.014),side(s,2.080,.514,.014)];
    line(ctx,m.rearLens,marker,.012);
    if(detailed){
      const p=side(s,2.034,.500,.020);box(ctx,m.rear,p,[.006,.010,.031],.002);
      line(ctx,m.lampHousing,[side(s,2.211,.682,.012),side(s,2.124,.549,.012)],.0045);
    }
  }
  if(detailed){
    for(const x of [-.573,-.326,0,.326,.573]){
      const base=.218+.072*(x/.765)**2,height=.18+(1-Math.abs(x))*.13;
      const shape=[[base,rear+.025],[base+.022,rear-.255],[base+height,rear-.18],[base+height*.85,rear-.025],[base+.09,rear+.018]];
      const half=.009;
      for(const sign of [-1,1])facing(ctx,m.lampHousing,shape.map(([y,z])=>[x+sign*half,y,z]),[sign,0,0]);
      for(let j=0;j<shape.length;j++){
        const k=(j+1)%shape.length,a=shape[j],b=shape[k];
        facing(ctx,m.trim,[[x-half,...a],[x+half,...a],[x+half,...b],[x-half,...b]],[0,0,1]);
      }
    }
    box(ctx,m.black,[0,.642,rear-.016],[.318,.153,.030],.008);
    box(ctx,m.metal,[0,.643,rear+.002],[.302,.139,.009],.006);
    for(let i=0;i<6;i++)box(ctx,m.black,[(i-2.5)*.032,.642,rear+.009],[.011,.044,.005]);
  }
  const lamps=detailed?roadsterHeadlamps(ctx,shell,rows):null;
  return {headlights:lamps?.anchors??[[-.795,.61,-2.05],[.795,.61,-2.05]],
    rearSignals:[[-.867,.826,rear+.038],[.867,.826,rear+.038]],deployedHeadlights:lamps?.group};
}
