// Atlantic mackerel proportions. Local X runs from the forked tail to the nose,
// with Y up. Mesh data, skin texture and materials are shared by the fish pool.
const shoals = new WeakMap();

const outlines = [
  [0, .009, .007, .001], [.055, .012, .009, .002], [.14, .029, .019, .003],
  [.27, .059, .037, .002], [.43, .084, .050, .003], [.6, .096, .058, .005],
  [.72, .092, .055, .008], [.8, .079, .048, .011], [.89, .056, .039, .009],
  [.965, .029, .022, .002], [1, .002, .002, -.008]
];
const pin = (value, low=0, high=1) => Math.max(low, Math.min(high, value));
const smooth = (a,b,t) => { const k=pin((t-a)/(b-a)); return k*k*(3-2*k); };
const mix = (a,b,t) => a+(b-a)*t;
const tailX=-.321, noseX=.419, spine=[.125,-.064,-.219,-.309];

function profile(u,column) {
  for(let i=1; i<outlines.length; i++){
    const a=outlines[i-1], b=outlines[i];
    if(u>b[0])continue;
    const before=outlines[Math.max(0,i-2)], after=outlines[Math.min(outlines.length-1,i+1)];
    const span=b[0]-a[0], t=pin((u-a[0])/span);
    const da=(b[column]-before[column])/(b[0]-before[0]), db=(after[column]-a[column])/(after[0]-a[0]);
    return mix(a[column],b[column],t*t*(3-2*t))+span*t*(1-t)*(da*(1-t)-db*t);
  }
  return outlines.at(-1)[column];
}
function shell(u,angle){
  return [mix(tailX,noseX,u),profile(u,3)+profile(u,1)*Math.cos(angle),profile(u,2)*Math.sin(angle)];
}
function cheek(x,y,side,offset=0){
  const u=pin((x-tailX)/(noseX-tailX));
  const height=profile(u,1),center=profile(u,3),radius=profile(u,2);
  return [x,y,side*(Math.sqrt(Math.max(0,1-((y-center)/height)**2))*radius+offset)];
}

function colourMap(T){
  const width=512, height=192, bytes=new Uint8Array(width*height*4);
  const stops=[[-1,[210,216,209]],[-.55,[224,230,221]],[-.20,[196,212,210]],
    [.09,[167,190,188]],[.27,[99,139,140]],[.53,[55,100,99]],[.87,[44,76,71]],[1,[38,64,61]]];
  const sample=(y)=>{
    for(let k=1;k<stops.length;k++)if(y<=stops[k][0]){
      const [a,c]=stops[k-1],[b,d]=stops[k];
      return c.map((v,i)=>mix(v,d[i],smooth(a,b,y)));
    }
    return stops.at(-1)[1].slice();
  };
  let seed=82191;
  for(let row=0;row<height;row++)for(let col=0;col<width;col++){
    const u=(col+.5)/width,theta=(row+.5)*Math.PI*2/height,y=Math.cos(theta),side=Math.sin(theta)>0?1:-1;
    const tone=sample(y),bodyBand=smooth(.06,.22,u)*(1-smooth(.70,.82,u));
    const pattern=u*16.7+.31*Math.sin(theta*5.3+u*17+side*.43)+.16*Math.sin(theta*11.4-u*23)+.17*Math.sin(u*24.3);
    const stripe=(1-smooth(.055,.185,Math.abs(pattern-Math.round(pattern))))*smooth(.09,.40,y)*bodyBand;
    const shoulder=smooth(.1,.55,u)*(1-smooth(.72,.87,u));
    const lateral=Math.exp(-(((y-.08+.14*u)/.025)**2))*shoulder;
    const scaleRow=theta/(Math.PI*2)*77;
    const scaleU=u*97+Math.floor(scaleRow)*.5;
    const scales=(Math.cos(scaleU*Math.PI*2)*.54+Math.cos(scaleRow*Math.PI*2)*.33)*2.8;
    seed=(Math.imul(1664525,seed)+1013904223)>>>0;
    const grain=((seed>>>25)/127-.5)*4.4;
    const head=smooth(.76,.90,u)*smooth(.19,.67,y), iridescent=Math.sin(6.9*u+theta*1.3);
    const k=4*(row*width+col);
    for(let ch=0;ch<3;ch++){
      const ink=[15,39,41][ch], olive=[76,88,67][ch],line=[230,234,203][ch];
      let value=mix(tone[ch],ink,stripe*.86);
      value=mix(value,olive,head*.44);
      value=mix(value,line,lateral*.52);
      value+=scales+grain+iridescent*shoulder*(ch===2?3:1);
      bytes[k+ch]=Math.round(pin(value,0,255));
    }
    bytes[k+3]=255;
  }
  const map=new T.DataTexture(bytes,width,height,T.RGBAFormat);
  map.colorSpace=T.SRGBColorSpace;map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;
  map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}

