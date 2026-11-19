import {shellProfile, deckPoint, surface, line as tube, box} from './tesla-tools.js';

// Dimensions are those of the standard Model S and 2024+ Model 3 in Tesla's
// respective owner's manuals. Coordinates are in metres, with the nose at −Z.
// Original surface design references Tesla's Model S Exterior Grid and Model 3
// Exterior Hero photographs, and teslamotors/custom-wraps/model3-2024-base.
const modelS = {
  name:'Model S', width:1.987, length:5.021, height:1.430, wheelRadius:.352,
  wheelbase:2.960, axleMid:-.0695, track:1.690, spokes:10,
  paints:[0xa5202d,0x9da4ac,0xe4e5e4,0x263c57,0x363a3d],
  stations:[
    [-2.5105,.465,.518,.565,.199],[-2.483,.640,.551,.591,.177],[-2.417,.788,.600,.624,.163],
    [-2.285,.902,.673,.673,.154],[-2.075,.957,.733,.714,.153],[-1.803,.980,.775,.746,.150],
    [-1.55,.990,.799,.768,.147],[-1.23,.976,.809,.794,.146],[-.94,.956,.830,.840,.146],
    [-.63,.948,.854,.883,.146],[.00,.953,.875,.886,.146],[.62,.966,.908,.922,.146],
    [1.11,.985,.936,.958,.150],[1.46,.9935,.950,.960,.151],[1.78,.986,.944,.949,.156],
    [2.10,.958,.920,.943,.177],[2.33,.903,.891,.927,.192],[2.467,.790,.851,.890,.236],
    [2.5105,.612,.826,.857,.258],
  ],
  // z, roof crown height, half width at roof rail, half width at the belt, belt height.
  canopy:[
    [-1.015,.843,.755,.865,.820],[-.84,.978,.742,.883,.834],[-.60,1.132,.724,.888,.849],
    [-.32,1.280,.706,.882,.859],[-.04,1.376,.692,.871,.868],[.25,1.423,.687,.866,.879],
    [.52,1.431,.692,.864,.890],[.79,1.403,.696,.867,.904],[1.06,1.341,.710,.875,.919],
    [1.34,1.247,.718,.883,.940],[1.56,1.143,.728,.880,.956],[1.78,1.035,.751,.853,.961],
    [1.942,.950,.751,.807,.942],
  ],
};
const model3 = {
  name:'Model 3', width:1.850, length:4.720, height:1.440, wheelRadius:.337,
  wheelbase:2.875, axleMid:-.0545, track:1.584, spokes:9,
  paints:[0x9e1724,0x234870,0xd6dbde,0x45494e,0xe7e6e1],
  stations:[
    [-2.360,.423,.545,.575,.212],[-2.320,.625,.569,.601,.182],[-2.238,.763,.607,.633,.169],
    [-2.110,.844,.652,.668,.154],[-1.91,.887,.709,.701,.145],[-1.655,.911,.755,.729,.144],
    [-1.421,.920,.776,.755,.144],[-1.16,.907,.788,.781,.143],[-.904,.888,.816,.831,.143],
    [-.63,.884,.839,.870,.143],[-.03,.884,.861,.885,.143],[.55,.895,.882,.914,.143],
    [.982,.913,.908,.940,.145],[1.35,.925,.931,.953,.148],[1.66,.914,.928,.953,.154],
    [1.94,.890,.913,.944,.181],[2.195,.836,.889,.925,.216],[2.323,.735,.853,.907,.246],
    [2.36,.531,.820,.872,.267],
  ],
  canopy:[
    [-1.035,.837,.695,.799,.805],[-.86,.996,.698,.816,.819],[-.63,1.161,.687,.824,.833],
    [-.38,1.300,.672,.821,.842],[-.13,1.389,.660,.816,.849],[.16,1.434,.655,.813,.859],
    [.39,1.440,.652,.810,.870],[.65,1.407,.660,.808,.885],[.90,1.339,.671,.813,.901],
    [1.14,1.249,.688,.822,.916],[1.38,1.142,.702,.826,.935],[1.57,1.054,.709,.811,.942],
    [1.76,.956,.730,.779,.945],
  ],
};

