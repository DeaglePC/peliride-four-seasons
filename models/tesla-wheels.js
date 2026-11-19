import {box,panel,surface} from './tesla-tools.js';

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
      if(mat.normalMap||mat.roughnessMap){
        const uv=geo.getAttribute('uv');
        if(uv)data.uv.push(uv.getX(i),uv.getY(i));
        else data.uv.push((p.z+p.x*.34)*.67,p.y*1.4);
      }
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

// Sizes are the nominal bead-seat diameters. The metal lip extends past the bead.
const designs={
  modelS:{inches:21,disc:.187,sets:7,style:'velarium'},model3:{inches:19,disc:.160,sets:5,style:'nova'},
  modelX:{inches:20,disc:.185,sets:5,style:'perihelix'},modelY:{inches:20,disc:.178,sets:5,style:'helix'},
  cybertruck:{inches:20,disc:.204,sets:7,style:'cyber'},roadster:{inches:21,disc:.200,sets:6,style:'roadster'}
};

// A spoke is a solid forging. Cross-sections run from the mounting pad to the
// outer lip. Each section describes radius, sweep, half-width and axial depth.
function formedSpoke(ctx,rim,w,phase,pitch,sections,face,edges,aspect=.40){
  const xyz=(rad,angle,depth)=>[depth,rad*Math.cos(angle),rad*Math.sin(angle)];
  const top=[],side=[],topFaces=[],sideFaces=[];
  for(const [i,[radius,center,half,depth]] of sections.entries()){
    const a=phase+center*pitch,delta=half*pitch,ax=w*depth,rad=radius*rim;
    const left=xyz(rad,a-delta,ax-.004),right=xyz(rad,a+delta,ax-.006);
    const crown=xyz(rad,a+delta*aspect,ax+.003);
    top.push(left,crown,right);
    side.push(xyz(rad,a-delta,ax-.022),left,right,xyz(rad,a+delta,ax-.025));
    if(i){
      const j=i*3,k=i*4;
      topFaces.push(j-3,j,j-2,j-2,j,j+1,j-2,j+1,j-1,j-1,j+1,j+2);
      sideFaces.push(k-4,k,k-3,k-3,k,k+1,k-2,k+2,k-1,k-1,k+2,k+3);
    }
  }
  surface(ctx,face,top,topFaces);surface(ctx,edges,side,sideFaces);
}

