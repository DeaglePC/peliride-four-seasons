import {bodyShell, box, deckPoint, line, panel, shellProfile, sidePoint, surface} from './tesla-tools.js';

// Original meshes. Dimensions and silhouette studies use the Tesla Model X
// and 2025+ Model Y owner's manuals, and Tesla's Introducing New Model Y photos.
// The coordinate origin is at ground level. The nose points toward -Z.
const modelX={
  name:'Model X',width:1.999,length:5.057,height:1.680,wheelbase:2.965,axleMid:-.058,
  track:1.705,wheelRadius:.367,spokes:10,
  paints:[0xe6e8e6,0x384d68,0x8e343b,0x656b70,0x282d32]
};
const modelY={
  name:'Model Y',width:1.920,length:4.790,height:1.624,wheelbase:2.890,axleMid:-.061,
  track:1.636,wheelRadius:.358,spokes:7,
  paints:[0xa7afb2,0xe7e7e2,0x547090,0x993a43,0x373d43]
};

// z, half breadth, shoulder, centre of deck, lowest body edge. The lower
// body swells over both axles and contracts at the front and rear corners.
const xBody=[
  [-2.5285,.570,.621,.711,.283],[-2.488,.720,.655,.744,.251],
  [-2.390,.856,.696,.765,.235],[-2.230,.935,.752,.792,.225],
  [-1.980,.973,.812,.842,.221],[-1.660,.997,.866,.901,.218],
  [-1.340,.985,.903,.966,.219],[-1.080,.969,.951,1.003,.221],
  [-.650,.958,.964,1.010,.220],[-.040,.957,.982,1.027,.222],
  [.590,.967,1.019,1.055,.223],[1.150,.993,1.057,1.089,.228],
  [1.485,.9995,1.087,1.120,.230],[1.810,.986,1.101,1.150,.233],
  [2.070,.956,1.104,1.185,.235],[2.290,.921,1.059,1.176,.246],
  [2.451,.835,.993,1.089,.264],[2.5285,.700,.891,1.002,.302]
];
const yBody=[
  [-2.395,.603,.645,.749,.235],[-2.365,.733,.664,.766,.212],
  [-2.287,.841,.683,.780,.201],[-2.143,.910,.728,.798,.198],
  [-1.942,.946,.775,.817,.197],[-1.664,.960,.823,.868,.198],
  [-1.388,.949,.879,.947,.198],[-1.088,.925,.945,.991,.199],
  [-.615,.921,.961,1.003,.201],[-.080,.923,.981,1.022,.202],
  [.485,.931,1.014,1.056,.204],[1.016,.950,1.042,1.089,.208],
  [1.387,.960,1.072,1.113,.213],[1.715,.953,1.087,1.144,.215],
  [1.954,.933,1.084,1.167,.221],[2.198,.891,1.058,1.133,.225],
  [2.325,.809,.984,1.072,.239],[2.395,.688,.867,.979,.265]
];

// Glasshouse section through the actual door opening. Columns after z are
// sill half-width and height, roof-rail half-width and height, crown height,
// and sweep of the glass edge relative to its longitudinal centreline.
const xCanopy=[
  [-1.294,.860,.973,.837,.989,1.031,.112],[-1.070,.887,.988,.817,1.132,1.176,.086],
  [-.750,.901,1.002,.790,1.316,1.377,.053],[-.420,.902,1.010,.765,1.482,1.543,.023],
  [-.095,.901,1.019,.751,1.581,1.642,.005],[.220,.898,1.032,.748,1.620,1.676,0],
  [.478,.896,1.045,.747,1.623,1.680,0],[.790,.892,1.069,.750,1.595,1.650,-.009],
  [1.091,.892,1.106,.752,1.543,1.597,-.021],[1.356,.887,1.143,.755,1.482,1.533,-.039],
  [1.602,.868,1.189,.761,1.412,1.460,-.055],[1.836,.849,1.213,.769,1.337,1.385,-.075],
  [2.052,.817,1.202,.776,1.263,1.306,-.075],[2.205,.798,1.180,.774,1.190,1.228,-.044]
];
const yCanopy=[
  [-1.248,.834,.947,.810,.979,1.013,.126],[-1.035,.855,.964,.793,1.105,1.161,.095],
  [-.753,.868,.980,.765,1.278,1.338,.060],[-.446,.871,.993,.741,1.444,1.506,.035],
  [-.160,.869,1.002,.725,1.535,1.591,.012],[.140,.868,1.017,.720,1.568,1.621,.001],
  [.370,.868,1.034,.721,1.570,1.624,0],[.643,.869,1.059,.728,1.548,1.598,-.012],
  [.902,.870,1.082,.733,1.507,1.558,-.025],[1.163,.869,1.109,.739,1.449,1.499,-.043],
  [1.402,.859,1.148,.744,1.391,1.435,-.064],[1.637,.847,1.191,.752,1.331,1.376,-.072],
  [1.809,.828,1.192,.762,1.274,1.319,-.073],[2.014,.799,1.177,.764,1.197,1.237,-.045]
];