function interpolate(rows,z,column) {
  let i=1;
  while(i<rows.length-1 && rows[i][0]<z) i++;
  const a=rows[i-1],b=rows[i],h=b[0]-a[0],u=Math.max(0,Math.min(1,(z-a[0])/h));
  const d=(b[column]-a[column])/h;
  const prev=rows[Math.max(0,i-2)],next=rows[Math.min(rows.length-1,i+1)];
  const dl=a===prev?d:(a[column]-prev[column])/(a[0]-prev[0]);
  const dr=b===next?d:(next[column]-b[column])/(next[0]-b[0]);
  const slope=(p,q)=>p*q>0?2*p*q/(p+q):0;
  const v=1-u;
  return v*v*(1+2*u)*a[column]+u*u*(3-2*u)*b[column]+h*u*v*(v*slope(dl,d)-u*slope(d,dr));
}
function mix(a,b,t) { return a+(b-a)*t; }
function samples(from,to,n,f) {
  return Array.from({length:n+1},(_,i)=>f(mix(from,to,i/n)));
}
function line(ctx,mat,points,radius,smooth=false) {
  if(smooth||points.length<5)return tube(ctx,mat,points,radius,smooth);
  // Keep fine lamp/door samples at bends, without tessellating straight lengths.
  const keep=[points[0]], tolerance=ctx.detailed?.0014:.003;
  function append(i,j) {
    const a=points[i],b=points[j],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
    const den=dx*dx+dy*dy+dz*dz||1;
    let split=-1,max=tolerance*tolerance;
    for(let k=i+1;k<j;k++){
      const p=points[k],x=p[0]-a[0],y=p[1]-a[1],z=p[2]-a[2];
      const t=Math.max(0,Math.min(1,(x*dx+y*dy+z*dz)/den));
      const d=(x-dx*t)**2+(y-dy*t)**2+(z-dz*t)**2;
      if(d>max){max=d;split=k;}
    }
    if(split<0)keep.push(b);
    else {append(i,split);append(split,j);}
  }
  append(0,points.length-1);
  return tube(ctx,mat,keep,radius,false);
}
function patch(ctx, mat, cols, rows, normal, point) {
  const vertices=[], indices=[];
  for(let r=0;r<=rows;r++) for(let c=0;c<=cols;c++) vertices.push(point(c/cols,r/rows));
  const k=Math.floor(rows/2)*(cols+1)+Math.floor(cols/2);
  const a=vertices[k],b=vertices[k+1],d=vertices[k+cols+1];
  const u=b.map((v,j)=>v-a[j]),v=d.map((w,j)=>w-a[j]);
  const winding=(u[1]*v[2]-u[2]*v[1])*normal[0]+(u[2]*v[0]-u[0]*v[2])*normal[1]+(u[0]*v[1]-u[1]*v[0])*normal[2];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
    const p=r*(cols+1)+c,q=p+cols+1;
    if(winding>=0) indices.push(p,p+1,q,p+1,q+1,q);
    else indices.push(p,q,p+1,p+1,q,q+1);
  }
  return surface(ctx,mat,vertices,indices);
}

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function endSculpt(car,x,y,z) {
  const reach=car.length*.5,blend=smooth((Math.abs(z)-reach*.64)/(reach*.36));
  if(!blend)return [x,y,z];
  const forward=z<0,center=forward?.46:.53;
  const upper=Math.max(0,(y-center)/(forward?.36:.40)),lower=Math.max(0,(center-y)/.36);
  const softBumper=(forward?.192:.085)*upper**1.65+(forward?.185:.205)*lower**1.82;
  const license=forward?0:.045*Math.exp(-((x/.28)**4)-((y-.664)/.090)**4);
  const crease=forward?.014*Math.exp(-(((y-.342)/.042)**2)):.024*Math.exp(-(((y-.469)/.046)**2));
  return [x,y,z-Math.sign(z)*blend*(softBumper+license+crease)];
}
function flank(car,z,y,side,offset=0) {
  const p=shellProfile(car,car.stations,z);
  // Keep door surfaces continuous past the wheelhouses: the rocker, shoulder
  // and door crown are referenced to the vehicle, independent of the arch cut.
  const edge=p.shoulderY-shoulderRadius(car,z);
  if(y>edge+.0001) {
    let lo=.81,hi=1;
    for(let i=0;i<9;i++){
      const mid=(lo+hi)/2,yp=rawDeck(car,z,mid)[1];
      if(yp>y)lo=mid;else hi=mid;
    }
    const x=Math.abs(rawDeck(car,z,hi)[0]);
    return endSculpt(car,side*(x+offset),y,z);
  }
  const v=Math.min(1,Math.max(0,(y-p.lowerY)/(edge-p.lowerY)));
  const sculpture=.943+.057*Math.sin(v*Math.PI*.80)+.016*v-.009*Math.sin(v*Math.PI);
  const waist=.015*Math.exp(-(((v-.48)/.20)**2))*Math.exp(-((z/1.40)**4));
  return endSculpt(car,side*(p.width*sculpture-waist+offset),y,z);
}
function shoulderRadius(car,z) {
  return (car===modelS?.055:.062)-.014*(Math.abs(z)/(car.length*.5))**2;
}
function rawDeck(car,z,u,lift=0) {
  const a=Math.abs(u),p=shellProfile(car,car.stations,z);
  if(a<=.81)return deckPoint(car,car.stations,z,u,lift);
  const angle=(a-.81)/.19*Math.PI*.5,w=Math.sin(angle);
  const inner=deckPoint(car,car.stations,z,.81)[1];
  const x=.992*p.width*(.81+.19*w);
  const y=mix(inner,p.shoulderY,w)-shoulderRadius(car,z)*(1-Math.cos(angle))+lift;
  return [Math.sign(u)*x,y,z];
}
function deck(car,z,u,lift=0) {
  const p=rawDeck(car,z,u,lift);
  return endSculpt(car,...p);
}
function sculptedShell(ctx,car) {
  const {m,detailed}=ctx,st=car.stations,half=car.length/2,extra=detailed?52:27;
  const cuts=new Set(st.map(p=>p[0]));
  for(let i=0;i<=extra;i++) cuts.add(mix(-half,half,i/extra));
  for(const axle of [car.axleMid-car.wheelbase/2,car.axleMid+car.wheelbase/2]) {
    const r=car.wheelRadius+.04,n=detailed?28:14;
    for(let j=0;j<=n;j++)cuts.add(axle+r*Math.cos(j*Math.PI/n));
    for(const side of [-1,1])cuts.add(axle+side*(r+.004));
  }
  const zs=[...cuts].sort((a,b)=>a-b).filter((z,i,list)=>!i||z-list[i-1]>.0001),n=zs.length-1;
  const zAt=t=>zs[Math.round(t*n)];
  const deckCuts=detailed?[-1,-.975,-.944,-.901,-.851,-.81,-.70,-.51,-.26,0,.26,.51,.70,.81,.851,.901,.944,.975,1]:
    [-1,-.950,-.875,-.81,-.51,0,.51,.81,.875,.950,1];
  patch(ctx,m.paint,n,deckCuts.length-1,[0,1,0],(u,v)=>deck(car,zAt(u),deckCuts[Math.round(v*(deckCuts.length-1))]));
  for(const s of [-1,1]){
    patch(ctx,m.paint,n,detailed?11:6,[s,0,0],(u,v)=>{
      const z=zAt(u), p=shellProfile(car,st,z);
      return flank(car,z,mix(p.archY,p.shoulderY-shoulderRadius(car,z),v),s);
    });
    patch(ctx,m.black,n,1,[0,-1,0],(u,v)=>{
      const z=zAt(u),p=shellProfile(car,st,z),rim=flank(car,z,p.archY,s);
      return [mix(rim[0],s*p.width*.67,v),rim[1]-.018*v,rim[2]];
    });
  }
  for(const sign of [-1,1]){
    const z=sign*half,p=shellProfile(car,st,z);
    patch(ctx,m.paint,deckCuts.length-1,detailed?11:6,[0,0,sign],(u,v)=>{
      const x=deckCuts[Math.round(u*(deckCuts.length-1))],top=rawDeck(car,z,x),y=mix(p.lowerY,top[1],v);
      const edge=p.shoulderY-shoulderRadius(car,z);
      const halfWidth=Math.abs(flank(car,z,mix(p.lowerY,edge,v),1)[0]);
      const capX=x*halfWidth+(top[0]-x*.992*p.width)*v;
      return endSculpt(car,capX,y,z);
    });
  }
}