export function wheelAssembly(T,m,spec,model,detailed){
  const group=new T.Group(),ctx={T,group,m,detailed},design=designs[model],style=design.style;
  const r=spec.wheelRadius,w=Math.min((spec.width-spec.track)*.49,.157);
  const rim=design.inches*.0127+.009,pickup=style==='cyber',segments=detailed?64:22;
  function revolve(material,section,sides=segments){
    const lathe=new T.LatheGeometry(section.map(([x,rad])=>new T.Vector2(rad,x)),sides);
    lathe.rotateZ(-Math.PI/2);group.add(new T.Mesh(lathe,material));
  }
  const tire=detailed?(pickup?m.allTerrain:m.touring):m.rubber;
  // Even section indices across the tread keep the normal map aligned with both shoulders.
  const casing=[[-.88,rim*.97],[-.96,rim+.014],[-1,r*.85],[-1.00,r*.91],[-.90,r*.974],
    [-.73,r*.992],[-.48,r*.998],[-.25,r],[0,r],[.25,r],[.48,r*.998],[.73,r*.992],
    [.90,r*.974],[1.00,r*.91],[1,r*.85],[.96,rim+.014],[.88,rim*.97]];
  revolve(tire,(detailed?casing:casing.filter((_,i)=>!(i%2))).map(([x,rad])=>[x*w,rad]));
  if(pickup&&detailed){
    const vertices=[],faces=[];
    for(let k=0;k<47;k++)for(const side of [-1,1]){
      const a=(k+(k%2)*.12+(side<0?.46:0))*2*Math.PI/47,base=vertices.length;
      const tread=(x,rad,angle)=>[side*x*w,(rad*r+.0022)*Math.cos(a+angle),(rad*r+.0022)*Math.sin(a+angle)];
      vertices.push(tread(.68,.996,-.032),tread(.74,.994,.039),tread(.92,.969,.051),tread(.99,.923,.035),tread(.99,.922,-.015),tread(.91,.972,-.025));
      faces.push(base,base+1,base+2,base,base+2,base+5,base+5,base+2,base+3,base+5,base+3,base+4);
    }
    surface(ctx,m.rubber,vertices,faces);
  }
  // Open inner barrel: there is a real sightline from the spoke windows to the rotor.
  revolve(m.wheelInset,[[-w*.75,rim*.85],[-w*.68,rim*.94],[w*.64,rim*.925],[w*.86,rim*.916]]);
  const face=style==='nova'||style==='helix'?m.wheelAlloy:m.wheelGraphite;
  revolve(pickup?m.wheelInset:face,[[w*.68,rim*.915],[w*.89,rim*.918],[w*.99,rim*.962],
    [w*.94,rim],[w*.83,rim*1.005],[w*.80,rim*.988]]);
  const discX=w*.35,discRadius=design.disc;
  revolve(m.brakeDisc,[[discX-.021,discRadius*.45],[discX-.021,discRadius],[discX,discRadius],
    [discX,discRadius*.53],[discX+.016,discRadius*.43],[discX+.016,rim*.10]]);
  if(detailed){
    const grooves=[[.59,.0008],[.97,.0010]];
    for(const [fraction,thickness] of grooves){
      const radius=discRadius*fraction;
      revolve(m.wheelGraphite,[[discX+.0008,radius+thickness],[discX+.0008,radius]]);
    }
  }
  const pitch=2*Math.PI/design.sets;
  for(let k=0;k<design.sets;k++){
    const a=k*pitch;
    const blade=(rows,mat=face,edge=m.wheelInset)=>formedSpoke(ctx,rim,w,a,pitch,rows,mat,edge);
    if(style==='nova'||style==='perihelix'||style==='helix'){
      // Nova's knee bends around each bolt. Perihelix has paired cast rails around
      // a dark outer insert. The Y wheel widens into a nearly continuous outer ring.
      for(const sign of [-1,1]){
        const y=style==='helix',x=style==='perihelix';
        const sweep=(r,b,h,d)=>[r,sign*b+(y?.045*r:0),h,d];
        blade([sweep(.231,.10,.073,.67),sweep(.35,.128,.058,.74),
          sweep(x?.63:.53,x?.13:.184,x?.061:.044,.88),
          sweep(.81,x?.178:.208,x?.084:y?.088:.071,.94),
          sweep(.981,x?.18:.218,x?.079:y?.12:.092,.94)]);
      }
      if(style==='perihelix'){
        blade([[.28,0,.078,.69],[.38,.035,.066,.77],[.64,.114,.039,.91],[.94,.149,.034,.945]],m.wheelInset);
        blade([[.81,.493,.100,.877],[.87,.492,.145,.90],[.97,.486,.155,.91]],m.wheelInset);
      }
    }else if(style==='velarium'){
      blade([[.20,-.08,.165,.68],[.38,-.036,.10,.76],[.62,.027,.084,.90],[.87,.115,.082,.955],[.98,.165,.078,.94]]);
      blade([[.48,-.005,.072,.835],[.63,-.068,.058,.875],[.83,-.173,.059,.923],[.969,-.264,.062,.936]]);
      blade([[.64,-.20,.026,.859],[.78,-.182,.113,.880],[.948,-.196,.177,.906]],m.wheelInset);
    }else if(pickup){
      // Seven flat, polygonal paddles extend beyond the metal rim onto the sidewall.
      blade([[.24,0,.34,1.008],[.43,0,.305,1.018],[.85,0,.216,1.039],[1.18,0,.167,1.007],
        [1.32,0,.137,.987]],m.wheelInset,m.black);
      blade([[.38,.498,.146,.927],[.61,.5,.216,.937],[.981,.501,.287,.956]],m.wheelGraphite);
    }else{
      blade([[.19,-.035,.17,.73],[.37,-.010,.12,.77],[.61,.032,.083,.88],[.83,.06,.074,.95],[.98,.085,.068,.96]]);
      blade([[.39,-.11,.025,.736],[.57,-.125,.069,.78],[.80,-.129,.114,.86],[.95,-.161,.146,.90]],m.wheelAlloy);
    }
  }
  const cap=(style==='velarium'?.30:pickup?.34:.157)*rim;
  if(pickup){
    revolve(m.wheelInset,[[w*.75,rim*.39],[w*.98,rim*.385],[w*1.06,rim*.30],[w*1.06,.001]],7);
    revolve(m.wheelGraphite,[[w*1.065,rim*.27],[w*1.089,rim*.23],[w*1.089,.001]],7);
  }else{
    revolve(face,[[w*.50,.001],[w*.50,rim*.266],[w*.66,rim*.266],[w*.756,rim*.242],
      [w*.756,cap*1.07],[w*.782,cap*1.035],[w*.864,cap],[w*.868,cap*.92],[w*.868,.001]]);
  }
  if(detailed){
    if(!pickup){
      const boltCircle=.057;
      for(let k=0;k<5;k++){
        const angle=k*Math.PI*2/5+Math.PI/5,y=boltCircle*Math.cos(angle),z=boltCircle*Math.sin(angle);
        if(boltCircle+.009<cap)continue;
        const socket=new T.Mesh(new T.CylinderGeometry(.014,.014,.008,10),m.wheelInset);
        socket.rotation.z=-Math.PI/2;socket.position.set(w*.755,y,z);group.add(socket);
        const lug=new T.Mesh(new T.CylinderGeometry(.009,.010,.010,6),m.wheelGraphite);
        lug.rotation.z=-Math.PI/2;lug.position.set(w*.792,y,z);group.add(lug);
      }
      const capX=w*.869,logo=cap*.46;
      const stamp=(points)=>panel(ctx,m.wheelInset,points.map(([z,y])=>[capX+.0006,y*logo,z*logo]));
      stamp([[-.83,.48],[-.42,.66],[0,.70],[.42,.66],[.83,.48],[.71,.38],[0,.53],[-.71,.38]]);
      stamp([[-.60,.33],[0,.43],[.6,.33],[.44,.14],[.16,.19],[0,-.72],[-.16,.19],[-.44,.14]]);
      const valve=new T.Mesh(new T.CylinderGeometry(.005,.006,.031,8),m.wheelInset);
      valve.rotation.z=-Math.PI*.42;valve.position.set(w*.82,-rim*.64,rim*.61);group.add(valve);
    }
  }
  return mergeParts(T,group);
}

