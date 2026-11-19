import {shellProfile, deckPoint, surface, line as tube} from './tesla-tools.js';

// Dimensions are those of the standard Model S and 2024+ Model 3 in Tesla's
// respective owner's manuals. Coordinates are in metres, with the nose at −Z.
// Original surface design references Tesla's Model S Exterior Grid and Model 3
// Exterior Hero photographs, and teslamotors/custom-wraps/model3-2024-base.
const modelS = {
  name:'Model S', width:1.987, length:5.021, height:1.430, wheelRadius:.352,
  wheelbase:2.960, axleMid:-.0695, track:1.690, spokes:10,
  paints:[0xa5202d,0x9da4ac,0xe4e5e4,0x263c57,0x363a3d],
  stations:[
    [-2.5105,.465,.499,.516,.199],[-2.483,.640,.547,.578,.177],[-2.417,.788,.600,.624,.163],
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
    [-2.360,.423,.510,.525,.212],[-2.320,.625,.559,.585,.182],[-2.238,.763,.607,.633,.169],
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
  // The high deck wraps into a stamped trapezoidal number-plate recess.
  const pocketWidth=(car===modelS?.40:.34)+.16*(y-.65);
  const license=forward?0:(car===modelS?.063:.052)*smooth((pocketWidth-Math.abs(x))/.105)
    *smooth((y-.515)/.086)*smooth((.765-y)/.051);
  const crease=forward?.014*Math.exp(-(((y-.342)/.042)**2)):.024*Math.exp(-(((y-.469)/.046)**2));
  const bow=(forward?.108:.069)*(x/(car.width*.5))**2;
  const inlet=forward&&car===modelS?.080*Math.exp(-(((Math.abs(x)-.815)/.145)**4)-(((y-.356)/.076)**4)):0;
  return [x,y,z-Math.sign(z)*blend*(softBumper+license+crease+bow+inlet)];
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
  const sculpture=.943+.057*Math.sin(v*Math.PI*.80)+.015496*v-.009*Math.sin(v*Math.PI);
  const doorSpan=smooth((z+1.32)/.49)*smooth((1.52-z)/.41);
  const progression=smooth((z+1.12)/2.45);
  const crease=car===modelS?.41+.26*progression:.42+.17*progression;
  const hollow=(car===modelS?.043:.032)*Math.exp(-(((v-crease)/.22)**2));
  const rocker=.017*Math.exp(-(((v-.16-.13*progression)/.085)**2));
  const shoulder=.012*Math.exp(-(((v-.84)/.11)**2));
  return endSculpt(car,side*(p.width*sculpture+doorSpan*(rocker+shoulder-hollow)+offset),y,z);
}
function shoulderRadius(car,z) {
  return (car===modelS?.055:.062)-.014*(Math.abs(z)/(car.length*.5))**2;
}
function rawDeck(car,z,u,lift=0) {
  const a=Math.abs(u),p=shellProfile(car,car.stations,z);
  const hood=smooth((-z-.79)/.32)*smooth((z+car.length*.5-.04)/.42);
  const emboss=hood*((car===modelS?.034:.024)*Math.exp(-(((a-.737)/.116)**2))
    -.009*Math.exp(-((a/.42)**4)));
  if(a<=.81)return deckPoint(car,car.stations,z,u,lift+emboss);
  const angle=(a-.81)/.19*Math.PI*.5,w=Math.sin(angle);
  const inner=deckPoint(car,car.stations,z,.81)[1];
  const x=.992*p.width*(.81+.19*w);
  const y=mix(inner,p.shoulderY,w)-shoulderRadius(car,z)*(1-Math.cos(angle))+lift+emboss*(1-w);
  return [Math.sign(u)*x,y,z];
}
function deck(car,z,u,lift=0) {
  const p=rawDeck(car,z,u,lift);
  return endSculpt(car,...p);
}
function sculptedShell(ctx,car) {
  const {m,detailed}=ctx,st=car.stations,half=car.length/2,extra=detailed?52:27;
  const surfaces=[];
  const cuts=new Set(st.map(p=>p[0]));
  for(let i=0;i<=extra;i++) cuts.add(mix(-half,half,i/extra));
  for(const axle of [car.axleMid-car.wheelbase/2,car.axleMid+car.wheelbase/2]) {
    const r=car.wheelRadius+.04,n=detailed?28:14;
    for(let j=0;j<=n;j++)cuts.add(axle+r*Math.cos(j*Math.PI/n));
    for(const side of [-1,1])cuts.add(axle+side*(r+.004));
  }
  const zs=[...cuts].sort((a,b)=>a-b).filter((z,i,list)=>!i||z-list[i-1]>.0001),n=zs.length-1;
  const zAt=t=>zs[Math.round(t*n)];
  const deckCuts=detailed?[-1,-.975,-.944,-.901,-.851,-.81,-.74,-.675,-.61,-.55,-.49,-.41,-.32,-.20,-.10,0,.10,.20,.32,.41,.49,.55,.61,.675,.74,.81,.851,.901,.944,.975,1]:
    [-1,-.950,-.875,-.81,-.51,0,.51,.81,.875,.950,1];
  surfaces.push(patch(ctx,m.paint,n,deckCuts.length-1,[0,1,0],(u,v)=>deck(car,zAt(u),deckCuts[Math.round(v*(deckCuts.length-1))])));
  const sideRows=detailed?17:8;
  for(const s of [-1,1]){
    surfaces.push(patch(ctx,m.paint,n,sideRows,[s,0,0],(u,v)=>{
      const z=zAt(u), p=shellProfile(car,st,z);
      return flank(car,z,mix(p.archY,p.shoulderY-shoulderRadius(car,z),v),s);
    }));
    patch(ctx,m.black,n,1,[0,-1,0],(u,v)=>{
      const z=zAt(u),p=shellProfile(car,st,z),rim=flank(car,z,p.archY,s);
      return [mix(rim[0],s*p.width*.67,v),rim[1]-.018*v,rim[2]];
    });
  }
  for(const sign of [-1,1]){
    const z=sign*half,p=shellProfile(car,st,z);
    const capCuts=deckCuts;
    surfaces.push(patch(ctx,m.paint,capCuts.length-1,sideRows,[0,0,sign],(u,v)=>{
      const x=capCuts[Math.round(u*(capCuts.length-1))],top=rawDeck(car,z,x),y=mix(p.lowerY,top[1],v);
      const halfWidth=v===1?.992*p.width:Math.abs(flank(car,z,Math.min(y,p.shoulderY-shoulderRadius(car,z)),1)[0]);
      const capX=x*halfWidth+(top[0]-x*.992*p.width)*v;
      return endSculpt(car,capX,y,z);
    }));
  }
  // Each patch uses its own useful UV subdivision. Average the normals where
  // the actual stampings meet so the corner reflects a continuous highlight.
  const borders=new Map();
  for(const mesh of surfaces){
    const {position,normal}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const key=Math.round(x*600)+','+Math.round(y*600)+','+Math.round(z*600);
      if(!borders.has(key))borders.set(key,[]);
      borders.get(key).push([normal,i]);
    }
  }
  for(const list of borders.values())if(list.length>1){
    const sum=new ctx.T.Vector3(),v=new ctx.T.Vector3();
    for(const [n,i] of list)sum.add(v.fromBufferAttribute(n,i));
    sum.normalize();
    for(const [n,i] of list)n.setXYZ(i,sum.x,sum.y,sum.z);
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
    // Bow the cowl and backlight flanges in plan, with larger corner radii
    // than at the nearly straight roof headers.
    const inside=Math.max(0,1-(Math.abs(u)/.97)**2);
    z+=inside*(-.089*Math.exp(-(((z-start)/.62)**2))+.063*Math.exp(-(((z-end)/.55)**2)));
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

// Project each end face into spatial bins. An optical detail finds the exact
// triangle beneath it without ray-testing the entire chassis for every sample.
const faceCaches=new WeakMap();
function bumper(ctx,car,shells,end) {
  if(!faceCaches.has(car))faceCaches.set(car,new Map());
  const views=faceCaches.get(car),key=(ctx.detailed?'n':'f')+end;
  if(views.has(key))return views.get(key);
  const bins=new Map(),cell=.061,W=car.width*.5,reach=car.length*.5;
  const hash=(x,y)=>x+y*32;
  for(const mesh of shells){
    const {geometry}=mesh,p=geometry.attributes.position,indices=geometry.index.array;
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i],b=indices[i+1],c=indices[i+2];
      const x=p.getX(a),y=p.getY(a),z=p.getZ(a);
      const bx=p.getX(b)-x,by=p.getY(b)-y,bz=p.getZ(b)-z;
      const cx=p.getX(c)-x,cy=p.getY(c)-y,cz=p.getZ(c)-z;
      const right=x+Math.max(0,bx,cx),det=bx*cy-by*cx;
      if(right<0||Math.max(z*end,(z+bz)*end,(z+cz)*end)<reach*.59||Math.abs(det)<1e-10)continue;
      const tri=[x,y,z,bx,by,bz,cx,cy,cz,1/det];
      const x0=Math.max(0,Math.floor((x+Math.min(0,bx,cx))/cell)),x1=Math.floor(right/cell);
      const y0=Math.floor((y+Math.min(0,by,cy))/cell),y1=Math.floor((y+Math.max(0,by,cy))/cell);
      for(let ix=x0;ix<=x1;ix++)for(let iy=y0;iy<=y1;iy++){
        const id=hash(ix,iy);
        if(!bins.has(id))bins.set(id,[]);
        bins.get(id).push(tri);
      }
    }
  }
  const project=(x,y,lift=.004)=>{
    const ax=Math.abs(x),cellKey=hash(Math.floor(ax/cell),Math.floor(y/cell));
    let best=-Infinity;
    for(const [tx,ty,tz,bx,by,bz,cx,cy,cz,inv] of bins.get(cellKey)??[]){
      const dx=ax-tx,dy=y-ty,u=(dx*cy-dy*cx)*inv,v=(bx*dy-by*dx)*inv;
      if(u>=-.00001&&v>=-.00001&&u+v<=1.00001)best=Math.max(best,end*(tz+u*bz+v*cz));
    }
    const depth=Number.isFinite(best)?best:reach-.17*(ax/W)**4;
    return [x,y,end*(depth+lift)];
  };
  views.set(key,project);
  return project;
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
  if(S){
    // The bonnet leading edge has a thin shadow slot behind the bright T.
    patch(ctx,m.lampHousing,detailed?24:12,2,end,(u,v)=>{
      const t=2*u-1,k=Math.abs(t);
      const top=.582+.020*k*k;
      return face(t*.464,mix(top-(.011*(1-k)**.73+.0015),top,v),.006);
    });
  }
  if(detailed) for(let j=1;j<=(S?3:2);j++){
    line(ctx,m.trim,samples(-.95,.95,18,a=>face(a*width*.955,mix(lower(Math.abs(a)),upper(Math.abs(a)),j/(S?4:3)),.015)),.004,false);
  }
  for(const s of [-1,1]){
    if(S) {
      const pts=[[.645,.347],[.788,.401],[.889,.406],[.880,.356],[.785,.348],[.653,.340]];
      const top=pts.slice(0,3),bottom=pts.slice(3).reverse();
      patch(ctx,m.black,8,2,end,(u,v)=>{
        const i=Math.min(1,Math.floor(u*2)),f=u*2-i;
        const x=mix(mix(top[i][0],top[i+1][0],f),mix(bottom[i][0],bottom[i+1][0],f),v);
        const y=mix(mix(top[i][1],top[i+1][1],f),mix(bottom[i][1],bottom[i+1][1],f),v);
        return face(s*x,y,.008);
      });
    }
  }
}