function cabin(ctx,car) {
  const {m,detailed}=ctx,S=car===modelS,rows=car.canopy,start=rows[0][0],end=rows.at(-1)[0];
  const detail=detailed?1:.53;
  function section(z) {
    const h=interpolate(rows,z,1),w=interpolate(rows,z,2),belt=interpolate(rows,z,4);
    return {h,w,belt,outer:interpolate(rows,z,3),edge:h-Math.min(.046,(h-belt)*.18)};
  }
  function top(z,u) {
    const r=section(z);
    return [u*r.w,mix(r.h,r.edge,u*u),z];
  }
  function side(z,v,s,offset=0) {
    const r=section(z);
    return [s*(mix(r.outer,r.w,v)+.011*Math.sin(Math.PI*v)+offset),mix(r.belt,r.edge,v),z];
  }
  const header=S?-.235:-.282,backGlass=S?.752:.607;
  const stripes=[[start,start+.038,m.trim],[start+.038,header-.020,m.glass],[header-.020,header+.019,m.trim],
    [header+.019,backGlass-.012,m.roofGlass],[backGlass-.012,backGlass+.015,m.trim],
    [backGlass+.015,end-.050,m.glass],[end-.050,end,m.paint]];
  for(const [za,zb,mat] of stripes) {
    const segments=Math.max(1,Math.ceil((zb-za)*13*detail));
    patch(ctx,mat,segments,detailed?8:4,[0,1,0],(u,v)=>top(mix(za,zb,u),mix(-.950,.950,v)));
  }
  for(const s of [-1,1]) {
    patch(ctx,m.paint,detailed?34:18,2,[0,1,0],(u,v)=>top(mix(start,end,u),s*mix(.950,1,v)));
    const begin=start+.065, tail=end-(S?.21:.27);
    const edges=[
      [start,start],[begin,begin+.015],
      [S?.273:.230,S?.137:.093],[S?.365:.322,S?.222:.178],
      [S?1.05:.908,S?.924:.825],[S?1.076:.932,S?.948:.848],
      [tail-.004,tail-.107],[end,end],
    ];
    const mats=[m.paint,m.glass,m.trim,m.glass,m.trim,m.glass,m.paint];
    for(let i=0;i<mats.length;i++){
      const l=edges[i],r=edges[i+1];
      const seg=Math.max(1,Math.ceil((r[0]-l[0])*13*detail));
      const isPane=mats[i]===m.glass;
      const strip=(mat,v0,v1)=>patch(ctx,mat,seg,detailed?3:2,[s,0,0],(u,t)=>{
        const v=mix(v0,v1,t);
        return side(mix(mix(l[0],l[1],v),mix(r[0],r[1],v),u),v,s);
      });
      if(isPane) { strip(m.trim,0,.042);strip(m.glass,.042,.958);strip(m.trim,.958,1); }
      else strip(mats[i],0,1);
    }
    // The painted belt return spans the gap between the door glass and shoulder.
    patch(ctx,m.paint,detailed?32:16,3,[s,.2,0],(u,v)=>{
      const z=mix(start,end,u), inner=side(z,0,s), outer=deck(car,z,s*.866);
      return inner.map((p,i)=>mix(p,outer[i],v));
    });
    if(detailed){
      const sill=samples(begin,tail,24,z=>side(z,.012,s,.003));
      line(ctx,S?m.metal:m.trim,sill,.006,false);
      const weatherstrip=samples(begin+.02,tail-.112,24,z=>side(z,.988,s,.002));
      line(ctx,m.trim,weatherstrip,.006,false);
    }
  }
  return side;
}

