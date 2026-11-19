import {addFlightFeathers, atlasTile, loadPlumageAtlas, torsoSections} from './plumage.js';
import {createCrashPose} from './crash-pose.js';

// The bicycle and bird share a crank: pedal pivots also provide the targets for the legs.
export function createRider(T) {
  const group = new T.Group();
  group.name = 'Pelican cyclist';
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const ivory = 0xe5e1d0, pearl = 0xf0ebdb, feather = 0xc0b8a3;
  const ink = 0x202827, slate = 0x5d5b58, honey = 0xc6af79;
  const orange = 0x747369, mint = 0x355951, mintLight = 0x56645d;
  const nickel = 0xb3b6af, mahogany = 0x6d4933, rubber = 0x292927;
  const atlas = loadPlumageAtlas(T);
  const materials = new Map();
  const mergedMaterials = new Map();
  const up = V(0, 1, 0);
  const sphere = new T.SphereGeometry(1, 16, 12);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 10);
  const box = new T.BoxGeometry(1, 1, 1);
  function material(color, finish = 'paint') {
    const key = color + '/' + finish;
    if (!materials.has(key)) {
      const value = new T.MeshStandardMaterial({ color });
      value.userData.finish = finish;
      materials.set(key, value);
    }
    return materials.get(key);
  }
  function child(parent, x = 0, y = 0, z = 0) {
    const node = new T.Group();
    node.position.set(x, y, z);
    parent.add(node);
    return node;
  }
  function shape(parent, geometry, color, finish = 'paint') {
    const node = new T.Mesh(geometry, material(color, finish));
    parent.add(node);
    return node;
  }
  function egg(parent, p, s, color, finish) {
    const node = shape(parent, sphere, color, finish);
    node.position.set(...p);
    node.scale.set(...s);
    return node;
  }
  function block(parent, p, s, color, finish) {
    const node = shape(parent, box, color, finish);
    node.position.set(...p);
    node.scale.set(...s);
    return node;
  }
  function link(parent, a, b, r, color, finish) {
    const node = shape(parent, cylinder, color, finish);
    const v1 = V(...a), v2 = V(...b), delta = v2.clone().sub(v1);
    node.position.copy(v1).lerp(v2, .5);
    node.scale.set(r, delta.length(), r);
    node.quaternion.setFromUnitVectors(up, delta.normalize());
    return node;
  }
  function bend(parent, points, r, color, finish) {
    const curve = new T.CatmullRomCurve3(points.map(p => V(...p)));
    return shape(parent, new T.TubeGeometry(curve, Math.max(9, points.length * 3), r, 7, false), color, finish);
  }
  function ring(parent, p, radius, tube, color, finish, axis = 'x') {
    const node = shape(parent, new T.TorusGeometry(radius, tube, 8, 44), color, finish);
    node.position.set(...p);
    if (axis === 'x') node.rotation.y = Math.PI / 2;
    if (axis === 'y') node.rotation.x = Math.PI / 2;
    return node;
  }
  // Loft custom cross-sections along Z. Each ring has its own upper and lower profile.
  function hull(parent, sections, color, n = 20, finish) {
    const pos = [], idx = [], tex = [];
    const start = sections[0][0], span = sections.at(-1)[0] - start || 1;
    for (const [z, x, y, width, top, bottom = top] of sections) {
      for (let j = 0; j <= n; j++) {
        const a = 2 * Math.PI * j / n, sy = Math.sin(a);
        pos.push(x + width * Math.cos(a), y + (sy < 0 ? bottom : top) * sy, z);
        tex.push(j / n, (z - start) / span);
      }
    }
    for (let i = 0; i < sections.length - 1; i++) {
      for (let j = 0; j < n; j++) {
        const stride = n + 1, a = i * stride + j, b = a + 1;
        idx.push(a, b, a + stride, b, b + stride, a + stride);
      }
    }
    for (let j = 1; j < n - 1; j++) {
      const end = (sections.length - 1) * (n + 1);
      idx.push(0, j + 1, j, end, end + j, end + j + 1);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(tex, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return shape(parent, geo, color, finish);
  }
  // Batching rigid parts retains independently moving joints and keeps draw calls low.
  function bake(node) {
    const sets = new Map();
    for (const item of [...node.children]) {
      if (item.isGroup) { bake(item); continue; }
      const tile = atlasTile(item.material.userData.finish);
      const finish = tile >= 0 ? 'mapped' : item.material.userData.finish;
      if (!sets.has(finish)) sets.set(finish, { p: [], n: [], c: [], uv: [] });
      const data = sets.get(finish);
      item.updateMatrix();
      const geom = item.geometry.clone().applyMatrix4(item.matrix);
      const g = geom.index ? geom.toNonIndexed() : geom;
      const {position, normal, uv} = g.attributes, color = item.material.color;
      for (let i = 0; i < position.count; i++) {
        data.p.push(position.getX(i), position.getY(i), position.getZ(i));
        data.n.push(normal.getX(i), normal.getY(i), normal.getZ(i));
        data.c.push(color.r, color.g, color.b);
        if (tile >= 0) {
          const u = uv ? uv.getX(i) : 0, v = uv ? uv.getY(i) : 0;
          const pad = .005;
          data.uv.push((tile%3+pad+u*(1-2*pad))/3,(2-Math.floor(tile/3)+pad+v*(1-2*pad))/3);
        }
      }
      node.remove(item);
    }
    for (const [finish, d] of sets) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(d.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(d.n, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(d.c, 3));
      if(d.uv.length) g.setAttribute('uv',new T.Float32BufferAttribute(d.uv,2));
      g.computeBoundingSphere();
      if (!mergedMaterials.has(finish)) mergedMaterials.set(finish, new T.MeshStandardMaterial({
        vertexColors: true, roughness: finish === 'metal' ? .3 : finish === 'mapped' ? .85 : .50,
        metalness: finish === 'metal' ? .62 : finish === 'paint' ? .10 : .01,
        ...(finish === 'mapped' && atlas ? {map:atlas, bumpMap:atlas, bumpScale:.0011}:{}),
      }));
      const m = new T.Mesh(g, mergedMaterials.get(finish));
      m.castShadow = true;
      m.receiveShadow = true;
      node.add(m);
    }
  }

  const bike = child(group);
  const birdRig = child(group);
  bike.name = 'Bicycle';
  birdRig.name = 'Pelican and wardrobe';
  const wheelY = .495, axleZ = .765;
  function wheel(parent, z) {
    const pivot = child(parent, 0, wheelY, z);
    ring(pivot, [0,0,0], .455, .04, rubber,'tread');
    for (const side of [-1, 1]) {
      ring(pivot, [side * .025,0,0], .44, .018, 0x938778,'tread');
      ring(pivot, [side * .017,0,0], .412, .011, nickel, 'metal');
      for (let i = 0; i < 14; i++) {
        const a = 2 * Math.PI * (i + (side + 1) / 4) / 14, b = a + side * .40;
        link(pivot, [side * .064, .038 * Math.cos(b), .038 * Math.sin(b)],
          [side * .008, .41 * Math.cos(a), .41 * Math.sin(a)], .0035, nickel, 'metal');
      }
    }
    link(pivot, [-.07,0,0], [.07,0,0], .041, nickel, 'metal');
    block(pivot, [.008,.22,.20], [.023,.082,.022], 0xffaa32).rotation.x = .68;
    return pivot;
  }
  const rearWheel = wheel(bike, axleZ);
  const steering = child(bike, 0, 0, -axleZ);
  const frontWheel = wheel(steering, 0);
  function fender(parent, z, start, end) {
    // Pressed sheet steel with a raised spine and rolled side edges.
    const positions=[], indices=[], widths=[-.050,-.043,-.024,0,.024,.043,.050],rings=36;
    for(let i=0;i<=rings;i++) {
      const a=start+(end-start)*i/rings;
      widths.forEach((x,j)=>{
        const r=.522-.018*Math.pow(Math.abs(x)/.05,2);
        positions.push(x,wheelY+r*Math.sin(a),z+r*Math.cos(a));
        if(i<rings && j<widths.length-1){
          const index=i*widths.length+j, next=index+widths.length;
          indices.push(index,index+1,next, index+1,next+1,next);
        }
      });
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setIndex(indices);
    g.computeVertexNormals();
    shape(parent,g,mintLight);
  }
  fender(bike, axleZ, .12, Math.PI * .93);
  fender(steering, 0, .16, Math.PI * .76);
  const crankY = .51, crankZ = .04;
  const bracket = [0,crankY,crankZ], collar = [0,1.04,.31], head = [0,1.08,-.57];
  link(bike, bracket, collar, .035, mint);
  link(bike, bracket, [0,.88,-.62], .045, mint);
  bend(bike, [[0,.98,.27],[0,.83,.10],[0,.80,-.05],[0,.87,-.30],head],.032,mint);
  link(bike, head, [0,.88,-.62], .049, mint);
  for (const side of [-1,1]) {
    link(bike, [side*.09,wheelY,axleZ], bracket, .022, mint);
    link(bike, [side*.09,wheelY,axleZ], collar, .019, mint);
    bend(steering, [[side*.089,wheelY,0],[side*.085,.57,.055],[side*.06,.78,.105],[side*.032,.91,.145]], .026, mint);
    link(bike,[side*.06,.99,.72],[side*.10,.52,.77],.009,nickel,'metal');
    bend(bike,[[side*.09,1.04,1.02],[side*.09,1.04,.65],[side*.07,1.015,.45]],.012,nickel,'metal');
  }
  link(steering,[0,.89,.143],[0,1.24,.25],.026,nickel,'metal');
  bend(steering,[[-.29,1.21,.32],[-.23,1.24,.29],[-.13,1.24,.18],[0,1.24,.17],[.13,1.24,.18],[.23,1.24,.29],[.29,1.21,.32]],.018,nickel,'metal');
  for (const side of [-1,1]) {
    link(steering,[side*.24,1.232,.29],[side*.32,1.205,.36],.029,mahogany,'leather');
    bend(steering,[[side*.23,1.23,.27],[side*.16,1.09,.13],[side*.09,.91,.20],[side*.04,.89,.17]],.0065,ink);
  }
  egg(steering,[.20,1.27,.25],[.04,.037,.04],honey,'metal');
  egg(steering,[0,1.016,-.014],[.062,.057,.075],ink);
  egg(steering,[0,1.022,-.073],[.052,.043,.018],0xffe5a1);
  link(bike,collar,[0,1.245,.37],.022,nickel,'metal');
  const saddle = hull(bike,[[.18,0,1.18,.035,.018],[.29,0,1.187,.064,.03],[.42,0,1.19,.134,.047],[.49,0,1.185,.104,.03],[.525,0,1.185,.015,.014]],mahogany,20,'leather');
  saddle.position.y = .065;
  // A canvas tool pouch sits on the rack with leather webbing stitched over it.
  hull(bike,[[.665,0,1.092,.091,.04,.039],[.685,0,1.091,.136,.06,.045],[.823,0,1.09,.143,.067,.044],[.94,0,1.081,.139,.055,.033],[.961,0,1.077,.104,.041,.027]],0x918575,24,'fabric');
  for(const x of [-.077,.077]) {
    bend(bike,[[x,1.095,.66],[x,1.141,.68],[x,1.15,.76],[x,1.146,.87],[x,1.12,.947],[x,1.075,.966]],.008,mahogany,'leather');
    block(bike,[x,1.10,.954],[.021,.014,.011],nickel,'metal');
  }
  bend(bike,[[0,1.025,.94],[0,1.022,1.006],[0,.992,1.035]],.012,ink);
  egg(bike,[0,.991,1.042],[.039,.027,.022],ink);
  egg(bike,[0,.993,1.058],[.03,.021,.012],0xac3e33);
  ring(bike,[.088,crankY,crankZ],.123,.014,nickel,'metal');
  ring(bike,[.085,wheelY,axleZ],.068,.012,nickel,'metal');
  bend(bike,[[.091,.63,.03],[.091,.61,.30],[.091,.564,.775],[.091,.545,.81],[.091,.48,.837],[.091,.432,.765],[.091,.391,.05],[.091,.408,-.04],[.091,.495,-.08],[.091,.575,-.055],[.091,.63,.03]],.008,ink);
  const cranks = [], pedals = [], feet = [], legs = [];
  function webbedFoot(p) {
    hull(p,[[-.145,0,.014,.026,.005],[-.123,0,.014,.063,.009],[-.08,0,.021,.079,.012],[.014,0,.027,.034,.022],[.076,0,.032,.028,.025],[.095,0,.031,.012,.01]],orange,16,'scales');
    for (let j=-1;j<=1;j++) {
      const x=j*.082,z=-.162+Math.abs(j)*.022;
      bend(p,[[0,.039,.044],[j*.028,.035,-.033],[j*.061,.030,-.099],[x,.019,z]],.0075,0x76766b,'scales');
      bend(p,[[x,.020,z+.012],[x,.018,z-.001],[x,.012,z-.015]],.0047,0x494a42);
    }
  }
  for (const side of [-1,1]) {
    const arm = child(bike,0,crankY,crankZ);
    link(arm,[side*.10,0,0],[side*.143,.182,0],.016,nickel,'metal');
    link(arm,[side*.128,.182,0],[side*.234,.182,0],.012,nickel,'metal');
    cranks.push(arm);
    const pedal = child(bike);
    pedal.name = side < 0 ? 'Left pedal' : 'Right pedal';
    block(pedal,[side*.01,-.012,-.023],[.116,.026,.108],ink);
    block(pedal,[side*.07,-.009,-.023],[.008,.013,.073],honey);
    pedals.push(pedal);
    const foot = child(birdRig);
    foot.name = side < 0 ? 'Left foot' : 'Right foot';
    webbedFoot(foot);
    feet.push(foot);
    const upper = child(birdRig), lower = child(birdRig);
    egg(upper,[0,.5,0],[.032,.51,.041],0x99978b,'scales');
    egg(lower,[0,.5,0],[.023,.51,.030],orange,'scales');
    for (const y of [.14,.21,.29,.36,.435,.515]) egg(lower,[0,y,0],[.022,.009,.027],0x64675e,'scales');
    const knee = child(birdRig);
    egg(knee,[0,0,0],[.031,.038,.034],0x77766b,'scales');
    legs.push({upper,lower,knee});
  }

  const bird = child(birdRig);
  hull(bird,torsoSections,0xa6a39b,32,'contour');
  addFlightFeathers(T,bird,shape);
  for (const side of [-1,1]) {
    // Rest the carpal edge on the bar, keeping the wing's folded remiges visible.
    hull(bird,[[-.48,side*.279,1.232,.014,.012],[-.42,side*.28,1.26,.029,.034],[-.31,side*.282,1.35,.043,.074],[-.19,side*.281,1.46,.066,.093],[-.07,side*.260,1.52,.072,.088],[.05,side*.255,1.55,.031,.045]],0x807f79,20,'contour');
    for (let i=0;i<3;i++) {
      const q=egg(bird,[side*(.280+i*.009),1.264+i*.012,-.416+i*.026],[.013,.012,.070],i===2?0x706f68:slate,'vane');
      q.rotation.x=-.51;
    }
  }
  const headPivot = child(bird,0,1.57,-.16);
  // One curved loft joins chest, nape and skull without a collar-shaped intersection.
  // The section planes remain perpendicular to the spine as it bends into the head.
  const profile = [
    [-.035,.007,.144,.157],[.060,.014,.155,.158],[.151,.040,.134,.133],
    [.245,.060,.111,.111],[.345,.052,.102,.104],[.435,.019,.108,.109],
    [.505,-.025,.123,.115],[.552,-.090,.144,.128],[.573,-.163,.154,.127],
    [.577,-.246,.140,.100],[.551,-.329,.091,.048],[.524,-.423,.028,.013]
  ];
  const spine = new T.CatmullRomCurve3(profile.map(([y,z])=>V(0,y,z)));
  const radii = new T.CatmullRomCurve3(profile.map((r,i)=>V(r[2],r[3],i*.04)));
  const neckPos=[], neckIdx=[], neckUV=[], rings=50, sides=40;
  for (let i=0;i<=rings;i++) {
    const t=i/rings, c=spine.getPoint(t), tangent=spine.getTangent(t), r=radii.getPoint(t);
    for (let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2, dorsal=Math.sin(a)*r.y;
      neckPos.push(Math.cos(a)*r.x,c.y-tangent.z*dorsal,c.z+tangent.y*dorsal);
      neckUV.push(j/sides,t);
    }
  }
  for (let i=0;i<rings;i++) for (let j=0;j<sides;j++) {
    const stride=sides+1,a=i*stride+j,b=a+1;
    neckIdx.push(a,a+stride,b,b,a+stride,b+stride);
  }
  const neckGeo=new T.BufferGeometry();
  neckGeo.setAttribute('uv',new T.Float32BufferAttribute(neckUV,2));
  neckGeo.setAttribute('position',new T.Float32BufferAttribute(neckPos,3));
  neckGeo.setIndex(neckIdx);
  neckGeo.computeVertexNormals();
  shape(headPivot,neckGeo,0xf6f3e9,'down');
  // A folded grey-brown gular membrane hangs between the flexible lower jaws.
  const pouch = [[-1.060,0,.429,.008,.007,.012],[-1.015,0,.443,.031,.013,.025],[-.87,0,.459,.057,.015,.066],[-.69,0,.460,.082,.016,.115],[-.514,0,.463,.104,.019,.149],[-.39,0,.477,.115,.025,.162],[-.298,0,.492,.129,.031,.141],[-.204,0,.49,.109,.029,.103],[-.132,0,.478,.06,.029,.048]];
  const lowerBill=child(headPivot,0,.50,-.24);
  const membrane=hull(lowerBill,pouch,0xf3ebde,32,'pouch');
  membrane.position.copy(lowerBill.position).multiplyScalar(-1);
  hull(headPivot,[[-1.071,0,.432,.012,.013,.013],[-1.019,0,.454,.028,.013,.013],[-.86,0,.48,.064,.014,.018],[-.65,0,.497,.086,.019,.019],[-.46,0,.516,.107,.024,.024],[-.318,0,.536,.119,.037,.037],[-.224,0,.551,.102,.032,.037]],0xeae4d6,32,'horn');
  hull(headPivot,[[-1.094,0,.409,.003,.01,.006],[-1.084,0,.426,.011,.009,.014],[-1.066,0,.437,.019,.013,.014],[-1.041,0,.447,.019,.01,.012],[-1.022,0,.45,.008,.008,.007]],0xae7961,20,'horn');
  for (const side of [-1,1]) {
    bend(headPivot,[[side*.023,.449,-1.02],[side*.061,.469,-.86],[side*.085,.479,-.65],[side*.105,.49,-.46],[side*.119,.50,-.318]],.002,0x786d60);
    egg(headPivot,[side*.138,.582,-.249],[.005,.016,.017],0xb9afa2);
    egg(headPivot,[side*.142,.582,-.250],[.005,.011,.011],0x211d1f);
    egg(headPivot,[side*.146,.586,-.253],[.0014,.002,.002],0xf0ebe2);
  }

  const closets = {};
  const outfits = {
    coast:{shell:0x516960, stripe:0xb6b3a3, cloth:0xa0634b, tip:0xc1ab84},
    alpine:{shell:0x755c62, stripe:0xb9a795, cloth:0x62747c, tip:0xc6b99e},
    night:{shell:0x35424c, stripe:0xa6bfbb, cloth:0xbda776, tip:0x526164}
  };
  for (const [id,fabric] of Object.entries(outfits)) {
    const cap = child(headPivot,0,.665,-.140);
    cap.scale.set(.84,.78,.91);
    const scarf = child(headPivot,0,.313,.045);
    scarf.scale.set(.81,.67,.89);
    const coat = child(bird);
    const tails=[];
    if (id==='alpine') {
      egg(cap,[0,.041,0],[.202,.13,.211],fabric.shell,'fabric');
      egg(cap,[0,.007,0],[.21,.051,.216],fabric.stripe,'fabric');
      for(let k=0;k<13;k++){
        const a=k*Math.PI*2/13;
        const rib=egg(cap,[.185*Math.cos(a),.046,.192*Math.sin(a)],[.006,.073,.007],0x8a7478,'fabric');
        rib.rotation.z=.26*Math.cos(a);rib.rotation.x=-.26*Math.sin(a);
      }
      egg(cap,[0,.17,.018],[.050,.045,.052],fabric.stripe,'fabric');
      hull(coat,[[-.37,0,1.584,.135,.135],[-.285,0,1.565,.255,.248],[-.115,0,1.554,.335,.32],[.021,0,1.536,.368,.33],[.108,0,1.524,.373,.309]],0x866971,24,'fabric');
      hull(coat,[[.081,0,1.529,.373,.314],[.100,0,1.525,.374,.312],[.112,0,1.523,.373,.31]],fabric.stripe,24,'fabric');
    } else {
      const geo = new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.51);
      const dome=shape(cap,geo,fabric.shell);
      dome.position.y=-.004;dome.scale.set(.208,.12,.222);
      egg(cap,[0,-.004,0],[.209,.020,.222],ink);
      for(const side of [-1,1]) {
        const vent=egg(cap,[side*.125,.080,.014],[.016,.008,.079],0x333d39);
        vent.rotation.z=-side*.58;
      }
      for(const x of [-.059,.059]){
        bend(cap,[[x,.00,.209],[x,.070,.164],[x,.101,.080],[x,.111,.006],[x,.102,-.082],[x,.07,-.164],[x,.00,-.209]],.006,fabric.stripe);
      }
      const brim=egg(cap,[0,.001,-.185],[.148,.016,.127],fabric.shell);brim.rotation.x=-.08;
      for(const side of [-1,1]){
        bend(cap,[[side*.180,-.018,.095],[side*.169,-.091,.046],[side*.154,-.130,.015],[side*.169,-.074,-.034],[side*.180,-.016,-.070]],.006,ink);
      }
      if(id==='night') {
        for(const side of [-1,1]){
          const lens=egg(cap,[side*.177,-.045,-.112],[.029,.041,.070],0x275567,'metal');
          lens.rotation.y=side*.15;
          bend(cap,[[side*.198,-.035,-.16],[side*.209,-.019,-.11],[side*.202,-.017,-.065]],.006,fabric.stripe);
        }
        egg(cap,[0,.043,-.194],[.055,.038,.028],ink);
        egg(cap,[0,.044,-.216],[.036,.025,.012],0xeaffc2);
      }
    }
    egg(scarf,[0,.014,.003],[.155,.062,.161],fabric.cloth,'fabric');
    const fold=egg(scarf,[0,.041,.006],[.156,.029,.155],fabric.cloth,'fabric');fold.rotation.z=.15;
    egg(scarf,[-.035,-.003,.142],[.048,.037,.047],fabric.cloth,'fabric');
    for(let j=0;j<2;j++) {
      const tail=child(scarf,-.03+(j-.5)*.046,-.01,.132);
      const len=j===0?.51:.37;
      hull(tail,[[0,0,0,.025,.013],[len*.22,0,.006,.052,.012],[len*.50,j*.016,.026,.049,.009],[len*.77,j*.029,.002,.046,.008],[len*.96,j*.034,-.017,.042,.006],[len,j*.034,-.023,.037,.003]],fabric.cloth,12,'fabric');
      hull(tail,[[len*.786,j*.029,.001,.047,.009],[len*.828,j*.03,-.003,.046,.008]],fabric.tip,12,'fabric');
      tails.push(tail);
    }
    closets[id]={cap,scarf,coat,tails};
  }
  bake(group);
  const impact = createCrashPose(T, group, bike, birdRig);
  const beak=child(headPivot,0,.45,-.85);
  beak.name='Bill catch point';
  let outfit='coast', phase=0;
  function setOutfit(id) {
    if (!Object.hasOwn(closets,id)) return;
    outfit=id;
    for(const [key,e] of Object.entries(closets)) {
      e.cap.visible=e.scarf.visible=e.coat.visible=key===id;
    }
  }
  const hip=V(0,0,0),ankle=V(0,0,0),knee=V(0,0,0),line=V(0,0,0);
  const reach=V(0,0,0),bendDirection=V(0,0,0),looseFoot=V(0,0,0);
  function placeLimb(part,a,b) {
    line.copy(b).sub(a);
    part.position.copy(a);
    part.scale.y=line.length();
    part.quaternion.setFromUnitVectors(up,line.normalize());
  }
  function update(dt,{speed=0,time=0,steer=0,brake=false,crash=null,gape=0,swallow=0}={}) {
    const strain=Math.min(1,Math.abs(speed)/8), v=Math.max(0,speed);
    const lean=steer*.055, hit=impact.begin(crash,v,lean);
    const release=hit?.release ?? 0, kick=hit?.kick ?? 0;
    if(!hit) phase=(phase+dt*Math.min(11,v*1.13)*(brake?.12:1))%(Math.PI*2);
    const rollSpeed=hit ? hit.rollSpeed*Math.exp(-1.85*hit.elapsed)*
      Math.min(1,Math.max(0,(hit.motion.restTime-hit.elapsed)/.23))+hit.bikeRetrievalSpeed : v;
    frontWheel.rotation.x-=dt*rollSpeed/wheelY;
    rearWheel.rotation.x-=dt*rollSpeed*(hit ? 1+.21*(1-hit.bikeReturn) : 1)/wheelY;
    steering.rotation.y=-steer*.13+(hit ? hit.side*.43*release*(1-hit.bikeReturn) : 0);
    const bob=Math.cos(phase*2)*.012*strain*(1-release);
    bird.position.y=bob;
    lowerBill.rotation.x=hit?0:-.44*gape;
    headPivot.rotation.x=.045+Math.sin(phase*2+.55)*.020*strain+(brake?.07:0)+.19*kick+.08*release+(hit?0:.065*gape+.27*swallow);
    headPivot.rotation.y=(Math.sin(time*.47)*.045-steer*.095)*(1-release)+(hit ? hit.side*.11*release : 0);
    if(hit){
      headPivot.rotation.y+=hit.side*1.05*hit.tuck;
      headPivot.rotation.x-=.65*hit.tuck;
    }
    for(let j=0;j<2;j++) {
      const side=j===0?-1:1, a=phase+j*Math.PI;
      cranks[j].rotation.x=-a;
      const y=crankY+Math.cos(a)*.182,z=crankZ-Math.sin(a)*.182;
      const pedal=pedals[j],foot=feet[j];
      pedal.position.set(side*.191,y+.013,z);
      pedal.rotation.x=.11*Math.sin(a);
      foot.position.copy(pedal.position);
      foot.rotation.copy(pedal.rotation);
      if (release > 0) {
        const landingSide=hit.side===side;
        looseFoot.set(side*(landingSide ? .18 : .36),
          (landingSide ? .96 : .85)+kick*(landingSide ? .10 : .19),
          (landingSide ? .63 : .80)+.14*kick);
        foot.position.lerp(looseFoot,release);
        foot.rotation.x+=release*(.42+.25*kick);
        foot.rotation.y=side*.22*release;
        foot.rotation.z=side*.12*release;
      }
      hip.set(side*.19,1.270+bob,.20);
      ankle.set(0,.035,.053).applyQuaternion(foot.quaternion).add(foot.position);
      reach.copy(ankle).sub(hip);
      const d=Math.max(.01,reach.length());
      reach.divideScalar(d);
      const l1=.50,l2=.51,k=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-k*k));
      bendDirection.set(side*.025,0,-1);
      bendDirection.addScaledVector(reach,-bendDirection.dot(reach)).normalize();
      knee.copy(hip).addScaledVector(reach,k).addScaledVector(bendDirection,h);
      placeLimb(legs[j].upper,hip,knee);placeLimb(legs[j].lower,knee,ankle);
      legs[j].knee.position.copy(knee);
      const tail=closets[outfit].tails[j];
      tail.rotation.x=(.22-strain*.26+.11*Math.sin(time*(4+strain*3)+j))*(1-release)+release*(.35-.58*kick);
      tail.rotation.y=(.15*Math.sin(time*(3+strain)+j*.7)-.09)*(1-release)+(hit ? hit.side*.26*release : 0);
    }
    impact.place(hit,lean);
  }
  setOutfit(outfit);
  update(0);
  return {group,bicycle:bike,beak,framingPoint:impact.framingPoint,update,setOutfit};
}