// Coordinates across each unit are tip → outboard fender and bottom → brow.
// Look up the painted surface once, then build optical parts in millimetres along
// its actual normal. A guide on the fender consequently faces out as it wraps.
function opticField(ctx,face,side,end,outline) {
  const cols=ctx.detailed?22:12,rows=ctx.detailed?5:3;
  const field=[];
  for(let c=0;c<=cols;c++){
    const u=c/cols,x=mix(outline[0][0],outline.at(-1)[0],u);
    const lo=interpolate(outline,x,1),hi=interpolate(outline,x,2);
    const column=[];
    for(let k=0;k<=rows;k++)column.push(face(side*x,mix(lo,hi,k/rows),0));
    field.push(column);
  }
  const at=(u,v)=>{
    const x=Math.max(0,Math.min(1,u))*cols,y=Math.max(0,Math.min(1,v))*rows;
    const c=Math.min(cols-1,Math.floor(x)),k=Math.min(rows-1,Math.floor(y)),a=x-c,b=y-k;
    return field[c][k].map((n,i)=>mix(mix(n,field[c+1][k][i],a),mix(field[c][k+1][i],field[c+1][k+1][i],a),b));
  };
  return (u,v,depth)=>{
    const p=at(u,v);
    if(!depth)return p;
    const left=at(u-.018,v),right=at(u+.018,v),low=at(u,v-.06),high=at(u,v+.06);
    const dx=right.map((x,i)=>x-left[i]),dy=high.map((x,i)=>x-low[i]);
    const nx=dx[1]*dy[2]-dx[2]*dy[1],ny=dx[2]*dy[0]-dx[0]*dy[2],nz=dx[0]*dy[1]-dx[1]*dy[0];
    const f=depth*Math.sign(nz*end)/(Math.hypot(nx,ny,nz)||1);
    return [p[0]+nx*f,p[1]+ny*f,p[2]+nz*f];
  };
}

