import {box, line, surface} from './tesla-tools.js';

// Front and rear edges of the cabin floor, belt height, and front seat position
// in metres. The dark deck conceals the painted body shell through the windows.
const layout={
  modelS:[-.89,1.70,.89,.29], model3:[-.93,1.55,.89,.21],
  modelX:[-1.17,1.91,1.032,.23], modelY:[-1.13,1.76,1.033,.16],
  cybertruck:[-1.77,.87,1.19,-.46], roadster:[-1.29,1.45,.847,.17]
};

export function addCabin(ctx,type,spec){
  const {T,m}=ctx,[front,rear,belt,seatZ]=layout[type],half=spec.width*.385;
  const backLift=type==='cybertruck'?.045:type==='roadster'?.075:.11;
  const rows=[[front,.91,-.014],[front+.27,.98,.005],[seatZ,1,.017],[rear-.28,.96,backLift],[rear,.82,backLift]];
  const floor=[],indices=[];
  for(const [i,[z,scale,lift]] of rows.entries()){
    floor.push([-half*scale,belt+lift,z],[half*scale,belt+lift,z]);
    if(i){const a=2*i-2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  surface(ctx,m.interior,floor,indices);
  for(const side of [-1,1]){
    const x=side*spec.width*.197;
    for(const [z,top] of [[seatZ,spec.height*.914],...(type==='roadster'?[]:[[Math.min(rear-.32,seatZ+.77),spec.height*.84]])]){
      const h=top-belt;
      const back=box(ctx,m.upholstery,[x,belt+h*.27,z],[.40,h*.77,.115],.052);
      back.rotation.x=.14;
      box(ctx,m.upholstery,[x,belt+h*.81,z+.052],[.224,h*.36,.123],.044);
    }
  }
  const dashboardZ=front+(type==='cybertruck'?.67:.33);
  box(ctx,m.interior,[0,belt+.028,dashboardZ],[half*1.85,.085,.22],.036);
  const wheelY=belt+.097;
  const rim=new T.Mesh(new T.TorusGeometry(.132,.016,6,22),m.black);
  rim.rotation.x=-.28;rim.position.set(-spec.width*.197,wheelY,dashboardZ+.18);ctx.group.add(rim);
  line(ctx,m.trim,[[rim.position.x-.116,wheelY+.018,rim.position.z],[rim.position.x,wheelY-.03,rim.position.z],[rim.position.x+.116,wheelY+.018,rim.position.z]],.012);
  const screen=box(ctx,m.trim,[0,belt+.115,dashboardZ+.065],[.256,.128,.018],.006);
  screen.rotation.x=-.12;
  const driverX=rim.position.x,headY=spec.height*.925-.112,headZ=seatZ-.105;
  function oval(mat,x,y,z,rx,ry,rz){
    const mesh=new T.Mesh(new T.SphereGeometry(1,12,9),mat);
    mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);ctx.group.add(mesh);
  }
  oval(m.jacket,driverX,headY-.245,headZ-.013,.210,.188,.108);
  oval(m.skin,driverX,headY,headZ,.084,.111,.094);
  oval(m.black,driverX,headY+.044,headZ+.013,.087,.076,.091);
  for(const side of [-1,1]){
    const hand=[driverX+side*.112,wheelY+.032,rim.position.z];
    const elbow=[driverX+side*.197,belt+.025,headZ-.182];
    line(ctx,m.jacket,[[driverX+side*.154,headY-.18,headZ-.024],elbow,hand],.041,true);
    oval(m.skin,...hand,.034,.039,.031);
  }
}
