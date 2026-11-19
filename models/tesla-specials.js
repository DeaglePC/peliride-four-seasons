// Original game geometry, eye-modelled against Tesla's current exterior photos.
// https://www.tesla.cn/cybertruck and https://www.tesla.cn/roadster
import {bodyShell,box,deckPoint,line,panel,shellProfile,sidePoint,surface} from './tesla-tools.js';

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
  const {m,detailed}=ctx,half=cybertruck.length/2;
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
      facing(ctx,m.glass,[edge(a,lo),edge(b,lo),edge(b,hi),edge(a,hi)],[s,.1,0]);
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
    facing(ctx,m.steel,[cap(-1,a),cap(1,a),cap(1,b),cap(-1,b)],[0,1,-.15]);
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
    facing(ctx,m.steel,[facet(-1,.365),facet(1,.365),facet(1,belt(z)),facet(-1,belt(z))],[0,0,sign]);
    facing(ctx,m.trim,[facet(-1,.515,.016),facet(1,.515,.016),facet(.87,.281,.013),facet(-.87,.281,.013)],[0,0,sign]);
    facing(ctx,m.black,[facet(-.7,.385,.019),facet(.7,.385,.019),facet(.63,.282,.016),facet(-.63,.282,.016)],[0,0,sign]);
  }
  const strip=(mat,z,y,h,w)=>box(ctx,mat,[0,y,z],[w,h,.029],.006);
  strip(m.black,front-.004,.919,.073,1.834);strip(m.front,front-.022,.933,.025,1.803);
  strip(m.black,rear+.006,1.19,.092,1.862);strip(m.rear,rear+.025,1.205,.027,1.82);
  for(const s of [-1,1]){
    const upper=[[s*.84,.496,front-.028],[s*.993,.504,front+.221],[s*1.004,.498,front+.291]],
      lowerBumper=[[s*.793,.298,front-.017],[s*.948,.282,front+.205],[s*.970,.302,front+.292]];
    facing(ctx,m.trim,[[s*.770,.282,front-.020],[s*.919,.364,front-.021],[s*.976,.401,front+.152],
      [s*.970,.302,front+.292],[s*.948,.282,front+.205]],[s,0,-.6]);
    for(let j=1;j<upper.length;j++)facing(ctx,m.trim,[upper[j-1],upper[j],lowerBumper[j],lowerBumper[j-1]],[s,0,-.4]);
    facing(ctx,m.black,[upper[0],upper[1],side(s,front+.231,.476),side(s,front,.468)],[0,1,-.4]);
    box(ctx,m.black,[s*.774,.610,front-.007],[.238,.081,.031],.010);
    box(ctx,m.front,[s*.774,.624,front-.028],[.177,.027,.022],.005);
    line(ctx,m.amber,[[s*.928,.931,front+.016],[s*.976,.948,front+.155]],.011);
    line(ctx,m.rear,[[s*.925,1.200,rear-.004],[s*.97,1.215,rear-.096]],.013);
  }
  if(detailed){
    box(ctx,m.black,[0,.596,rear+.011],[.430,.123,.024],.008);
    box(ctx,m.metal,[0,.597,rear+.026],[.389,.100,.006],.004);
    line(ctx,m.trim,[[-.864,.655,rear+.008],[-.863,1.124,rear+.009],[.863,1.124,rear+.009],[.864,.655,rear+.008]],.0055);
    for(let i=0;i<6;i++)box(ctx,m.black,[.04*(i-2.5),.596,rear+.030],[.015,.037,.006]);
  }
  return {headlights:[[-.774,.624,front-.03],[.774,.624,front-.03]],
    rearSignals:[[-.898,1.206,rear+.026],[.898,1.206,rear+.026]]};
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
  bodyShell(ctx,roadster,rows);
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
    sidePatch(.12,.938,.454,.793,m.glass);sidePatch(.12,.938,.793,1,m.paint);
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
    const wing=[side(s,-2.22,.232,.003),side(s,-1.98,.28,.005),side(s,-1.98,.172,.005),side(s,-2.22,.15,.001)];
    facing(ctx,m.trim,wing,[s,0,0]);
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
      line(ctx,m.black,Array.from({length:10},(_,i)=>{const t=i/9;return deck(mix(-2.29,-1.386,t),s*mix(.915,.826,t),.004);}),.0035,true);
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
  facing(ctx,m.black,[nose(-.713,.459,.004),nose(.713,.459,.004),nose(.662,.178,.004),nose(-.662,.178,.004)],[0,0,-1]);
  box(ctx,m.front,[0,.466,front-.009],[1.398,.019,.026],.006);
  box(ctx,m.black,[0,.152,front-.014],[1.42,.045,.069],.010);
  // A deep diffuser rises behind the rear tires; the thin red blade floats
  // beneath the rear deck, with a crease continuing around each corner.
  const tail=(x,y,extra=.006)=>[x,y,rear+extra];
  for(const s of [-1,1])facing(ctx,m.trim,[tail(s*.908,.680),tail(s*.705,.585),tail(s*.615,.508),
    tail(s*.620,.278),tail(s*.871,.305),tail(s*.902,.396)],[0,0,1]);
  facing(ctx,m.black,[tail(-.710,.585),tail(.710,.585),tail(.620,.280),tail(-.620,.280)],[0,0,1]);
  facing(ctx,m.trim,[tail(-.903,.794),tail(.903,.794),tail(.815,.760),tail(-.815,.760)],[0,0,1]);
  box(ctx,m.black,[0,.821,rear+.003],[1.802,.058,.026],.005);
  box(ctx,m.rear,[0,.830,rear+.024],[1.768,.017,.018],.005);
  for(const s of [-1,1]){
    line(ctx,m.rear,[[s*.875,.830,rear+.022],side(s,2.329,.836,.006),side(s,2.255,.85,.005)],.0095);
    line(ctx,m.front,[[s*.68,.466,front-.015],[s*.731,.487,front+.025]],.009);
  }
  if(detailed){
    for(const x of [-.748,-.50,-.22,.22,.50,.748]){
      const y=.179+.10*Math.abs(x);
      const fin=box(ctx,m.black,[x,y+.080,rear-.104],[.021,.143,.324],.004);
      fin.rotation.x=-.105;
    }
    box(ctx,m.black,[0,.642,rear+.013],[.422,.132,.030],.008);
    box(ctx,m.metal,[0,.643,rear+.031],[.390,.105,.009],.006);
    for(let i=0;i<6;i++)box(ctx,m.black,[(i-2.5)*.040,.642,rear+.038],[.013,.039,.005]);
  }
  return {headlights:[[-.575,.465,front-.025],[.575,.465,front-.025]],
    rearSignals:[[-.867,.830,rear+.025],[.867,.830,rear+.025]]};
}