// A strip has a flat spreading face, as in an injection-moulded light pipe.
// Its outline can double back around the corner without adding an ellipse at
// each bend as a tubular line would do.
function guide(ctx,material,point,keys,depth,radius,end) {
  const center=new ctx.T.CatmullRomCurve3(keys.map(([u,v])=>new ctx.T.Vector3(u,v,0)),false,'centripetal');
  const verts=[],indices=[],count=ctx.detailed?Math.max(12,keys.length*3):Math.max(8,keys.length*2);
  const v0=new ctx.T.Vector3(),v1=new ctx.T.Vector3(),n=new ctx.T.Vector3(),tangent=new ctx.T.Vector3(),across=new ctx.T.Vector3();
  for(let i=0;i<=count;i++){
    const t=i/count,uv=center.getPoint(t),u=uv.x,v=uv.y;
    const before=center.getPoint(Math.max(0,t-.006)),after=center.getPoint(Math.min(1,t+.006));
    const p=v0.fromArray(point(u,v,depth));
    tangent.fromArray(point(after.x,after.y,depth)).sub(v1.fromArray(point(before.x,before.y,depth))).normalize();
    n.fromArray(point(u,v,depth+.002)).sub(p).normalize();
    across.crossVectors(n,tangent).normalize().multiplyScalar(radius*(.45+.55*Math.min(1,12*t,12*(1-t))));
    verts.push(p.clone().sub(across).toArray(),p.clone().add(across).toArray());
    if(i) {const k=i*2;indices.push(k-2,k,k-1,k-1,k,k+1);}
  }
  return surface(ctx,material,verts,indices);
}