// A ray cast onto the original shell makes each fascia graphic hug the compound
// bumper radius. Cache samples across paint variants and repeated traffic spawns.
const faceCaches=new WeakMap();
function bumper(ctx,car,shells,end) {
  if(!faceCaches.has(car)) faceCaches.set(car,new Map());
  const cache=faceCaches.get(car),ray=new ctx.T.Raycaster(),W=car.width/2;
  shells.forEach(mesh=>mesh.updateMatrixWorld(true));
  return (x,y,lift=.004)=>{
    const ax=Math.abs(x), key=end+':'+ax.toFixed(4)+':'+y.toFixed(4);
    let z=cache.get(key);
    if(z===undefined) {
      ray.set(new ctx.T.Vector3(ax,y,end*(car.length/2+.30)),new ctx.T.Vector3(0,0,-end));
      const hits=ray.intersectObjects(shells,true);
      z=hits.length?hits[0].point.z:end*(car.length/2-.17*(ax/W)**4);
      cache.set(key,z);
    }
    return [x,y,z+end*lift];
  };
}

function grille(ctx,car,face,S) {
  const {m,detailed}=ctx,end=[0,0,-1];
  const width=S?.718:.697;
  const lower=t=>.221+.032*t*t;
  const upper=t=>S?.330-.029*t*t:.299-.013*t*t;
  patch(ctx,m.black,detailed?24:14,3,end,(u,v)=>{
    const a=2*u-1,k=Math.abs(a);
    return face(a*width*mix(.88,1,v),mix(lower(k),upper(k),v),.009);
  });
  if(detailed) for(let j=1;j<=(S?3:2);j++){
    line(ctx,m.trim,samples(-.95,.95,18,a=>face(a*width*.955,mix(lower(Math.abs(a)),upper(Math.abs(a)),j/(S?4:3)),.015)),.004,false);
  }
  for(const s of [-1,1]){
    if(S) {
      const pts=[[.710,.388],[.805,.415],[.858,.409],[.857,.361],[.803,.353],[.724,.357]];
      const top=pts.slice(0,3),bottom=pts.slice(3).reverse();
      patch(ctx,m.black,8,2,end,(u,v)=>{
        const i=Math.min(1,Math.floor(u*2)),f=u*2-i;
        const x=mix(mix(top[i][0],top[i+1][0],f),mix(bottom[i][0],bottom[i+1][0],f),v);
        const y=mix(mix(top[i][1],top[i+1][1],f),mix(bottom[i][1],bottom[i+1][1],f),v);
        return face(s*x,y,.008);
      });
    } else if(detailed) {
      line(ctx,m.trim,samples(0,1,10,t=>face(s*mix(.713,.824,t),.271+.060*t,.007)),.007,false);
    }
  }
}