// Attached to the knuckle: the disc and wheel rotate, the brake caliper stays put.
export function fixedBrake(ctx,spec,model,side,axle){
  const {T,m}=ctx,rad=designs[model].disc,w=Math.min((spec.width-spec.track)*.49,.157);
  const axleZ=(spec.axleMid??0)+axle*spec.wheelbase/2;
  const tub=new T.Mesh(new T.CircleGeometry(spec.wheelRadius*.99,40),m.black);
  tub.rotation.y=side*Math.PI/2;
  tub.position.set(side*(spec.track/2-w*1.10),spec.wheelRadius,axleZ);ctx.group.add(tub);
  const x=side*(spec.track/2+w*.35),z=(spec.axleMid??0)+axle*spec.wheelbase/2-axle*rad*.87;
  const y=spec.wheelRadius+rad*.14;
  const shell=box(ctx,m.caliper,[x,y,z],[.067,rad*.88,rad*.37],.022);
  shell.rotation.x=-axle*.23;
  for(const h of [-.20,.20]){
    const boss=box(ctx,m.caliper,[x+side*.031,y+rad*h,z-axle*rad*h*.22],[.018,rad*.30,rad*.27],.012);
    boss.rotation.x=-axle*.23;
  }
  box(ctx,m.wheelGraphite,[x+side*.039,y,z+axle*.006],[.009,rad*.48,.011],.004);
}