function lampCover(ctx,m,point,end,rear=false) {
  const normal=[0,.15,end];
  // Black bezel, reflector cavity and convex transparent polycarbonate cover.
  patch(ctx,m.lampHousing,ctx.detailed?22:12,ctx.detailed?4:2,normal,(u,v)=>point(u,v,.004));
  if(!ctx.detailed)return;
  for(const flip of [false,true]){
    patch(ctx,m.trim,18,1,normal,(u,v)=>point(mix(.025,.978,u),flip?1-.055*v:.055*v,.007-v*.002));
  }
  patch(ctx,rear?m.rearLens:m.opticLens,22,6,normal,(u,v)=>{
    const dome=Math.sin(Math.PI*u)**.55*Math.sin(Math.PI*v)**.62;
    return point(mix(.011,.986,u),mix(.066,.935,v),.009+(rear?.021:.030)*dome);
  });
}

function projector(ctx,at,end,center,ru,rv) {
  const {m}=ctx,[cu,cv]=center,segments=16;
  // A turned reflector cup surrounds the recessed convex objective. The
  // shutter shades the top of the lens, like the cutoff shield in a real unit.
  function annulus(mat,inner,outer,z0,z1) {
    const pts=[],idx=[];
    for(let i=0;i<=segments;i++){
      const a=i/segments*2*Math.PI,ux=Math.cos(a)*ru,vy=Math.sin(a)*rv;
      pts.push(at(cu+ux*inner,cv+vy*inner,z0),at(cu+ux*outer,cv+vy*outer,z1));
      if(i){const k=i*2;idx.push(k-2,k-1,k,k,k-1,k+1);}
    }
    const p=pts[0],q=pts[1],r=pts[2];
    const nz=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    if(nz*end<0)for(let i=0;i<idx.length;i+=3)[idx[i],idx[i+1]]=[idx[i+1],idx[i]];
    surface(ctx,mat,pts,idx);
  }
  annulus(m.trim,.75,1,.009,.015);
  annulus(m.reflector,.605,.772,.008,.016);
  annulus(m.lampHousing,.52,.605,.012,.011);
  annulus(m.projector,.055,.52,.023,.014);
  annulus(m.projector,.0001,.055,.0231,.023);
}