function headlamps(ctx,car,face,S) {
  const {m,detailed}=ctx,glows=[];
  // Height, outer sweep and light signature differ between the larger lamp on
  // Model S and the narrow, rising Highland headlamp.
  const start=S?.49:.460,end=S?.901:.836;
  function aperture(u) {
    const bulge=Math.sin(Math.PI*u)**.76;
    const center=(S?.589:.590)+(S?.130:.102)*u+.017*Math.sin(Math.PI*(u-.12));
    const half=(S?.050:.023)*bulge+.003;
    return [mix(start,end,u),center,half];
  }
  for(const s of [-1,1]) {
    const point=(u,v,lift)=>{
      const [x,y,r]=aperture(u);
      return face(s*x,y+r*(2*v-1),lift);
    };
    patch(ctx,m.glass,detailed?23:12,4,[0,0,-1],(u,v)=>point(u,v,.015));
    const led=samples(.018,.982,detailed?17:10,u=>point(u,S?.21+.56*u*u:.69+.14*u,.025));
    line(ctx,m.front,led,S?.010:.008,false);
    if(detailed) {
      if(S)line(ctx,m.front,samples(.61,.97,10,u=>point(u,.88,.025)),.0065,false);
      for(const u of (S?[.44,.64]:[.57,.72])) {
        const [x,y,z]=point(u,.48,.022);
        const pod=box(ctx,m.metal,[x,y,z],[.040,.015,.013],.005);
        pod.rotation.y=-s*(S?.59:.50);
      }
    }
    glows.push(point(.61,.58,.039));
  }
  return glows;
}

