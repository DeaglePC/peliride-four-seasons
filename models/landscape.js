import {urbanSurfaces} from './vegetationUrban.js';
import {createNature} from './vegetation.js';
import {roadHeight} from '../elevation.js';
// One local metre is one metre of the ride. Scenery is built in short sections
// so a roadside tree and its shadow keep the same position as the road turns.
export function createLandscape(THREE, scene) {
  const nature=createNature(THREE),urban=urbanSurfaces(THREE);
  const span = 32, leg = 520, tau = 2 * Math.PI;
  const sectionMap = new Map();
  const palette = new Map();
  const prototypes = {};
  const dummy = new THREE.Object3D();
  const material = nature.architectureMaterial;
  const windowMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const world = new THREE.Group();
  scene.add(world);

  function hash(n) {
    const v = Math.sin(n * 91.217 + 7.131) * 43758.5453;
    return v - Math.floor(v);
  }
  function smooth(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function color(hex) {
    if (!palette.has(hex)) palette.set(hex, new THREE.Color(hex));
    return palette.get(hex);
  }
  function random(seed) {
    let a = (seed * 104729 + 999733) >>> 0;
    return () => { a = (1664525 * a + 1013904223) >>> 0; return a / 4294967296; };
  }
  function collect(geometry, key) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    prototypes[key] = flat.attributes.position.array.slice();
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  }
  collect(new THREE.BoxGeometry(1, 1, 1), 'box');
  collect(new THREE.CylinderGeometry(1, 1, 1, 14), 'pole');
  collect(new THREE.CylinderGeometry(.80, 1, 1, 16), 'taper');
  collect(new THREE.ConeGeometry(1, 1, 8), 'pine');
  collect(new THREE.ConeGeometry(1, 1, 4), 'spire');
  collect(new THREE.DodecahedronGeometry(1, 0), 'crown');
  const stone=new THREE.IcosahedronGeometry(1,1),stonePos=stone.attributes.position;
  for(let i=0;i<stonePos.count;i++){
    const x=stonePos.getX(i),y=stonePos.getY(i),z=stonePos.getZ(i);
    const n=.91+.15*Math.sin(x*5.7+z*4.2)*Math.cos(z*5.3-y*3.6);
    stonePos.setXYZ(i,x*n,y*n*(.90+.12*Math.sin(x*7.2)),z*n);
  }
  collect(stone,'stone');

  const surfaces=new Map();
  for(const [kind,colors] of [
    [1,['#8b6052','#855849','#775247','#775246','#a95043','#c96351']],
    [2,['#c8bdae','#ecd6b2','#dfbc95','#92aeb1','#9aa3b6','#c2a89a','#a7b9b8','#c4bba9','#8ba3af']],
    [3,['#877c65','#86918a','#81634e','#966e54','#b29572','#8f7653','#928371','#826647','#806950','#8f694d']],
    [4,['#ead0a1','#b9957b']],
    [5,['#8b9981']],[6,['#b3c9d2']],[7,['#c78360','#c38b68','#d29c73']]
  ])for(const hex of colors)surfaces.set(hex,kind);
  const batch = () => ({p: [], c: [],k:[],rounded:[]});
  function tri(b, a, d, e, tint, shade = 1) {
    const co = color(tint);
    const kind=surfaces.get(tint)||0;
    b.k.push(kind,kind,kind);
    b.p.push(...a, ...d, ...e);
    for (let i = 0; i < 3; i++) b.c.push(co.r * shade, co.g * shade, co.b * shade);
  }
  function shape(b, key, x,y,z, sx,sy,sz, tint, yaw=0, pitch=0, roll=0, variation=.032) {
    dummy.position.set(x,y,z);
    dummy.scale.set(sx,sy,sz);
    dummy.rotation.set(pitch,yaw,roll,'YXZ');
    dummy.updateMatrix();
    const m = dummy.matrix.elements, arr = prototypes[key], co = color(tint),kind=surfaces.get(tint)||0;
    if(key==='stone'&&(kind===5||kind===6))b.rounded.push([b.p.length/3,arr.length/3,x,y,z,sx,sy,sz]);
    let shade = 1;
    for(let i=0; i<arr.length; i+=3) {
      if(i%9===0) shade = 1 + variation * (2*hash(i+key.length)-1);
      const a=arr[i], d=arr[i+1], e=arr[i+2];
      b.k.push(kind);
      b.p.push(m[0]*a+m[4]*d+m[8]*e+m[12], m[1]*a+m[5]*d+m[9]*e+m[13], m[2]*a+m[6]*d+m[10]*e+m[14]);
      b.c.push(co.r*shade,co.g*shade,co.b*shade);
    }
  }
  function beam(b, a, e, width, depth, tint) {
    const dx=e[0]-a[0], dy=e[1]-a[1], dz=e[2]-a[2];
    const length=Math.hypot(dx,dy,dz);
    if (!length) return;
    shape(b,'box',(a[0]+e[0])*.5,(a[1]+e[1])*.5,(a[2]+e[2])*.5,
      width,length,depth,tint,Math.atan2(dx,dz),Math.acos(Math.max(-1,Math.min(1,dy/length))));
  }
  function meshFrom(b) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));
    geo.setAttribute('surfaceKind',new THREE.Float32BufferAttribute(b.k,1));
    geo.computeVertexNormals();
    for(const [start,count,x,y,z,sx,sy,sz] of b.rounded){
      const normal=geo.attributes.normal,pos=geo.attributes.position;
      for(let i=start;i<start+count;i++){
        const nx=(pos.getX(i)-x)/(sx*sx),ny=(pos.getY(i)-y)/(sy*sy),nz=(pos.getZ(i)-z)/(sz*sz);
        const len=Math.hypot(nx,ny,nz)||1;
        normal.setXYZ(i,nx/len,ny/len,nz/len);
      }
    }
    const mesh=new THREE.Mesh(geo,material);
    mesh.receiveShadow=true;
    return mesh;
  }
  function theme(s) {return s<0 ? 0 : Math.floor(s / leg) % 8;}
  function relativeHeight(s,o,t) {
    const a=Math.abs(o), inland=smooth(5.2,24,a), hills=smooth(12,74,a);
    const waves=Math.sin(s*.037+o*.052)+.55*Math.sin(s*.071-o*.093);
    if(t===2 && o<0) return -.09 - 1.7*smooth(6,24,a)-2*smooth(24,54,a);
    if(t===5) return -.09+inland*.16;
    const broad=2.9+2.2*Math.sin(s*.013+o*.035)+2.1*Math.sin(s*.022-o*.023);
    const mag=[1,.9,.77,1.55,.97,.0,1.38,.61][t];
    return -.095 + inland*(.42+waves*.53)*mag + hills*broad*mag;
  }
  function ground(s,o) {return roadHeight(s)+vergeHeight(s,o)}
  function vergeHeight(s,o) {
    const t=theme(s), phase=s<0?250:s%leg;
    const f=smooth(leg-35,leg+35,phase>leg/2?phase:phase+leg);
    if(phase<35 && s>35) return relativeHeight(s,o,(t+7)%8)*(1-f)+relativeHeight(s,o,t)*f;
    if(phase>leg-35) return relativeHeight(s,o,t)*(1-f)+relativeHeight(s,o,(t+1)%8)*f;
    return relativeHeight(s,o,t);
  }
  function groundWeights(t,o,s) {
    const verge=Math.max(0,Math.min(1,(Math.abs(o)-5.3)*1.35)), scatter=.5+.5*Math.sin(s*.13+o*.23);
    if(t===2 && o<0)return [0,0,1,0];
    if(t===3)return [0,.025, .975,0];
    if(t>=6)return [0,.03*(1-verge),0,1-.03*(1-verge)];
    const leaf=t===4?.50+.24*scatter:t===1?.27+.18*scatter:t===5?.39:.04+.10*scatter;
    const grit=(1-verge)*.39;
    return [(1-leaf)*(1-grit),leaf*(1-grit),grit,0];
  }
  function terrain(b,water,start,roadX) {
    const xs=[-245,-155,-98,-62,-41,-29,-21,-15,-10,-7,-5.2,0,5.2,7,10,15,21,29,41,62,98,155,245];
    function point(k,s) {
      const v=xs[k], a=Math.abs(v);
      const perturb=a<6?0:Math.min(3.8,(a-5)*.085)*Math.sin(s*.09+v);
      const off=v+perturb;
      return [roadX(s)+off,ground(s,off),start-s];
    }
    for(let row=0;row<8;row++) {
      const s=start+row*4,t=theme(s+2);
      for(let k=0;k<xs.length-1;k++) {
        const a=point(k,s),d=point(k+1,s),e=point(k+1,s+4),f=point(k,s+4);
        const tint=t>=6?'#fcfefe':t===3?'#f5e8d1':t===4?'#e1d2af':'#e1e4cc';
        tri(b,a,d,e,tint);tri(b,a,e,f,tint);
      }
      if(t===2) {
        const x1=roadX(s),x2=roadX(s+4),z=start-s;
        const a=[x1-15,-1.16,z],d=[x1-245,-1.16,z],e=[x2-245,-1.16,z-4],f=[x2-15,-1.16,z-4];
        tri(water,a,f,d,'#fff');tri(water,d,f,e,'#fff');
      }
    }
    const uv=[],weights=[],wuv=[];
    for(let i=0;i<b.p.length;i+=3) {
      const x=b.p[i],s=start-b.p[i+2],o=x-roadX(s);
      const t=theme(s),phase=s%leg,bl=smooth(-16,16,phase>leg*.5?phase-leg:phase);
      let w=groundWeights(t,o,s);
      if(s>leg-16 && (phase>leg-16 || phase<16)){
        const before=phase>leg*.5?t:(t+7)%8,after=(before+1)%8;
        const a=groundWeights(before,o,s),d=groundWeights(after,o,s);
        w=a.map((v,k)=>v*(1-bl)+d[k]*bl);
      }
      uv.push(x*.31,s*.31);weights.push(...w);
    }
    for(let i=0;i<water.p.length;i+=3){
      const s=start-water.p[i+2];wuv.push(roadX(s)-water.p[i]-15,s);
    }
    b.terrainUV=uv;b.weights=weights;water.waterCoord=wuv;
  }
  function deciduous(b,x,y,z,h,kind,rnd) {
    const choice=kind==='pink'?['blossom','blossom','sapling']:kind==='gold'?['gold','goldOak','orange','gold']:['oak','maple','birch','ash','sapling'];
    nature.plant(b.cards,choice[Math.floor(rnd()*choice.length)],x,y,z,h,rnd,.91+rnd()*.18);
  }
  function pine(b,x,y,z,h,snow,rnd) {
    const choice=snow?['snowFir','snowPine']:['fir','pine'];
    nature.plant(b.cards,choice[Math.floor(rnd()*choice.length)],x,y,z,h,rnd,.93+rnd()*.17);
  }
  function rock(b,x,y,z,k,snow,rnd) {
    shape(b,'stone',x,y+k*.22,z,k*(.77+rnd()*.5),k*.57,k*.79,snow?'#b3c9d2':'#8b9981',rnd()*tau, .1,rnd()*.32,.09);
  }
  function flowers(b,x,y,z,rnd) {
    nature.plant(b.cards,'daisies',x,y,z,.25+rnd()*.24,rnd,1+rnd()*.40);
  }
  function grass(b,x,y,z,rnd,tint) {
    const dry=tint==='#bdad6e'||tint==='#a39852';
    nature.plant(b.cards,dry?'straw':'grass',x,y,z,.14+rnd()*.26,rnd,.84+rnd()*.38);
  }
  function cottage(b,x,y,z,size,rnd) {
    const w=3.4*size,h=1.73*size,d=2.75*size;
    shape(b,'box',x,y+h*.51,z,w,h,d,'#c8bdae');
    const left=x-w*.58,right=x+w*.58,front=z+d*.59,back=z-d*.59,mid=y+h+size*.92,eave=y+h-.03*size;
    tri(b,[left,eave,front],[x,mid,front],[left,eave,back],'#8b6052');
    tri(b,[left,eave,back],[x,mid,front],[x,mid,back],'#855849');
    tri(b,[x,mid,front],[right,eave,front],[right,eave,back],'#775247');
    tri(b,[x,mid,front],[right,eave,back],[x,mid,back],'#775246');
    tri(b,[x-w*.5,eave,z+d*.5],[x+w*.5,eave,z+d*.5],[x,mid-.10*size,z+d*.5],'#ecd6b2');
    tri(b,[x-w*.5,eave,z-d*.5],[x,mid-.10*size,z-d*.5],[x+w*.5,eave,z-d*.5],'#dfbc95');
    shape(b,'box',x+w*.25,y+h+.39*size,z-d*.25,.25*size,.96*size,.31*size,'#b9957b');
    shape(b,'box',x,y+.46*size,z+d*.502,.38*size,.93*size,.05*size,'#81634e');
    shape(b,'box',x,y+h*.95,z+d*.512,w,.09*size,.09*size,'#966e54');
    shape(b,'box',x,y+h*.20,z-.01,w*1.01,.10*size,d*1.014,'#b29572');
    for(let i=0;i<7;i++){
      const off=(i/6-.5)*w*.94;
      shape(b,'box',x+off,y+h*.50,z+d*.505,.035*size,h*.94,.05*size,'#928371');
    }
    for(let j=-1;j<=1;j+=2) {
      shape(b,'box',x+j*w*.30,y+.89*size,z+d*.505,.41*size,.43*size,.055*size,'#49767a');
      for(let sh of [-1,1])shape(b,'box',x+j*w*.30+sh*.265*size,y+.89*size,z+d*.512,.10*size,.44*size,.059*size,'#8f7653');
      shape(b,'box',x+j*w*.30,y+.65*size,z+d*.525,.54*size,.06*size,.10*size,'#b99265');
      shape(b,'box',x+w*.504,y+.9*size,z+j*d*.25,.049*size,.40*size,.40*size,'#567d83');
      shape(b,'box',x+w*.515,y+.9*size,z+j*d*.25,.05*size,.39*size,.035*size,'#cfccaf');
      shape(b,'box',x+w*.515,y+.9*size,z+j*d*.25,.05*size,.027*size,.39*size,'#cfccaf');
      shape(b,'box',x+j*w*.30,y+.89*size,z+d*.53,.026*size,.42*size,.04*size,'#cfccaf');
    }
  }
  function farmPole(b,start,roadX) {
    const foot=s=>[roadX(s)-10.5,ground(s,-10.5),start-s],a=foot(start+6),d=foot(start+38);
    shape(b,'taper',a[0],a[1]+3.65,a[2],.12,7.30,.12,'#81634e');
    shape(b,'box',a[0],a[1]+6.98,a[2],1.95,.13,.13,'#806950');
    beam(b,[a[0],a[1]+6.32,a[2]],[a[0]-.70,a[1]+6.94,a[2]],.054,.054,'#777972');
    beam(b,[a[0],a[1]+6.32,a[2]],[a[0]+.70,a[1]+6.94,a[2]],.054,.054,'#777972');
    for(const dx of [-.82,0,.82]){
      shape(b,'pole',a[0]+dx,a[1]+7.15,a[2],.072,.21,.072,'#818f8e');
      let prev=[a[0]+dx,a[1]+7.26,a[2]];
      for(let i=1;i<=6;i++){
        const t=i/6,pt=[a[0]+(d[0]-a[0])*t+dx,a[1]+(d[1]-a[1])*t+7.26-.63*Math.sin(t*Math.PI),a[2]+(d[2]-a[2])*t];
        beam(b,prev,pt,.022,.022,'#494d48');prev=pt;
      }
    }
  }
  function barn(b,x,y,z,k){
    const w=5.8*k,h=2.85*k,d=3.7*k;
    shape(b,'box',x,y+h*.50,z,w,h,d,'#877c65');
    const put=(xx,yy,zz)=>[x+xx*k,y+yy*k,z+zz*k];
    for(const side of [-1,1]){
      const a=put(-3.17,2.85,side*2.15),c=put(3.17,2.85,side*2.15),e=put(3.17,4.26,0),f=put(-3.17,4.26,0);
      tri(b,a,c,e,'#8b6052');tri(b,a,e,f,'#8b6052');
      const face=x+side*w*.5;
      tri(b,[face,y+h,z-d*.5],[face,y+h,z+d*.5],[face,y+4.15*k,z],'#877c65');
      for(let j=-1;j<=1;j+=2)shape(b,'box',face+side*.03*k,y+1.12*k,z+j*.56*k,.12*k,2.23*k,1.04*k,'#81634e');
      for(let j=-1;j<=1;j+=2)beam(b,[face+side*.11*k,y+.10*k,z+j*1.09*k],[face+side*.11*k,y+2.16*k,z],.10*k,.09*k,'#a29a83');
      shape(b,'box',face+side*.03*k,y+3.16*k,z,.13*k,.46*k,.59*k,'#354345');
      for(let j=-1;j<=1;j+=2)shape(b,'box',x+j*w*.29,y+1.41*k,z+side*d*.5,.89*k,.71*k,.1*k,'#3c4d51');
    }
    shape(b,'box',x,y-.13*k,z,w*1.02,.64*k,d*1.02,'#b9957b');
  }
  function lighthouse(b,x,y,z,k) {
    for(let j=0;j<4;j++)shape(b,'taper',x,y+(j+.5)*1.3*k,z,(1.07-j*.09)*k,1.3*k,(1.07-j*.09)*k,j%2?'#cc594c':'#f2e9ce',.2);
    shape(b,'pole',x,y+5.25*k,z,1.03*k,.22*k,1.03*k,'#555e61');
    shape(b,'pole',x,y+5.83*k,z,.70*k,1.04*k,.70*k,'#d8e4c7');
    for(let j=0;j<6;j++){const a=j*tau/6;shape(b,'pole',x+Math.cos(a)*.69*k,y+5.82*k,z+Math.sin(a)*.69*k,.043*k,1.0*k,.043*k,'#526568');}
    shape(b,'pine',x,y+6.61*k,z,.96*k,.78*k,.96*k,'#c96351');
  }
  function cactus(b,x,y,z,h,rnd) {
    nature.plant(b.cards,'pricklyPear',x,y,z,h,rnd,.92+rnd()*.30);
    if(rnd()<.43)nature.plant(b.cards,'pricklyPear',x+.70*h,y,z+h*.14,h*(.38+rnd()*.30),rnd);
  }
  function palm(b,x,y,z,h,rnd) {
    nature.plant(b.cards,'palm',x,y,z,h,rnd,.92+rnd()*.18);
  }
  function building(b,facades,side,x,y,z,w,h,d,rnd,style) {
    const seed=rnd()*5;
    urban.wallsOf(facades,x,y,z,w,h,d,style,seed);
    const top=y+h,depth=d*.5,front=x-side*w*.5;
    shape(b,'box',x,top+.10,z,w*1.006,.23,d*1.009,'#9a9f9e');
    shape(b,'box',x,top+.25,z,w*.97,.12,d*.975,'#6f7573');
    const hatH=1.1+rnd()*1.8;
    if(h>19){
      urban.wallsOf(facades,x+w*.06,top+.20,z-d*.07,w*.72,hatH+1.8,d*.65,(style+1)%3,seed);
      shape(b,'box',x+w*.06,top+hatH+2.02,z-d*.07,w*.74,.18,d*.67,'#a6adaa');
    }else shape(b,'box',x+w*.12,top+.60,z+d*.09,w*.38,.85,d*.33,'#808987');
    if(style===0 && h>10){
      for(let floor=5.9;floor<h-.8;floor+=6.04){
        shape(b,'box',front-side*.39,y+floor,z,.90,.12,d*.37,'#a2a39b');
        for(const zz of [-1,1])shape(b,'box',front-side*.49,y+floor+.43,z+zz*d*.19,.66,.78,.042,'#87928f');
        shape(b,'box',front-side*.80,y+floor+.84,z,.06,.055,d*.385,'#667377');
      }
    }
    const canopy=style===0?'#66786d':style===1?'#44585c':'#71655c';
    shape(b,'box',front-side*.84,y+3.04,z,.04+1.64,.16,d*.54,canopy);
    shape(b,'box',front-side*1.56,y+2.89,z,.10,.24,d*.54,canopy);
    shape(b,'box',front-side*.05,y+1.28,z,.11,2.49,1.38,'#344349');
    shape(b,'box',front-side*.13,y+1.23,z,.11,2.22,1.16,'#5a6c70');
    shape(b,'box',front-side*.22,y+1.26,z,.07,2.38,.046,'#adb3aa');
    shape(b,'box',front-side*.23,y+.13,z,.46,.24,1.8,'#a4a39b');
  }
  function cityBlock(b,lamps,facades,paving,pools,side,start,roadX,at,rnd) {
    for(let i=0;i<8;i++){
      const s=start+i*4,tt=theme(s+2);
      if(tt!==5)continue;
      const base=roadHeight(s),next=roadHeight(s+4),x=roadX(s),xx=roadX(s+4),z=start-s;
      const inner=5.012*side,outer=17*side;
      const a=[x+inner,base+.18,z],c=[x+outer,base+.18,z],d=[xx+outer,next+.18,z-4],e=[xx+inner,next+.18,z-4];
      urban.quad(paving,a,c,d,e,6,2);
      tri(b,[a[0],base+.032,z],a,e,'#969a96');tri(b,[a[0],base+.032,z],e,[e[0],next+.032,z-4],'#969a96');
      if(i%2===0){const qx=x+side*5.32;shape(b,'box',qx,base+.186,z-.35,.30,.025,.53,'#555c5b');}
    }
    const h0=roadHeight(start+16);
    for(let j=0;j<2;j++){
      const s=start+7.8+j*16.0,w=8+rnd()*3.8,d=12.4+rnd()*2.8,off=side*(10+rnd()*2+w*.5);
      const h=8.4+Math.floor(rnd()*7)*3.02;
      building(b,facades,side,roadX(s)+off,roadHeight(s)+.18,start-s,w,h,d,rnd,Math.floor(rnd()*3));
    }
    for(let j=0;j<2;j++){
      const s=start+5+j*16,h=20+Math.floor(rnd()*11)*3.1,w=8.5+rnd()*5.4,d=9+rnd()*4;
      building(b,facades,side,roadX(s)+side*(32+rnd()*18),h0,start-s,w,h,d,rnd,rnd()>.44?2:1);
    }
    const s=start+(side>0?5:21),x=roadX(s)+side*6.42,y=roadHeight(s)+.18,z=start-s;
    shape(b,'taper',x,y+3.45,z,.094,6.92,.094,'#718080');
    beam(b,[x,y+6.88,z],[x-side*1.1,y+7.13,z],.115,.115,'#788888');
    beam(b,[x-side*1.1,y+7.13,z],[x-side*2.32,y+7.08,z],.095,.095,'#788888');
    shape(b,'box',x-side*2.42,y+7.04,z,.72,.12,.34,'#697879');
    shape(lamps,'box',x-side*2.42,y+6.964,z,.61,.030,.27,'#f9e6c1');
    urban.lightPool(pools,x-side*2.4,roadHeight(s)+.065,z,4.6,7.0);
    const furniture=at(s+4.5,side*7.62);
    if((Math.floor(start/span)+Number(side>0))%3!==1){
      const ts=start+(side>0?19:7),tx=roadX(ts)+side*8.0,ty=roadHeight(ts)+.18,tz=start-ts;
      shape(b,'box',tx,ty+.012,tz,1.48,.036,1.70,'#797970');
      shape(b,'box',tx,ty+.038,tz,1.31,.032,1.52,'#514d43');
      nature.plant(b.cards,rnd()<.55?'sapling':'birch',tx,ty+.055,tz,4.2+rnd()*1.9,rnd,.83);
    }
    if((Math.floor(start/span)+Number(side>0))%3===0){
      const [bx,,bz]=furniture;
      for(const dz of [-.58,.58])shape(b,'box',bx,y+.24,bz+dz,.55,.43,.10,'#6e7470');
      for(let i=0;i<3;i++)shape(b,'box',bx+side*(i-1)*.14,y+.50,bz,.13,.09,1.6,'#877c65');
      for(const dz of [-.63,.63])shape(b,'box',bx+side*.29,y+.65,bz+dz,.06,.60,.06,'#626d68');
      shape(b,'box',bx+side*.29,y+.88,bz,.09,.21,1.6,'#877c65');
      shape(b,'pole',bx+side*.2,y+.42,bz+1.5,.24,.84,.24,'#52615b');
    }else{
      for(const dz of [-.66,.66]){
        shape(b,'pole',furniture[0],y+.48,furniture[2]+dz,.045,.91,.045,'#839294');
      }
      shape(b,'box',furniture[0],y+.93,furniture[2],.074,.085,1.35,'#839294');
    }
  }
  function fence(b,start,roadX,side,snow) {
    const tint=snow?'#86918a':'#877c65';
    const last=[];
    for(let i=0;i<=8;i++) {
      const s=start+i*4, off=side*(7.4+.14*Math.sin(s*.045));
      const x=roadX(s)+off,y=ground(s,off),z=start-s;
      if(i<8) {
        shape(b,'taper',x,y+.55,z,.096,1.16,.096,tint,.32);
        shape(b,'spire',x,y+1.17,z,.092,.14,.092,snow?'#f1f2eb':tint,.72);
      }
      if(i)for(const h of [.46,.87])beam(b,[last[0],last[1]+h,last[2]],[x,y+h,z],.075,.092,tint);
      last[0]=x;last[1]=y;last[2]=z;
    }
  }
  function marker(b,x,y,z,t) {
    shape(b,'box',x,y+.43,z,.16,.82,.19,t>=6?'#c3ccce':'#d3d3c8');
    shape(b,'box',x,y+.64,z+.003,.169,.16,.2,'#596867');
    shape(b,'box',x,y+.65,z+.11,.075,.070,.013,'#eccc96');
  }
  function sailboat(b,x,y,z,k) {
    shape(b,'stone',x,y+.1*k,z,1.12*k,.30*k,2.40*k,'#b36c52');
    beam(b,[x,y+.12*k,z],[x,y+4.0*k,z],.08*k,.09*k,'#9d8266');
    tri(b,[x-.04*k,y+3.83*k,z],[x-.46*k,y+.70*k,z+1.62*k],[x-.04*k,y+.65*k,z],'#fff0c9');
    tri(b,[x+.04*k,y+3.19*k,z],[x+.04*k,y+.65*k,z],[x+.32*k,y+.74*k,z-1.33*k],'#dc906c');
  }
  function iceShard(b,x,y,z,h,rnd) {
    shape(b,'stone',x,y+h*.10,z,h*.56,h*.34,h*.94,'#b3c9d2',rnd()*tau,0,.10,.05);
    shape(b,'stone',x+h*.50,y+h*.060,z+h*.20,h*.24,h*.13,h*.36,'#b3c9d2',rnd()*tau);
  }
  function createSection(id,roadX) {
    const start=id*span, rnd=random(id+869), g=new THREE.Group(), flora=batch(), earth=batch(), lamps=batch();
    g.userData.rotors=[];
    const water=batch(),facades=urban.batch(),paving=urban.batch(),pools=urban.batch();flora.cards=nature.newBatch();
    terrain(earth,water,start,roadX);
    function at(s,offset) {return [roadX(s)+offset,ground(s,offset),start-s];}
    const t=theme(start+span*.5);
    for(const side of [-1,1]) {
      if(t===5){
        cityBlock(flora,lamps,facades,paving,pools,side,start,roadX,at,rnd);
        continue;
      }
      // A clear verge frames even a low, side-on camera. Short grasses and
      // groups of flowers replace tall foreground trees close to the shoulder.
      for(let i=0;i<98;i++) {
        const s=start+rnd()*span, off=side*(5.70+Math.pow(rnd(),1.5)*9.8), tt=theme(s), p=at(s,off);
        if(tt===0||tt===1){if(i%11===0)flowers(flora,...p,rnd,true);else grass(flora,...p,rnd,'#779e56');}
        else if(tt===4){if(i%16===0)flowers(flora,...p,rnd,false);else grass(flora,...p,rnd,'#a39852');}
        else if(tt===2||tt===3)grass(flora,...p,rnd,'#bdad6e');
        else if(tt>=6&&i%23===0)rock(flora,...p,.24+rnd()*.30,true,rnd);
      }
      if((t===0||t===4||t===6) && ((id%5+5)%5 < 3) && side === -1)fence(flora,start,roadX,side,t>=6);
      else if(t!==5)for(let i=0;i<2;i++)marker(flora,...at(start+4+i*16,side*6.15),t);
      if(t===0||t===1||t===4) {
        for(let i=0;i<5;i++){
          const s=start+2+i*6.4+2*rnd(),o=side*(8.9+rnd()*7),p=at(s,o),k=.48+.60*rnd();
          for(let j=0;j<3;j++) {
            const type=j===1?'shrub':'fern',height=k*(.60+rnd()*.69);
            nature.plant(flora.cards,type,p[0]+(j-1)*k*.61,p[1],p[2]+(rnd()-.5)*.55,height,rnd,1.10+rnd()*.46);
          }
        }
      }
      const count=[24,51,8,9,32,5,38,7][t];
      for(let n=0;n<count;n++) {
        const s=start+(n+rnd())/count*span, tt=theme(s);
        const off=side*(n%4===0?11.5+rnd()*14:26+rnd()*61), p=at(s,off);
        // Leave the view from the first bend to the mill and farms open.
        if(t===0 && side===-1 && s>-14 && s<33 && Math.abs(off)<46)continue;
        const h=(tt===1?6.1:4.5)+rnd()*(tt===1?8.6:6.2);
        if(tt===0 || tt===1 || tt===4) {
          if(rnd()<(tt===0?.39:tt===1?.43:.20))pine(flora,...p,h*1.14,false,rnd);
          else {
            const kind=tt===4?'gold':tt===0&&rnd()<.10?'pink':'green';
            deciduous(flora,...p,h,kind,rnd);
          }
        } else if(tt===2){
          if(side>0 || Math.abs(off)<16)palm(flora,...p,h,rnd);
          else if(n%7===0)rock(flora,...p,2.2+rnd()*1.6,false,rnd);
        } else if(tt===3){if(n%3===0)cactus(flora,...p,h*.28,rnd);else rock(flora,...p,.59+rnd()*1.0,false,rnd);}
        else if(tt===5){if(Math.abs(off)<18)deciduous(flora,...p,h*.72,'gold',rnd);}
        else if(tt===6){if(n%9!==0)pine(flora,...p,h*1.15,true,rnd);else rock(flora,...p,.5+Math.pow(rnd(),2)*1.6,true,rnd);}
        else if(n%3===0)iceShard(flora,...p,h*.79,rnd);else if(n%3===1)rock(flora,...p,.47+rnd()*1.37,true,rnd);
      }
    }
    const idx=((id%13)+13)%13;
    if(t===0){
      farmPole(flora,start,roadX);
      if(idx===0 || idx===7) {
        barn(flora,...at(start+8,-38),1.40);
        cottage(flora,...at(start+23,-48),1.15,rnd);
      }
      if(idx===0) {
        deciduous(flora,...at(start+23,-13),5.7,'pink',rnd);
        deciduous(flora,...at(start+21,13),6.55,'green',rnd);
        for(let j=0;j<10;j++)flowers(flora,...at(start+1+j*1.1,-6.7-rnd()),rnd,true);
      }
    }else if(t===1 && idx%6===0)cottage(flora,...at(start+20,-18),1.7,rnd);
    else if(t===2 && idx%4===0) {
      lighthouse(flora,...at(start+19,-14),1.43);
      cottage(flora,...at(start+25,-15),1.15,rnd);
      sailboat(flora,roadX(start+23)-44,-1.16,-23,1.1+rnd());
    }else if(t===3 && idx%4===1){
      const p=at(start+16,-52);
      for(let j=0;j<5;j++) {
        const k=2.4+rnd()*3.2;
        shape(flora,'stone',p[0]+j*3.2,p[1]+k*.22,p[2]+rnd()*6,k*1.31,k*.58,k,'#c38b68',rnd()*tau,.24);
      }
    }else if(t===4 && idx%5===0)cottage(flora,...at(start+12,-15),1.52,rnd);
    else if(t===6 && idx%4===1)cottage(flora,...at(start+18,18),1.48,rnd);
    else if(t===7 && idx%3===1) {
      const p=at(start+13,-21);
      shape(flora,'crown',p[0],p[1],p[2],3.7,2.8,3.3,'#d4e5e9',.35);
      shape(flora,'box',p[0]+.35,p[1]+.59,p[2]+2.78,1.52,1.22,1.99,'#c6dfe5');
      shape(flora,'box',p[0]+.34,p[1]+.48,p[2]+3.80,1.03,.97,.05,'#647f91');
    }
    const groundMesh=meshFrom(earth);
    groundMesh.geometry.setAttribute('terrainUV',new THREE.Float32BufferAttribute(earth.terrainUV,2));
    groundMesh.geometry.setAttribute('surfaceWeight',new THREE.Float32BufferAttribute(earth.weights,4));
    groundMesh.material=nature.groundMaterial;g.add(groundMesh);
    if(water.p.length){
      const ocean=meshFrom(water);ocean.material=nature.oceanMaterial;
      ocean.geometry.setAttribute('waterCoord',new THREE.Float32BufferAttribute(water.waterCoord,2));g.add(ocean);
    }
    if(flora.cards.position.length)g.add(nature.createCards(flora.cards));
    if(facades.p.length)g.add(urban.make(facades,'facade'));
    if(paving.p.length)g.add(urban.make(paving,'paving'));
    if(pools.p.length){const pool=urban.make(pools,'pool');g.userData.pool=pool;g.add(pool);}
    const objects=meshFrom(flora);objects.castShadow=true;g.add(objects);
    if(lamps.p.length){const glow=meshFrom(lamps);glow.material=windowMaterial;glow.receiveShadow=false;g.userData.windows=glow;g.add(glow);}
    world.add(g);sectionMap.set(id,g);
    return g;
  }

  const skylineAnchor=new THREE.Object3D();
  skylineAnchor.name='Photographic panorama origin';skylineAnchor.renderOrder=-5;world.add(skylineAnchor);
  let previousCenter=null;
  function update({distance,time,roadX,night=0,weather='sun'}) {
    const center=Math.floor(distance/span);
    if(center!==previousCenter) {
      previousCenter=center;
      for(const [id,g] of sectionMap)if(id<center-2||id>center+7){
        world.remove(g);g.traverse(c=>{if(c.isMesh)c.geometry.dispose();});sectionMap.delete(id);
      }
      for(let id=center-2;id<=center+7;id++)if(!sectionMap.has(id))createSection(id,roadX);
    }
    nature.update(time,night,weather);urban.update(night);
    windowMaterial.opacity=Math.min(1,night*1.26);
    for(const [id,g] of sectionMap) {
      g.position.set(0,-roadHeight(distance),distance-id*span);
      for(const rotor of g.userData.rotors)rotor.rotation.z=time*.59+id*.16;
      if(g.userData.pool)g.userData.pool.visible=night>.015;
      if(g.userData.windows)g.userData.windows.visible=night>.025;
    }
    skylineAnchor.position.x=roadX(distance);
  }
  return {update};
}