const headOutlineS=[
  [.475,.582,.594],[.533,.583,.623],[.614,.591,.658],[.697,.606,.684],
  [.775,.631,.706],[.835,.652,.721],[.885,.682,.739],[.919,.723,.744],
];
const headOutline3=[
  [.443,.589,.594],[.519,.590,.616],[.598,.595,.636],[.681,.607,.655],
  [.748,.623,.673],[.794,.647,.687],[.828,.668,.699],[.855,.692,.700],
];
const tailOutlineS=[
  [.334,.783,.839],[.443,.775,.856],[.565,.773,.870],[.685,.770,.880],
  [.791,.770,.888],[.875,.773,.887],[.927,.791,.871],[.950,.828,.859],
];
const tailOutline3=[
  [.391,.827,.841],[.481,.820,.854],[.565,.819,.871],[.637,.813,.882],
  [.654,.758,.885],[.696,.742,.888],[.774,.737,.888],[.816,.750,.882],
  [.855,.781,.865],[.875,.834,.856],
];

function headlamps(ctx,car,face,S){
  const {m,detailed}=ctx,glows=[];
  for(const s of [-1,1]){
    const at=opticField(ctx,face,s,-1,S?headOutlineS:headOutline3);
    lampCover(ctx,m,at,-1);
    if(detailed){
      if(S){
        projector(ctx,at,-1,[.400,.43],.077,.265);
        projector(ctx,at,-1,[.605,.43],.071,.261);
        for(let i=0;i<3;i++){
          const u=.702+i*.038;
          patch(ctx,m.reflector,2,2,[0,0,-1],(x,y)=>at(u+.026*x,.37+.25*y,.009+.004*x));
        }
      }else{
        projector(ctx,at,-1,[.502,.40],.076,.267);
        projector(ctx,at,-1,[.698,.405],.069,.250);
      }
    }
    const led=S?[[.020,.75],[.22,.851],[.54,.869],[.78,.889],[.952,.84],[.935,.51],[.822,.255],[.61,.192]]:
      [[.021,.29],[.27,.247],[.53,.221],[.741,.249],[.835,.338],[.910,.555],[.965,.817]];
    guide(ctx,m.front,at,led,.016,S?.0092:.0085,-1);
    if(detailed&&S)guide(ctx,m.amber,at,[[.84,.37],[.905,.41],[.958,.55]],.012,.0043,-1);
    glows.push(at(S?.41:.50,.45,.043));
  }
  return glows;
}