function tailLamps(ctx,car,face,S) {
  const {m,detailed}=ctx,signals=[];
  const extent=S?.93:.86, start=S?.36:.425;
  for(const s of [-1,1]){
    const xAt=t=>mix(start,extent,t);
    const center=t=>(S?.787:.819)+.045*t+.021*Math.sin(t*Math.PI);
    const half=t=>(S?.040:.037)*Math.sin(Math.PI*t)**.61+.007;
    const lamp=(t,v,lift)=>face(s*xAt(t),center(t)+(2*v-1)*half(t),lift);
    patch(ctx,m.black,detailed?21:12,4,[0,0,1],(t,v)=>lamp(t,v,.009));
    line(ctx,m.rear,samples(.015,.978,detailed?20:12,t=>lamp(t,.80,.018)),S?.013:.012,false);
    if(S) {
      line(ctx,m.rear,samples(.16,.97,16,t=>lamp(t,.28,.019)),.0075,false);
    } else {
      patch(ctx,m.glass,13,3,[0,0,1],(u,v)=>{
        const x=mix(.648,.832,u),y=mix(.754+.008*(1-u),.763+.054*u*u,v);
        return face(s*x,y,.010);
      });
      const hook=[lamp(.945,.79,.018),lamp(.969,.44,.021),lamp(.958,.07,.019),
        face(s*.805,.752,.019),face(s*.72,.744,.018),face(s*.636,.756,.015)];
      line(ctx,m.rear,hook,.014,false);
    }
    if(detailed) {
      const t=S?.75:.72;
      line(ctx,m.metal,samples(t-.055,t+.055,5,u=>lamp(u,.51,.017)),.006,false);
    }
    signals.push(lamp(.77,.52,.032));
  }
  if(S) {
    // Thin dark liftgate appliqué sits between the two separate lamp clusters.
    line(ctx,m.trim,samples(-.38,.38,18,x=>face(x,.823+.010*Math.abs(x),.009)),.018,false);
  }
  return signals;
}

function trunkDetails(ctx,face,S) {
  const {m}=ctx;
  patch(ctx,m.trim,22,4,[0,0,1],(u,v)=>{
    const a=2*u-1,x=a*mix(.68,.79,v),side=Math.abs(a);
    return face(x,mix(.273+.037*side,.333+.081*side**3,v),.010);
  });
  if(!S){
    // Separate cast letters on the refreshed Model 3 deck lid.
    const letters=[
      [[[-.46,1],[.46,1]],[[0,1],[0,0]]],
      [[[-.4,1],[-.4,0],[.4,0]],[[-.4,.54],[.30,.54]],[[-.4,1],[.4,1]]],
      [[[.4,1],[-.27,1],[-.42,.77],[-.23,.56],[.24,.48],[.40,.24],[.23,0],[-.41,0]]],
      [[[-.37,1],[-.37,0],[.42,0]]],
      [[[-.46,0],[0,1],[.46,0]],[[-.23,.40],[.23,.40]]],
    ];
    letters.forEach((letter,i)=>letter.forEach(stroke=>{
      line(ctx,m.badge,stroke.map(([x,y])=>face((i-2)*.080+x*.045,.815+y*.031,.015)),.0031,false);
    }));
  } else {
    line(ctx,m.badge,[face(-.045,.815,.021),face(0,.824,.021),face(.045,.815,.021)],.0055,false);
    line(ctx,m.badge,[face(0,.819,.022),face(0,.779,.022)],.0055,false);
  }
}

function panelDetails(ctx,car,S) {
  const {m}=ctx;
  for(const s of [-1,1]){
    const point=(z,y,o=.003)=>flank(car,z,y,s,o);
    const sillZ0=car.axleMid-car.wheelbase/2+.41,sillZ1=car.axleMid+car.wheelbase/2-.39;
    line(ctx,m.trim,samples(sillZ0,sillZ1,22,z=>point(z,.218+.014*((z+.18)/1.4)**2,.004)),.010,false);
    for(const [z,y] of (S?[[-.024,.795],[1.04,.844]]:[[-.055,.764],[.877,.803]])){
      const pts=samples(0,1,9,t=>point(z+.135*t,y+.011*t,.005));
      line(ctx,S?m.metal:m.trim,pts,S?.010:.011,false);
    }
    // The shutlines run down the stamped doors, sweeping forward around the rear wheel arch.
    const front=S?-.874:-.898,b=S?.30:.24;
    const curves=[
      [[front,.825],[front-.035,.737],[front-.050,.517],[front-.012,.304],[front+.055,.229]],
      [[b,.858],[b-.025,.787],[b-.055,.62],[b-.102,.384],[b-.142,.239]],
      [[S?1.36:1.227,S?.925:.894],[S?1.35:1.225,.837],[S?1.189:1.055,.736],
        [S?.996:.855,.608],[S?.916:.799,.386],[S?.853:.747,.247]],
    ];
    for(const curve of curves) {
      const path=new ctx.T.CatmullRomCurve3(curve.map(([z,y])=>new ctx.T.Vector3(z,y,0)));
      line(ctx,m.trim,samples(0,1,17,u=>{const p=path.getPoint(u);return point(p.x,p.y,.003);}),.0045,false);
    }
    // Folded triangular camera repeater behind the front wheel.
    const camZ=car.axleMid-car.wheelbase/2+.448,cy=S?.697:.674;
    surface(ctx,m.trim,[point(camZ,cy),point(camZ+.108,cy+.022),point(camZ+.104,cy-.027)],
      s>0?[0,1,2]:[0,2,1]);

  }
}