function design(T){
  const result=new T.BufferGeometry(),position=[],normal=[],uv=[],colors=[],indices=[],joints=[],weights=[];
  const color=new T.Color();
  const p=new T.Vector3(), n=new T.Vector3(),m=new T.Matrix4(),normalMat=new T.Matrix3();
  function vertex(point,direction,tex,tint){
    position.push(...point);normal.push(...direction);uv.push(...tex);color.set(tint);colors.push(color.r,color.g,color.b);
    const x=point[0];let bone=0,blend=0;
    if(x<spine[0]){
      while(bone<2&&x<spine[bone+1])bone++;
      blend=smooth(0,1,(spine[bone]-x)/(spine[bone]-spine[bone+1]));
    }
    joints.push(bone,bone+1,0,0);weights.push(1-blend,blend,0,0);
    return position.length/3-1;
  }
  let groupStart=0;
  function endGroup(material){result.addGroup(groupStart,indices.length-groupStart,material);groupStart=indices.length;}
  function append(g,hex,location=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){
    m.compose(new T.Vector3(...location),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale));
    normalMat.getNormalMatrix(m);
    const base=position.length/3,vertices=g.attributes.position,normals=g.attributes.normal;
    for(let i=0;i<vertices.count;i++){
      p.fromBufferAttribute(vertices,i).applyMatrix4(m);n.fromBufferAttribute(normals,i).applyMatrix3(normalMat).normalize();
      vertex(p.toArray(),n.toArray(),[0,0],hex);
    }
    for(let i=0,count=g.index?g.index.count:vertices.count;i<count;i++)indices.push(base+(g.index?g.index.getX(i):i));
  }
  function thread(points,width,tint){
    const curve=new T.CatmullRomCurve3(points.map(pt=>new T.Vector3(...pt)),false,'centripetal');
    append(new T.TubeGeometry(curve,Math.max(5,points.length*2),width,4,false),tint);
  }
  const sections=48,around=28;
  for(let i=0;i<=sections;i++)for(let j=0;j<=around;j++){
    const u=i/sections,a=j/around*2*Math.PI;
    const theta=new T.Vector3(...shell(u,a+.002)).sub(new T.Vector3(...shell(u,a-.002)));
    const along=new T.Vector3(...shell(pin(u+.0004),a)).sub(new T.Vector3(...shell(pin(u-.0004),a)));
    vertex(shell(u,a),theta.cross(along).normalize().toArray(),[u,j/around],0xffffff);
  }
  for(let i=0;i<sections;i++)for(let j=0;j<around;j++){
    const a=i*(around+1)+j,b=a+around+1;
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  endGroup(0);

  // The membranes fan out from the leading edge. Radial lines and a darker
  // leading spine retain the fin silhouette in motion and at grazing angles.
  function fan(root,rim,tint,rayTint,rayWidth){
    const points=[root,...rim];
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
    const idx=[];for(let j=1;j<rim.length;j++)idx.push(0,j,j+1);geom.setIndex(idx);geom.computeVertexNormals();
    append(geom,tint);
    for(let j=0;j<rim.length;j++){
      const dest=rim[j],mid=root.map((v,k)=>mix(v,dest[k],.56));
      mid[2]+=.0016;thread([root,mid,dest],j===0?rayWidth*1.55:rayWidth,rayTint);
    }
  }
  const upperRoot=[-.303,.004,0],lowerRoot=[-.303,-.004,0];
  fan(upperRoot,[[-.344,.030,0],[-.390,.091,0],[-.454,.133,.003],[-.438,.095,.002],
    [-.420,.060,0],[-.393,.032,0],[-.38,.012,0],[-.383,0,0]],0x617875,0x3d5456,.00165);
  fan(lowerRoot,[[-.383,0,0],[-.387,-.015,0],[-.402,-.038,0],[-.424,-.073,-.001],
    [-.449,-.114,-.003],[-.413,-.096,-.002],[-.369,-.059,0],[-.339,-.023,0]],0x768881,0x475c5e,.00165);
  fan([.122,.089,0],[[.107,.120,0],[.083,.155,.002],[.066,.129,.001],[.051,.112,0],[.031,.101,0],[.002,.089,0]],0x667a71,0x3c5559,.00115);
  fan([-.055,.074,0],[[-.070,.089,0],[-.097,.111,0],[-.108,.091,0],[-.126,.073,0],[-.145,.060,0]],0x718982,0x475f5d,.00115);
  fan([-.066,-.067,0],[[-.089,-.092,0],[-.111,-.085,0],[-.146,-.056,0]],0x9da99a,0x6c7974,.0012);
  for(let i=0;i<4;i++){
    const x=-.14-i*.035,u=(x-tailX)/(noseX-tailX),h=profile(u,1),center=profile(u,3);
    for(const s of [-1,1])fan([x+.012,center+s*h,0],[[x,center+s*(h+.013),0],
      [x-.012,center+s*(h+.016),0],[x-.010,center+s*(h-.004),0]],0x859281,0x647870,.00075);
  }
  for(const side of [-1,1]){
    const base=cheek(.181,-.009,side,.001);
    fan(base,[cheek(.151,-.003,side,.009),cheek(.091,-.014,side,.026),
      cheek(.034,-.048,side,.055),cheek(.083,-.045,side,.042),cheek(.137,-.036,side,.019),
      cheek(.161,-.026,side,.007)],0x677e78,0x435a54,.0012);
    fan([.058,-.076,side*.018],[[.055,-.10,side*.022],[.015,-.126,side*.036],
      [.022,-.101,side*.029],[.036,-.081,side*.021]],0xa7ae99,0x697c71,.001);
    thread([[.236,.057],[.215,.046],[.199,.024],[.195,.002],[.204,-.028],[.222,-.044]]
      .map(([x,y])=>cheek(x,y,side,.0011)),.0021,0x536a65);
    thread([[.227,.047],[.212,.021],[.210,.001],[.218,-.024]].map(([x,y])=>cheek(x,y,side,.0013)),.00135,0xbecbc1);
    thread([[.418,-.008],[.406,-.013],[.380,-.021],[.353,-.022],[.326,-.017]]
      .map(([x,y])=>cheek(x,y,side,.0013)),.00195,0x34474a);
  }
  endGroup(1);
  const sphere=new T.SphereGeometry(1,15,11);
  for(const side of [-1,1]){
    const eye=cheek(.316,.023,side,.0005);
    append(sphere,0x243333,eye,[.0198,.0194,.0054]);
    append(sphere,0xbda26a,[eye[0],eye[1],eye[2]+side*.0038],[.0169,.0169,.0048]);
    append(sphere,0x182125,[eye[0]+.0016,eye[1],eye[2]+side*.0075],[.0127,.013,.0034]);
    append(sphere,0xe6f3f2,[eye[0]+.0054,eye[1]+.0056,eye[2]+side*.0104],[.00302,.00288,.0016]);
  }
  endGroup(2);
  result.setAttribute('position',new T.Float32BufferAttribute(position,3));
  result.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
  result.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  result.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  result.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  result.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  result.setIndex(indices);result.computeBoundingSphere();
  return {geometry:result,materials:[
    new T.MeshPhysicalMaterial({map:colourMap(T),roughness:.33,metalness:.23,clearcoat:.68,
      clearcoatRoughness:.22,iridescence:.20,iridescenceIOR:1.33,iridescenceThicknessRange:[100,190]}),
    new T.MeshStandardMaterial({vertexColors:true,roughness:.47,metalness:.23,side:T.DoubleSide}),
    new T.MeshPhysicalMaterial({vertexColors:true,roughness:.20,metalness:.23,clearcoat:.88})
  ],count:0};
}