function tailLamps(ctx,car,face,S){
  const {m,detailed}=ctx,signals=[];
  for(const s of [-1,1]){
    const at=opticField(ctx,face,s,1,S?tailOutlineS:tailOutline3);
    lampCover(ctx,m,at,1,true);
    const shape=S?[[.048,.264],[.057,.62],[.103,.773],[.30,.794],[.565,.809],[.697,.772],[.743,.601],[.75,.303],[.67,.284],[.416,.278],[.19,.281]]:
      [[.019,.79],[.26,.800],[.55,.835],[.785,.840],[.94,.79],[.95,.57],[.879,.33],[.76,.202],[.643,.199],[.56,.245]];
    guide(ctx,m.rear,at,shape,.016,S?.0097:.0124,1);
    if(detailed){
      for(let i=0;i<(S?7:5);i++){
        const u=(S?.194:.60)+i*(S?.059:.050);
        patch(ctx,m.trim,2,2,[0,0,1],(x,y)=>at(u+.024*x,.36+.28*y,.011+.003*x));
      }
      if(S)guide(ctx,m.rear,at,[[.804,.46],[.871,.46],[.951,.49]],.015,.0046,1);
      guide(ctx,m.reflector,at,S?[[.37,.50],[.453,.51],[.517,.51]]:[[.575,.57],[.649,.56],[.719,.55]],.0125,.0032,1);
    }
    signals.push(at(S?.76:.80,.55,.034));
  }
  if(S){
    patch(ctx,m.trim,18,2,[0,0,1],(u,v)=>{
      const x=mix(-.373,.373,u),bow=.018*(x/.373)**2;
      return face(x,mix(.792,.819,v)+bow,.012);
    });
  }
  return signals;
}
function trunkDetails(ctx,face,S) {
  const {m}=ctx;
  patch(ctx,m.trim,22,4,[0,0,1],(u,v)=>{
    const a=2*u-1,x=a*mix(.68,.79,v),side=Math.abs(a);
    return face(x,mix(.281+.018*side,.353+.084*side**3,v),.010);
  });
  patch(ctx,m.black,20,3,[0,0,1],(u,v)=>{
    const a=2*u-1,k=Math.abs(a),x=a*(.574+.097*v);
    return face(x,mix(.281+.018*k,.314+.021*k*k,v),.014);
  });
  for(const s of [-1,1]){
    const path=[[.691,.887],[.715,.853],[.707,.785],[.684,.685],[.643,.573],
      [.610,.537],[.516,.523],[.272,.511],[0,.510]];
    const seam=new ctx.T.CatmullRomCurve3(path.map(([x,y])=>new ctx.T.Vector3(x*(S?1:.925),y,0)));
    line(ctx,m.trim,samples(0,1,35,t=>{const p=seam.getPoint(t);return face(s*p.x,p.y,.005);}),.0037);
    patch(ctx,m.rearLens,10,2,[0,0,1],(u,v)=>{
      const x=s*mix(S?.62:.63,S?.836:.794,u),y=.341+.035*u;
      return face(x,y+v*(.002+.012*Math.sin(Math.PI*u)**.51),.011);
    });
  }
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
      // Flush inset handles are tapered pressed paddles with a deeper leading end.
      const handle=(u,v,depth=0)=>{
        const thickness=(S?.017:.020)*Math.min(1,.16+u*9,.13+(1-u)*13);
        return point(z+(S?.157:.152)*u+.011*v,y+.010*u+thickness*(2*v-1),depth);
      };
      patch(ctx,m.black,10,2,[s,0,0],(u,v)=>handle(u,v,.0042));
      patch(ctx,m.trim,10,2,[s,0,0],(u,v)=>handle(.035+.926*u,.16+.67*v,.0062));
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
    patch(ctx,m.projector,5,2,[s,0,0],(u,v)=>point(camZ+.081+.016*u,cy-.005+v*.011,.008));
  }
}