function mirrors(ctx,sideGlass,S) {
  const {m,detailed}=ctx;
  for(const s of [-1,1]){
    // Mirror stalk, body-colour aerodynamic cap and rear-facing reflective glass.
    const base=sideGlass(S?-.705:-.735,.17,s);
    const mx=s*(S?.989:.939),my=S?1.004:.980,mz=S?-.717:-.737;
    line(ctx,m.trim,[base,[s*(Math.abs(mx)-.055),my-.036,mz+.04],[mx,my-.020,mz]],.028,true);
    const profile=[[-.121,.025,.018],[-.090,.088,.043],[-.035,.105,.055],[.038,.104,.054],[.077,.079,.041]];
    patch(ctx,m.paint,detailed?9:5,detailed?16:8,[-1,0,0],(u,v)=>{
      const z=mix(profile[0][0],profile.at(-1)[0],u),a=2*Math.PI*v;
      return [mx+Math.cos(a)*interpolate(profile,z,1),my+Math.sin(a)*interpolate(profile,z,2),mz+z];
    });
    const p=profile.at(-1);
    patch(ctx,m.metal,2,detailed?16:8,[0,0,1],(u,v)=>[mx+Math.cos(2*Math.PI*v)*p[1]*u,my+Math.sin(2*Math.PI*v)*p[2]*u,mz+p[0]+.002]);
  }
}

function buildSedan(ctx,car) {
  const S=car===modelS,{m,detailed,group}=ctx;
  const first=group.children.length;
  sculptedShell(ctx,car);
  const shells=group.children.slice(first);
  const front=bumper(ctx,car,shells,-1),rear=bumper(ctx,car,shells,1);
  const sideGlass=cabin(ctx,car);
  mirrors(ctx,sideGlass,S);
  grille(ctx,car,front,S);
  const headlights=headlamps(ctx,car,front,S),rearSignals=tailLamps(ctx,car,rear,S);
  if(detailed) {
    trunkDetails(ctx,rear,S);
    panelDetails(ctx,car,S);
    // Pressed longitudinal hood seams converge toward the lower, grille-less nose.
    for(const s of [-1,1]) {
      const z0=S?-2.403:-2.240,z1=S?-.978:-.978;
      line(ctx,m.trim,samples(0,1,22,t=>deck(car,mix(z0,z1,t),s*(.53+.29*Math.sin(t*1.49)),.004)),.0035,false);
    }
    const top=S?.706:.699,bottom=S?.588:.578;
    patch(ctx,m.trim,12,3,[0,0,1],(u,v)=>rear(mix(-.218,.218,u),mix(bottom,top,v),.010));
    patch(ctx,m.metal,12,3,[0,0,1],(u,v)=>rear(mix(-.193,.193,u),mix(bottom+.010,top-.010,v),.016));
    line(ctx,m.trim,samples(-.64,.64,23,x=>rear(x,.313+.058*(x/.64)**2,.01)),.015,false);
    const badgeZ=S?-2.24:-2.154;
    const emblem=(x,z)=>deck(car,z,x,.009);
    line(ctx,m.badge,[emblem(-.049,badgeZ-.011),emblem(0,badgeZ-.019),emblem(.049,badgeZ-.011)],.0055,false);
    line(ctx,m.badge,[emblem(0,badgeZ-.012),emblem(0,badgeZ+.045)],.0055,false);
  }
  return {headlights,rearSignals};
}
modelS.build=ctx=>buildSedan(ctx,modelS);
model3.build=ctx=>buildSedan(ctx,model3);
export const sedans={modelS,model3};