export function createCoastalFish(T){
  if(!shoals.has(T))shoals.set(T,design(T));
  const assets=shoals.get(T),group=new T.Group();
  group.name='Coastal mackerel';
  const body=new T.SkinnedMesh(assets.geometry,assets.materials);
  const bones=spine.map(()=>new T.Bone());
  bones.forEach((bone,i)=>{
    bone.position.x=spine[i]-(i?spine[i-1]:0);
    (i?bones[i-1]:body).add(bone);
  });
  body.bind(new T.Skeleton(bones));
  body.boundingSphere=new T.Sphere(new T.Vector3(0,.002,0),.54);
  body.castShadow=true;body.receiveShadow=true;group.add(body);
  let lastTime=null,phase=(assets.count++*2.39996)%(Math.PI*2);
  function animate(time,effort=1){
    const energy=pin(effort),delta=lastTime===null?0:pin(time-lastTime,0,.10);
    lastTime=time;phase=(phase+delta*(9.1+12.2*energy))%(2*Math.PI);
    bones[0].rotation.y=-Math.sin(phase+.76)*(.009+.024*energy);
    bones[1].rotation.y=Math.sin(phase)*(.047+.159*energy);
    bones[2].rotation.y=Math.sin(phase-.62)*(.10+.26*energy);
    bones[3].rotation.y=Math.sin(phase-1.2)*(.11+.25*energy);
  }
  animate(0,0);
  return {group,animate};
}