function sample(rows,z) {
  let i=0;
  while(i<rows.length-2 && z>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],p=rows[Math.max(0,i-1)],q=rows[Math.min(rows.length-1,i+2)];
  const d=b[0]-a[0],t=Math.max(0,Math.min(1,(z-a[0])/d)),tt=t*t,ttt=tt*t;
  return a.slice(1).map((v,j)=>{
    const k=j+1, slope=(b[k]-v)/d;
    const incoming=(b[k]-p[k])/(b[0]-p[0]),outgoing=(q[k]-v)/(q[0]-a[0]);
    const limited=s=>s*slope>0 ? Math.sign(s)*Math.min(Math.abs(s),Math.abs(2*slope)) : 0;
    return (2*ttt-3*tt+1)*v+(ttt-2*tt+t)*d*limited(incoming)+(-2*ttt+3*tt)*b[k]+(ttt-tt)*d*limited(outgoing);
  });
}
function roof(rows,z,u,lift=0) {
  const [, ,eave,eaveY,peak,edgeZ]=sample(rows,z);
  const w=Math.abs(u),drop=w*w*(.56+.44*w*w);
  return [eave*u,peak+(eaveY-peak)*drop+lift,z+edgeZ*w*w];
}
function sideGlass(rows,z,t,sign,lift=0) {
  const [sill,sillY,eave,eaveY,,edgeZ]=sample(rows,z);
  return [sign*(sill+(eave-sill)*t+.013*Math.sin(Math.PI*t)+lift),sillY+(eaveY-sillY)*t,z+edgeZ];
}
function meshGrid(ctx,material,nx,ny,point,out) {
  const pts=[],indices=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)pts.push(point(i/nx,j/ny));
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    const p=pts[a],u=pts[b],v=pts[c],x=u[0]-p[0],y=u[1]-p[1],z=u[2]-p[2],xx=v[0]-p[0],yy=v[1]-p[1],zz=v[2]-p[2];
    const dot=(y*zz-z*yy)*out[0]+(z*xx-x*zz)*out[1]+(x*yy-y*xx)*out[2];
    if(dot>=0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
  }
  return surface(ctx,material,pts,indices);
}
function trace(ctx,material,start,end,steps,point,radius) {
  const pts=Array.from({length:steps+1},(_,i)=>point(start+(end-start)*i/steps));
  line(ctx,material,pts,radius,false);
}
function face(ctx,material,points,axis) {
  const p=points[0],a=points[1].map((q,i)=>q-p[i]),b=points[2].map((q,i)=>q-p[i]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  return panel(ctx,material,n.reduce((s,x,i)=>s+x*axis[i],0)<0?[...points].reverse():points);
}
function greenhouse(ctx,spec,body,rows,isX) {
  const {m,detailed}=ctx,from=rows[0][0],to=rows.at(-1)[0],n=detailed?26:13;
  const coat=(a,b,material,lo=-1,hi=1,lift=0)=>{
    meshGrid(ctx,material,detailed?10:6,Math.max(2,Math.round(n*(b-a)/(to-from))),
      (u,v)=>roof(rows,a+(b-a)*v,lo+(hi-lo)*u,lift),[0,1,0]);
  };
  const windshieldEnd=isX?.22:-.27,backStart=isX?1.015:1.002;
  coat(from,windshieldEnd,m.glass);coat(windshieldEnd,backStart,m.roofGlass);
  coat(backStart,to,m.privacyGlass);
  for(const sign of [-1,1]){
    // Painted cant rails frame the glass roof and run into the rear quarters.
    const lower=(u,v)=>{
      const z=from+(to-from)*u, sill=sideGlass(rows,z,0,sign);
      const shoulder=shellProfile(spec,body,sill[2]);
      const x=sign*(shoulder.width*.956);
      return [x+(sill[0]-x)*v,shoulder.shoulderY-.019+(sill[1]-shoulder.shoulderY+.019)*v,sill[2]];
    };
    meshGrid(ctx,m.paint,n,2,lower,[sign,.4,0]);
    for(const rear of [false,true]){
      meshGrid(ctx,rear?m.privacyGlass:m.glass,Math.ceil(n*.55),4,(u,v)=>{
        const pillar=isX?.197+.116*v:.14+.11*v;
        const z=rear?pillar+(to-pillar)*u:from+(pillar-from)*u;
        return sideGlass(rows,z,v,sign);
      },[sign,.3,0]);
    }
    const sidePaint=(rangeA,rangeB,startZ,endZ,mat,lift=.005)=>{
      meshGrid(ctx,mat,detailed?9:5,3,(u,v)=>{
        const a=startZ+(endZ-startZ)*v;
        const z=a+rangeA+(rangeB-rangeA)*u;
        return sideGlass(rows,z,v,sign,lift);
      },[sign,.1,0]);
    };
    // Tapered rear sail panel cuts a single, distinct point into the side glass.
    const quarterFoot=isX?1.485:1.338,quarterTip=isX?1.773:1.598;
    meshGrid(ctx,m.paint,6,4,(u,v)=>{
      const tp=quarterFoot+(quarterTip-quarterFoot)*Math.sin(v*Math.PI*.90);
      return sideGlass(rows,tp+(to-tp)*u,v,sign,.006);
    },[sign,.1,0]);
    sidePaint(-.027,.026,isX?.197:.14,isX?.313:.25,m.trim);
    sidePaint(-.017,.017,isX?1.247:1.162,isX?1.091:1.019,m.trim);
    const rail=detailed?.022:.025;
    trace(ctx,m.paint,from,to,n,z=>roof(rows,z,sign,.003),rail);
    trace(ctx,m.trim,from,quarterFoot,n,z=>sideGlass(rows,z,.008,sign,.007),.011);
    if(detailed){
      trace(ctx,m.trim,from,to,n,z=>sideGlass(rows,z,.978,sign,.009),.008);
      trace(ctx,m.trim,0,1,12,t=>sideGlass(rows,quarterFoot+(quarterTip-quarterFoot)*Math.sin(t*Math.PI*.90),t,sign,.009),.010);
    }
    if(isX){
      // The aft doors fold into the roof. Each leaf has a longitudinal hinge
      // and two transverse shut lines reaching the painted cant rail.
      trace(ctx,m.trim,.35,1.04,10,z=>roof(rows,z,.34*sign,.007),.0085);
      if(detailed){
        trace(ctx,m.trim,.34,1,9,u=>roof(rows,.35+.028*(u-.34),u*sign,.009),.008);
        trace(ctx,m.trim,.34,1,9,u=>roof(rows,1.04+.024*(u-.34),u*sign,.009),.008);
      }
    }
  }
  for(const z of [from,windshieldEnd,backStart,to])trace(ctx,m.trim,-1,1,detailed?14:7,u=>roof(rows,z,u,.005),z===from?.013:.009);
  if(detailed){
    const end=from+.13;
    for(const sign of [-1,1])line(ctx,m.black,[roof(rows,end,.10*sign,.017),roof(rows,end-.021,.41*sign,.018),roof(rows,end-.078,.79*sign,.019)],.009);
  }
}

function sideFurniture(ctx,spec,body,isX) {
  const {m,detailed}=ctx;
  for(const sign of [-1,1]){
    const s=(z,y,lift=.008)=>sidePoint(spec,body,z,y,sign,lift);
    for(const direction of [-1,1]){
      const center=spec.axleMid+direction*spec.wheelbase/2,r=spec.wheelRadius+.040;
      const thickness=isX?.024:.033;
      meshGrid(ctx,m.trim,detailed?32:14,2,(u,v)=>{
        const angle=u*Math.PI,radius=r+v*thickness;
        return s(center+radius*Math.cos(angle),spec.wheelRadius+radius*Math.sin(angle),.011);
      },[sign,.12,0]);
      for(const edge of [-1,1])meshGrid(ctx,m.trim,2,2,(u,v)=>{
        const z=center+edge*(r+u*thickness),low=shellProfile(spec,body,z).lowerY;
        return s(z,low+(spec.wheelRadius-low)*v,.009);
      },[sign,0,0]);
    }
    // Front door lower shut, B-pillar descent, aft door curving around the arch.
    const cuts=isX?[
      [[-1.071,.939],[-1.113,.805],[-1.101,.571],[-1.042,.333],[-.981,.281]],
      [[.146,.992],[.126,.843],[.090,.626],[.046,.401],[-.022,.283]],
      [[1.417,1.073],[1.363,.941],[1.309,.816],[1.109,.752],[.966,.598],[.911,.361],[.853,.287]]
    ]:[
      [[-.995,.938],[-1.057,.795],[-1.084,.541],[-1.016,.320],[-.906,.265]],
      [[.129,.979],[.145,.832],[.130,.620],[.083,.426],[.025,.263]],
      [[1.238,1.042],[1.261,.964],[1.266,.857],[1.151,.795],[.998,.694],[.903,.526],[.878,.316],[.794,.267]]
    ];
    if(detailed)for(const path of cuts){
      const spline=new ctx.T.CatmullRomCurve3(path.map(([z,y])=>new ctx.T.Vector3(z,y,0)));
      const points=spline.getPoints((path.length-1)*3).map(p=>s(p.x,p.y,.0035));
      line(ctx,m.trim,points,.0042);
    }
    const handles=isX?[[-.075,.125,.957],[.183,.362,.967]]:[[-.108,.100,.930],[.893,1.075,1.003]];
    for(const [a,b,y] of handles) {
      const pts=[s(a,y+.009,.019),s(b-.015,y+.018,.019),s(b,y+.006,.019),s(b-.019,y-.010,.019),s(a+.009,y-.013,.019)];
      face(ctx,m.trim,pts,[sign,0,0]);
      if(detailed)line(ctx,m.metal,[s(a+.022,y+.011,.021),s(b-.030,y+.015,.021)],.003);
    }
    // Rocker cladding is narrow and swept upward at the rear.
    const z0=(spec.axleMid-spec.wheelbase/2)+spec.wheelRadius+.02;
    const z1=(spec.axleMid+spec.wheelbase/2)-spec.wheelRadius-.02;
    meshGrid(ctx,m.trim,detailed?14:6,2,(u,v)=>{
      const z=z0+(z1-z0)*u,y=.226+v*(.066+.014*u);
      return s(z,y,.009);
    },[sign,0,0]);
    if(detailed){
      const z=isX?-1.133:-1.132;
      face(ctx,m.black,[s(z,.907,.014),s(z+.139,.917,.014),s(z+.058,.850,.014)],[sign,0,0]);
      line(ctx,m.metal,[s(z+.041,.894,.019),s(z+.073,.894,.019)],.008);
    }
    // Split mirror housing. The inboard stalk, painted cap, black lower lip
    // and rear-facing glass form one continuous teardrop in front-quarter view.
    const z=isX?-.80:-.77,y=isX?1.044:1.026,w=spec.width*.5;
    line(ctx,m.trim,[[sign*(w-.116),y+.011,z+.10],[sign*(w+.005),y-.032,z+.062],[sign*(w+.045),y+.020,z]],.027);
    const cx=sign*(w+(isX?.038:.030)),cy=y+.044,cz=z-.032,mirrorWidth=isX?.098:.075;
    const mirror=(u,v)=>{
      const theta=(u*2-1)*Math.PI,phi=(v-.5)*Math.PI;
      const taper=.90+.12*Math.cos(theta);
      return [cx+sign*mirrorWidth*Math.cos(phi)*Math.cos(theta),cy+.066*Math.sin(phi)*taper,cz+.122*Math.cos(phi)*Math.sin(theta)];
    };
    meshGrid(ctx,m.paint,12,3,(u,v)=>mirror(u,.43+.57*v),[0,1,0]);
    meshGrid(ctx,m.trim,12,3,(u,v)=>mirror(u,.43*v),[0,-1,0]);
    const back=[[cx-sign*.073,cy-.025,cz+.096],[cx+sign*.067,cy-.016,cz+.098],[cx+sign*.079,cy+.023,cz+.091],[cx+sign*.032,cy+.041,cz+.088],[cx-sign*.069,cy+.032,cz+.093]];
    face(ctx,m.chrome,back,[0,0,1]);
  }
}

function fascia(ctx,spec,body,front) {
  const dir=front?-1:1,end=front?body[0][0]:body.at(-1)[0];
  // A lens is a thin skin bonded to a compound-curved body. At each vertex
  // locate the first section that encloses x,y; that also follows the wrap
  // onto the fenders when seen from the side.
  function contains(x,y,z){
    const profile=shellProfile(spec,body,z);
    if(y<=profile.shoulderY)return x<=Math.abs(sidePoint(spec,body,z,y,1)[0]);
    const u=x/(profile.width*.992);
    return u<=1 && y<=deckPoint(spec,body,z,u)[1];
  }
  const p=(x,y,lift=.008,extra=0)=>{
    let lo=0,hi=0;const width=Math.abs(x);
    if(!contains(width,y,end)){
      for(hi=.05;hi<1.3&&!contains(width,y,end-dir*hi);hi+=.05)lo=hi;
      for(let i=0;i<8;i++){
        const m=(lo+hi)*.5;
        if(contains(width,y,end-dir*m))hi=m;else lo=m;
      }
    }
    return [x,y+.001,end-dir*hi+dir*lift+extra];
  };
  const band=(mat,a,b,n,high,low,depth=.009,delta=()=>0)=>{
    meshGrid(ctx,mat,n,2,(u,v)=>{
      const x=a+(b-a)*u;
      return p(x,low(x)+(high(x)-low(x))*v,depth,delta(x));
    },[0,0,dir]);
  };
  return {p,band,dir};
}
function emblem(ctx,bodyEnd,y,scale) {
  const {m}=ctx,p=(x,v)=>bodyEnd.p(x*scale,y+v*scale,.024);
  const wing=x=>.26+.23*(1-Math.abs(x));
  meshGrid(ctx,m.badge,12,2,(u,v)=>{
    const x=u*2-1;
    return p(x,wing(x)+v*(.13+.04*(1-Math.abs(x))));
  },[0,.2,bodyEnd.dir]);
  for(const sign of [-1,1]){
    face(ctx,m.badge,[p(0,.39),p(sign*.78,.15),p(sign*.35,.11),p(sign*.16,-.01),p(0,-.66)],[0,0,bodyEnd.dir]);
  }
}
function rearScript(ctx,bodyEnd,baseline,scale) {
  // Five small stamped letters on the applique. Open strokes retain the
  // separated crossbars and unfilled counters of the factory wordmark.
  const letters=[
    [[[-.48,.48],[.48,.48]],[[0,.30],[0,-.50]]],
    [[[-.43,.48],[.43,.48]],[[-.43,0],[.35,0]],[[-.43,-.48],[.43,-.48]]],
    [[[.43,.48],[-.35,.48],[-.43,.34],[-.37,.03],[.33,.02],[.43,-.12],[.36,-.48],[-.42,-.48]]],
    [[[-.36,.48],[-.36,-.48],[.43,-.48]]],
    [[[-.43,-.48],[0,.48],[.43,-.48]],[[-.20,-.12],[.20,-.12]]]
  ];
  for(let j=0;j<letters.length;j++)for(const stroke of letters[j]){
    line(ctx,ctx.m.badge,stroke.map(([x,y])=>bodyEnd.p((j-2)*scale*1.71+x*scale,baseline+y*scale,.042)),scale*.077);
  }
}
// The coordinates inside a lamp progress across its curved outline and from
// the lower to upper seal. Depth is measured outwards from the painted panel.
function lampFace(ctx,fascia,sign,outline) {
  const start=outline[0][0],span=outline.at(-1)[0]-start,normal=[sign*.2,0,fascia.dir];
  const at=(u,v,depth)=>{
    const x=start+span*u,[top,bottom]=sample(outline,x);
    return fascia.p(sign*x,bottom+(top-bottom)*v,depth);
  };
  const strip=(material,u0,u1,bottom,top,depth,n=ctx.detailed?22:10,rows=2)=>{
    meshGrid(ctx,material,n,rows,(i,j)=>{
      const u=u0+(u1-u0)*i,v=bottom(u)+(top(u)-bottom(u))*j;
      return at(u,v,typeof depth==='function'?depth(u,v):depth);
    },normal);
  };
  const full=(material,depth,rows=2)=>strip(material,0,1,()=>0,()=>1,depth,ctx.detailed?24:12,rows);
  return {at,strip,full,normal};
}
function projector(ctx,lamp,u,v,ru,rv) {
  const {m}=ctx;
  // Turned reflector cup, retaining ring and the glass asphere. Small
  // radii leave a shadow gap between neighbouring matrix modules.
  function revolved(mat,profile) {
    for(let j=0;j<profile.length-1;j++){
      const [r0,d0]=profile[j],[r1,d1]=profile[j+1];
      meshGrid(ctx,mat,12,1,(s,t)=>{
        const a=2*Math.PI*s,r=r0+(r1-r0)*t;
        return lamp.at(u+Math.cos(a)*ru*r,v+Math.sin(a)*rv*r,d0+(d1-d0)*t);
      },lamp.normal);
    }
  }
  revolved(m.lampHousing,[[1,.021],[.95,.026]]);
  revolved(m.reflector,[[.95,.026],[.86,.0265]]);
  revolved(m.lampHousing,[[.86,.0265],[.64,.013]]);
  revolved(m.projector,[[.64,.018],[.49,.027],[.25,.031],[0,.032]]);
  // A sliver of the LED beneath the cut-off shield stays visible head-on.
  meshGrid(ctx,m.front,5,1,(s,t)=>lamp.at(u+ru*(s-.5)*.57,
    v+rv*(.10+.10*Math.sin(s*Math.PI)+.15*t),.0327),lamp.normal);
}
function xHeadlights(ctx,front) {
  const {m,detailed}=ctx;
  const outline=[[.335,.710,.705],[.425,.727,.680],[.570,.750,.668],[.701,.765,.681],
    [.801,.785,.700],[.865,.804,.730],[.901,.807,.768],[.926,.811,.804]];
  for(const sign of [-1,1]){
    const l=lampFace(ctx,front,sign,outline);
    l.full(m.lampHousing,.013);
    // Daylight guide turns up at the outer end of the swept headlamp.
    const rise=u=>.55*Math.max(0,(u-.69)/.31)**1.5;
    l.strip(m.reflector,.012,.984,u=>.07+rise(u),u=>.27+rise(u),.022);
    l.strip(m.front,.022,.973,u=>.095+rise(u),u=>.222+rise(u),.030);
    if(detailed){
      l.strip(m.reflector,.13,.73,()=>.73,()=>.77,.019,12);
      projector(ctx,l,.505,.57,.063,.183);
      projector(ctx,l,.681,.61,.046,.135);
      for(let i=0;i<4;i++)l.strip(m.reflector,.18+.045*i,.198+.045*i,()=>.42,()=>.58,.019,2);
      l.full(m.opticLens,(u,v)=>.026+.013*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),4);
    }
    const fog=lampFace(ctx,front,sign,[[.615,.494,.473],[.712,.506,.425],[.789,.530,.420],[.830,.554,.470],[.846,.553,.529]]);
    fog.full(m.lampHousing,.014);
    fog.strip(m.reflector,.15,.92,()=>.23,()=>.30,.022,9);
    if(detailed){
      projector(ctx,fog,.71,.47,.094,.162);
      fog.full(m.opticLens,.035);
      for(const y of [.453,.483])front.band(m.metal,.530*sign,.733*sign,7,x=>y+.021*Math.abs(x),x=>y+.021*Math.abs(x)-.006,.022);
    }
  }
}
function yHeadlights(ctx,front) {
  const {m,detailed}=ctx;
  const bar=x=>.754+.041*Math.pow(Math.abs(x)/.88,2.7);
  front.band(m.lampHousing,-.865,.865,detailed?34:16,x=>bar(x)+.013,x=>bar(x)-.018,.011);
  front.band(m.front,-.563,.563,detailed?22:12,x=>bar(x)+.002,x=>bar(x)-.009,.024);
  for(const sign of [-1,1]){
    const brow=lampFace(ctx,front,sign,[[.569,bar(.569)+.007,bar(.569)-.010],[.657,bar(.657)+.014,bar(.657)-.009],
      [.771,bar(.771)+.022,bar(.771)-.009],[.850,bar(.850)+.027,bar(.850)-.003],[.876,bar(.876)+.028,bar(.876)+.019]]);
    brow.full(m.lampHousing,.019);
    brow.strip(m.front,.027,.939,()=>.18,()=>.79,.027,13);
    if(detailed)brow.full(m.opticLens,(u,v)=>.031+.004*Math.sin(Math.PI*v));
    const l=lampFace(ctx,front,sign,[[.551,.640,.636],[.613,.651,.603],[.685,.659,.589],
      [.767,.669,.592],[.819,.678,.599],[.859,.685,.614],[.875,.686,.666]]);
    l.full(m.black,.012);
    l.strip(m.lampHousing,.034,.971,()=>.12,()=>.87,.018,15);
    if(detailed){
      // The main dipped-beam lens sits outboard. Inboard matrix cells sit
      // deeper in the recess and alternate with black dividing fins.
      projector(ctx,l,.783,.52,.095,.239);
      projector(ctx,l,.526,.53,.060,.163);
      for(const u of [.18,.28,.38]){
        l.strip(m.projector,u,u+.055,()=>.43,()=>.66,.020,3);
        l.strip(m.reflector,u,u+.052,()=>.59,()=>.65,.022,3);
      }
      l.full(m.opticLens,(u,v)=>.026+.015*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),4);
    }else l.strip(m.projector,.64,.85,()=>.30,()=>.71,.025,4);
    const duct=lampFace(ctx,front,sign,[[.633,.389,.383],[.730,.410,.388],[.797,.430,.399],
      [.838,.492,.420],[.862,.608,.475],[.872,.653,.582],[.875,.657,.636]]);
    duct.full(m.trim,.014);
    if(detailed)duct.strip(m.lampHousing,.09,.91,()=>.21,()=>.61,.018,14);
  }
}
function xTailLights(ctx,rear){
  const {m,detailed}=ctx;
  const outline=[[.360,1.000,.955],[.428,1.030,.940],[.593,1.049,.932],[.727,1.064,.933],
    [.827,1.080,.948],[.913,1.087,.986],[.957,1.082,1.042],[.967,1.069,1.066]];
  for(const sign of [-1,1]){
    const l=lampFace(ctx,rear,sign,outline);
    l.full(m.lampHousing,.013);
    // One pipe curls around the reverse-lamp reflector. A second, lower
    // blade terminates at the liftgate parting line.
    const returnAt=u=>Math.min(.55,Math.max(0,(u-.59)*2.1));
    l.strip(m.rear,.023,.965,u=>.66-returnAt(u),u=>.90-returnAt(u),.025);
    l.strip(m.rear,.015,.840,()=>.16,()=>.32,.024);
    if(detailed){
      l.strip(m.reflector,.094,.627,()=>.48,()=>.55,.024,16);
      l.strip(m.projector,.084,.640,()=>.41,()=>.46,.021,12);
      for(let i=0;i<9;i++){
        const u=.12+i*.048;
        l.strip(m.lampHousing,u,u+.008,()=>.48,()=>.55,.028,1);
      }
      l.full(m.rearLens,(u,v)=>.032+.010*Math.sin(Math.PI*v)*Math.sin(Math.PI*u),4);
    }
    l.strip(m.trim,.625,.636,()=>.04,()=>.98,.046,2);
  }
}
// The refresh hides its source above the hatch. Red light falls on a
// rearward-sloping continuous reflector, strongest just below the overhang.
// Shading in vehicle space retains the gradient after mesh batching.
const reflectScreens=new WeakMap();
function yReflectorMaterial(m){
  if(reflectScreens.has(m.rear))return reflectScreens.get(m.rear);
  const material=m.rear.clone();
  material.name='Indirect liftgate reflector';
  material.emissive=m.rear.emissive;
  Object.defineProperty(material,'emissiveIntensity',{get:()=>m.rear.emissiveIntensity});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vReflectPos;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vReflectPos = position.xy;');
    shader.fragmentShader='varying vec2 vReflectPos;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      #include <emissivemap_fragment>
      float widthFraction=clamp(abs(vReflectPos.x)/.840,0.,1.);
      float localAxis=.993+.014*pow(widthFraction,4.);
      float level=clamp((vReflectPos.y-localAxis+.044)/.053,0.,1.);
      float falloff=smoothstep(.03,.92,level)*(.64+.36*(1.-smoothstep(.82,1.,widthFraction)));
      diffuseColor.rgb*=mix(.047,1.12,falloff);
      totalEmissiveRadiance*=mix(.022,1.24,falloff);`);
  };
  reflectScreens.set(m.rear,material);
  return material;
}
function yTailLights(ctx,rear) {
  const {m,detailed}=ctx,n=detailed?34:16;
  const axis=x=>.993+.014*Math.min(1,Math.abs(x)/.840)**4;
  const corners=x=>Math.max(0,(Math.abs(x)-.765)/.125)**2;
  // The black mask continues around the corners. Its lower sill and upper
  // visor are separate surfaces and cast different environment reflections.
  rear.band(m.lampHousing,-.901,.901,n,x=>axis(x)+.072-.035*corners(x),x=>axis(x)-.073+.007*corners(x),.016);
  rear.band(m.roofGlass,-.887,.887,n,x=>axis(x)+.059-.027*corners(x),x=>axis(x)+.017-.011*corners(x),.033);
  const wing=x=>Math.min(1,Math.max(0,(Math.abs(x)-.755)/.082));
  meshGrid(ctx,yReflectorMaterial(m),n,5,(u,v)=>{
    const x=(2*u-1)*.839,y=axis(x)-.046+.024*wing(x)**2+v*(.056-.040*wing(x)**2);
    return rear.p(x,y,.031+.014*(1-v)+.003*Math.sin(Math.PI*v));
  },[0,.2,1]);
  if(detailed){
    rear.band(m.rearLens,-.846,.846,n,x=>axis(x)+.016-.018*wing(x)**2,x=>axis(x)+.009-.017*wing(x)**2,.038);
    for(const sign of [-1,1]){
      // Short edge reflectors follow the turning quarter surface, while the
      // central reflected light itself terminates before the tight corner.
      const edge=lampFace(ctx,rear,sign,[[.841,1.040,.952],[.867,1.047,.951],[.899,1.052,.968],[.921,1.044,1.004],[.926,1.041,1.030]]);
      edge.full(m.lampHousing,.017);
      edge.strip(m.rear,.39,.75,()=>.37,()=>.66,.026,7);
      edge.full(m.rearLens,.038);
      rear.band(m.reflector,.567*sign,.833*sign,12,x=>axis(x)-.062,x=>axis(x)-.068,.031);
    }
  }
}
function lampsAndBumpers(ctx,spec,body,isX) {
  const {m,detailed}=ctx,front=fascia(ctx,spec,body,true),rear=fascia(ctx,spec,body,false);
  const n=detailed?32:16,wb=spec.width/2;
  const lower=(x)=>.256+.039*(x/wb)**2;
  // Central cooling mouth and undertray. The fascia above stays continuous.
  const mouth=isX?.595:.635;
  front.band(m.trim,-mouth,mouth,n,x=>.420-.046*Math.pow(Math.abs(x)/mouth,4),lower,.015);
  front.band(m.black,-mouth+.024,mouth-.024,n,x=>.398-.042*Math.pow(Math.abs(x)/mouth,4),x=>lower(x)+.020,.018);
  front.band(m.trim,-.875,.875,n,x=>.300+.019*Math.abs(x),x=>.253+.018*Math.abs(x),.016);
  meshGrid(ctx,m.black,n,2,(u,v)=>{
    const x=(2*u-1)*.875,p=front.p(x,.254+.018*Math.abs(x),.015);
    p[2]+=.213*v;p[1]+=.041*v;
    return p;
  },[0,-1,-.15]);
  if(detailed){
    for(let i=0;i<3;i++)trace(ctx,m.black,-mouth+.062,mouth-.062,12,x=>front.p(x,.307+i*.028,.022),.006);
  }
  let headlights;
  if(isX){
    // Tesla's chrome badge sits in the small open black upper grille.
    front.band(m.lampHousing,-.347,.347,20,x=>.713+.001*Math.abs(x/.347),x=>.673+.035*(Math.abs(x/.347)**1.2),.016);
    xHeadlights(ctx,front);
    emblem(ctx,front,.695,.046);
    headlights=[front.p(-.633,.726,.035),front.p(.633,.726,.035)];
  }else{
    yHeadlights(ctx,front);
    headlights=[front.p(-.805,.633,.037),front.p(.805,.633,.037)];
  }

  const bumper=x=>(isX?.423:.535)+.081*Math.pow(Math.abs(x)/.83,2);
  rear.band(m.trim,-.820,.820,n,bumper,x=>.251+.052*Math.pow(Math.abs(x)/.82,2),.019);
  rear.band(m.black,-.630,.630,n,x=>.354+.016*Math.abs(x),x=>.281+.012*Math.abs(x),.024);
  for(const sign of [-1,1]){
    rear.band(m.lampHousing,.625*sign,.776*sign,8,x=>.465+.040*Math.abs(x),x=>.447+.040*Math.abs(x),.025);
    rear.band(m.rearLens,.625*sign,.776*sign,8,x=>.465+.040*Math.abs(x),x=>.447+.040*Math.abs(x),.029);
  }
  if(isX){
    xTailLights(ctx,rear);
    rear.band(m.metal,-.393,.393,16,x=>1.007+.009*Math.abs(x/.393),x=>.977+.010*Math.abs(x/.393),.022);
  }else yTailLights(ctx,rear);
  if(detailed){
    const plateY=isX?.780:.422,plateZ=rear.p(0,plateY,.027)[2];
    box(ctx,m.black,[0,plateY,plateZ],[.417,.143,.021],.008);
    box(ctx,m.steel,[0,plateY,plateZ+.012],[.367,.103,.010],.006);
    rearScript(ctx,rear,isX?.993:1.036,isX?.018:.023);
    if(isX)emblem(ctx,rear,1.051,.045);
    for(const sign of [-1,1]){
      const hatch=isX?[[.831,1.052],[.762,.960],[.722,.822],[.675,.649],[.590,.630],[.018,.624]]:[[.755,.929],[.762,.806],[.750,.670],[.728,.584],[.652,.566],[.018,.562]];
      line(ctx,m.trim,hatch.map(([x,y])=>rear.p(x*sign,y,.006)),.0047,true);
    }
  }
  // The liftgate ends in an integrated body-colour aero lip. Its upper face
  // extends over the lamp lenses even when seen from the chase camera.
  const spoilerZ=isX?2.330:2.214;
  meshGrid(ctx,m.paint,detailed?18:8,3,(u,v)=>{
    const x=(u*2-1)*.836,z=spoilerZ-.145*(x/.836)**2+.086*v;
    const sh=shellProfile(spec,body,z);
    return [x,sh.topY+.019+.014*v-.035*(x/.836)**2,z];
  },[0,1,.2]);
  const signalY=isX?1.026:.979;
  return {headlights,rearSignals:[rear.p(-.791,signalY,.024),rear.p(.791,signalY,.024)]};
}

function skinPanels(ctx,spec,body,shell){
  // The shared shell closes each end with a planar fan. A gridded bumper
  // retains its rounded section through the centre when the ends are formed.
  for(const child of [...ctx.group.children]){
    if(child.name==='Nose fascia'||child.name==='Tail fascia'){
      ctx.group.remove(child);child.geometry.dispose();
    }
  }
  const sideV=ctx.detailed?[0,.10,.22,.33,.44,.55,.65,.72,.82,.91,1]:[0,.22,.40,.57,.72,1];
  const deckU=ctx.detailed?[0,.16,.32,.51,.64,.73,.80,.88,.94,.976,1]:[0,.32,.51,.80,.94,1];
  const across=[...deckU.slice(1).reverse().map(u=>-u),...deckU];
  const old=shell.geometry,coords=old.getAttribute('position'),zs=new Set();
  for(let i=0;i<coords.count;i++)zs.add(coords.getZ(i));
  ctx.group.remove(shell);old.dispose();
  const stations=[...zs].sort((a,b)=>a-b),skins=[];
  for(const sign of [-1,1]){
    skins.push(meshGrid(ctx,ctx.m.paint,stations.length-1,sideV.length-1,(u,v)=>{
      const z=stations[Math.round(u*(stations.length-1))],sh=shellProfile(spec,body,z);
      return sidePoint(spec,body,z,sh.archY+sideV[Math.round(v*(sideV.length-1))]*(sh.shoulderY-sh.archY),sign);
    },[sign,0,0]));
  }
  skins.push(meshGrid(ctx,ctx.m.paint,across.length-1,stations.length-1,(u,v)=>
    deckPoint(spec,body,stations[Math.round(v*(stations.length-1))],across[Math.round(u*(across.length-1))]),[0,1,0]));
  for(const end of [-1,1]){
    const z=end<0?body[0][0]:body.at(-1)[0];
    const sh=shellProfile(spec,body,z),normal=[0,0,end],cols=across.length-1;
    skins.push(meshGrid(ctx,ctx.m.paint,cols,sideV.length-1,(u,v)=>{
      const y=sh.lowerY+(sh.shoulderY-sh.lowerY)*sideV[Math.round(v*(sideV.length-1))];
      const widest=sidePoint(spec,body,z,y,1)[0];
      return [across[Math.round(u*cols)]*widest,y,z];
    },normal));
    skins.push(meshGrid(ctx,ctx.m.paint,cols,2,(u,v)=>{
      const p=deckPoint(spec,body,z,across[Math.round(u*cols)]);
      return [p[0],sh.shoulderY+(p[1]-sh.shoulderY)*v,z];
    },normal));
  }
  return skins;
}
function softenSkinSeams(skins){
  // Adjacent bumper, hood and quarter panels share a rolled perimeter.
  // Only coincident edges share their normals; stamped grooves stay crisp.
  const edges=new Map();
  for(const mesh of skins){
    const geo=mesh.geometry,pos=geo.getAttribute('position'),normal=geo.getAttribute('normal');
    for(let i=0;i<pos.count;i++){
      const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*10000)).join(',');
      let edge=edges.get(key);
      if(!edge){edge=[];edges.set(key,edge);}
      edge.push([normal,i]);
    }
  }
  for(const edge of edges.values()){
    if(edge.length<2)continue;
    let x=0,y=0,z=0;
    for(const [n,i] of edge){x+=n.getX(i);y+=n.getY(i);z+=n.getZ(i);}
    const size=Math.hypot(x,y,z)||1;
    for(const [n,i] of edge)n.setXYZ(i,x/size,y/size,z/size);
  }
}
function formPanels(ctx,spec,isX,sockets){
  const sat=t=>Math.min(1,Math.max(0,t));
  const smooth=t=>{const s=sat(t);return s*s*(3-2*s);};
  function shape(p){
    const {x,y,z}=p,ax=Math.abs(x),az=Math.abs(z),endFade=smooth((az-(spec.length/2-.74))/.74);
    if(endFade>0){
      const front=z<0;
      const camber=(front?.152:.124)*Math.pow(ax/(spec.width*.5),2.4);
      const low=sat(((front?.531:.588)-y)/.36);
      const upper=Math.max(0,y-(front?.51:.76));
      const returnDepth=camber+(front?.146:.166)*low**1.65+(front?.34:.29)*upper**1.55;
      p.z-=Math.sign(z)*endFade*returnDepth;
    }
    if(ax>.76&&y>.27&&y<1.02&&z>-1.30&&z<1.24){
      // Flared haunches taper into the oblique lower-door scallop. A soft
      // return below it gives the sill a narrow highlight at grazing angles.
      const across=smooth((ax-.76)/.12),along=smooth((z+1.30)/.38)*smooth((1.24-z)/.40);
      const diagonal=(isX?.43:.40)+(z+1.3)*(isX?.082:.111);
      const scoop=Math.exp(-(((y-diagonal)/.125)**2));
      const lowerRoll=Math.exp(-(((y-diagonal+.133)/.066)**2));
      const fade=smooth((y-.27)/.09)*smooth((1.02-y)/.07);
      p.x+=Math.sign(x)*across*along*fade*((isX?.008:.011)*lowerRoll-(isX?.028:.041)*scoop);
    }
    return p;
  }
  const p=new ctx.T.Vector3(),inv=new ctx.T.Matrix4();
  ctx.group.updateMatrixWorld(true);
  for(const child of ctx.group.children){
    if(!child.isMesh)continue;
    const geo=child.geometry,positions=geo.getAttribute('position');
    let changed=false;inv.copy(child.matrixWorld).invert();
    for(let i=0;i<positions.count;i++){
      p.fromBufferAttribute(positions,i).applyMatrix4(child.matrixWorld);
      const x=p.x,z=p.z;shape(p);
      if(p.x===x&&p.z===z)continue;
      p.applyMatrix4(inv);positions.setXYZ(i,p.x,p.y,p.z);changed=true;
    }
    if(changed){positions.needsUpdate=true;geo.computeVertexNormals();}
  }
  for(const points of [sockets.headlights,sockets.rearSignals]){
    for(const xyz of points)shape(p.fromArray(xyz)).toArray(xyz);
  }
}
function buildCrossover(ctx,spec,body,canopy,isX) {
  const skins=skinPanels(ctx,spec,body,bodyShell(ctx,spec,body));
  greenhouse(ctx,spec,body,canopy,isX);
  sideFurniture(ctx,spec,body,isX);
  if(ctx.detailed){
    const z0=isX?-2.39:-2.34,z1=canopy[0][0]-.022;
    for(const sign of [-1,1]){
      trace(ctx,ctx.m.trim,0,1,14,t=>{
        const z=z0+(z1-z0)*t,u=sign*(.55+.32*t-.035*Math.sin(Math.PI*t));
        return deckPoint(spec,body,z,u,.004);
      },.0048);
    }
  }
  const sockets=lampsAndBumpers(ctx,spec,body,isX);
  formPanels(ctx,spec,isX,sockets);
  softenSkinSeams(skins);
  return sockets;
}
modelX.build=ctx=>buildCrossover(ctx,modelX,xBody,xCanopy,true);
modelY.build=ctx=>buildCrossover(ctx,modelY,yBody,yCanopy,false);
export const crossovers={modelX,modelY};