function numberPlate(ctx,face,S){
  const {m}=ctx,y0=S?.641:.634;
  // The regulatory plate and its retainer are flat parts mounted on bosses.
  // Projecting the plate onto the concave liftgate would bend its lettering.
  const z=Math.max(face(-.22,y0)[2],face(0,y0)[2],face(.22,y0)[2])+.015;
  const layer=(mat,x0,x1,yMin,yMax,depth)=>{
    patch(ctx,mat,1,1,[0,0,1],(u,v)=>[mix(x0,x1,u),mix(yMin,yMax,v),z+depth]);
  };
  layer(m.black,-.219,.219,y0-.061,y0+.061,0);
  layer(m.badge,-.202,.202,y0-.049,y0+.049,.003);
  const glyphs={
    A:[[-1,-1,0,1],[0,1,1,-1],[-.59,-.16,.56,-.16]],
    C:[[.91,1,-.89,1],[-.89,1,-.89,-1],[-.89,-1,.94,-1]],
    E:[[1,1,-1,1],[-1,1,-1,-1],[-1,-1,1,-1],[-1,.01,.70,.01]],
    F:[[-1,-1,-1,1],[-1,1,1,1],[-1,.06,.71,.06]],
    L:[[-1,1,-1,-1],[-1,-1,1,-1]],
    3:[[-1,1,1,1],[1,1,1,-1],[1,-1,-1,-1],[1,0,-.48,0]],
    4:[[-.62,1,-1,-.15],[-1,-.15,1,-.15],[.58,1,.58,-1]],
    7:[[-1,1,1,1],[1,1,-.31,-1]],
    8:[[-1,-1,-1,1],[-1,1,1,1],[1,1,1,-1],[1,-1,-1,-1],[-1,0,1,0]],
  };
  const text=S?'7FCA38':'4LEA87',vertices=[],indices=[];
  [...text].forEach((char,i)=>{
    const origin=(i-2.5)*.049;
    for(const [a,b,c,d] of glyphs[char]){
      const x0=origin+.014*a,x1=origin+.014*c,lo=y0+b*.026,hi=y0+d*.026;
      const den=Math.hypot(hi-lo,x1-x0),dx=(hi-lo)*.0022/den,dy=(x0-x1)*.0022/den,k=vertices.length;
      vertices.push([x0+dx,lo+dy,z+.004],[x1+dx,hi+dy,z+.004],[x0-dx,lo-dy,z+.004],[x1-dx,hi-dy,z+.004]);
      indices.push(k,k+1,k+2,k+1,k+3,k+2);
    }
  });
  surface(ctx,m.trim,vertices,indices);
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
    const p=profile.at(-1),vertices=[[mx,my,mz+p[0]+.004]],indices=[],segments=detailed?18:10;
    for(let i=0;i<segments;i++){
      const a=2*Math.PI*i/segments;
      vertices.push([mx+Math.cos(a)*p[1],my+Math.sin(a)*p[2],mz+p[0]+.002]);
      indices.push(0,1+i,1+(i+1)%segments);
    }
    surface(ctx,m.metal,vertices,indices);
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
    // The folded fender seam ends at the outboard corner of the lamp.
    for(const s of [-1,1]) {
      const z0=S?-1.915:-1.844,tip=front(s*(S?.916:.850),S?.739:.696,.003);
      const edge=samples(0,1,18,t=>deck(car,mix(z0,-.978,t),s*mix(.953,.822,t),.003));
      edge[0]=tip;
      line(ctx,m.trim,edge,.0028,false);
    }
    if(!S)line(ctx,m.trim,samples(-.446,.446,18,x=>front(x,.587+.003*(x/.446)**2,.003)),.0021);
    numberPlate(ctx,rear,S);
    line(ctx,m.trim,samples(-.64,.64,23,x=>rear(x,.313+.058*(x/.64)**2,.01)),.015,false);
    const badgeZ=S?-2.24:-2.154;
    const emblem=S?(x,z)=>front(x,.587-(z-badgeZ)*.74,.013):(x,z)=>deck(car,z,x,.009);
    line(ctx,m.badge,[emblem(-.049,badgeZ-.011),emblem(0,badgeZ-.019),emblem(.049,badgeZ-.011)],.0055,false);
    line(ctx,m.badge,[emblem(0,badgeZ-.012),emblem(0,badgeZ+.045)],.0055,false);
  }
  return {headlights,rearSignals};
}
modelS.build=ctx=>buildSedan(ctx,modelS);
model3.build=ctx=>buildSedan(ctx,model3);
export const sedans={modelS,model3};
