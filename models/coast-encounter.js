import {createCoastalFish} from './coastal-fish.js';
import {roadHeight} from '../elevation.js';

const coastStart=1040, coastEnd=1560, waterY=-1.16;
const lanes=[0,1,-1,0,-1,1], gaps=[66,78,61,72,83];
const warning=.78, intercept=1.52, gravity=10.5;
const fishScale=1.16;
const reach=[.68,.52,.78];

export function createCoastEncounter(T,scene,roadX,laneOpenForFish) {
  const fish=createCoastalFish(T);
  fish.group.name='Leaping sea fish';
  scene.add(fish.group);
  const splash=new T.Group();
  splash.name='Fish surface disturbance';
  scene.add(splash);
  const ringMaterial=new T.MeshBasicMaterial({color:0xc3e3da,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
  const rings=[];
  for(let i=0;i<2;i++){
    const ring=new T.Mesh(new T.RingGeometry(.95,1,48),ringMaterial.clone());
    ring.rotation.x=-Math.PI/2;splash.add(ring);rings.push(ring);
  }
  const droplets=new T.InstancedMesh(new T.SphereGeometry(1,5,4),new T.MeshPhongMaterial({color:0xc1dfe2,specular:0xffffff,shininess:95}),17);
  droplets.frustumCulled=false;splash.add(droplets);
  const drop=new T.Object3D(),mouth=new T.Vector3(),relative=new T.Vector3(),previous=new T.Vector3();
  const tangent=new T.Vector3(),forward=new T.Vector3(1,0,0),delta=new T.Vector3();
  let event=null, sequence=0,nextAt=0,blockedAt=null,lastLane=null,hasPrevious=false;
  const result={lane:null,caught:false};
  const api={reset,update,gape:0,swallow:0,framing:0};

  function reset(distance){
    event=null;sequence=0;nextAt=Math.max(coastStart+3,distance+3);blockedAt=null;lastLane=null;hasPrevious=false;
    fish.group.visible=false;fish.group.scale.setScalar(fishScale);splash.visible=false;
    api.gape=0;api.swallow=0;api.framing=0;
  }
  function launch(state){
    // Project along the current input once. The airborne fish follows a fixed arc,
    // so a late change in speed or lane can make the rider miss it.
    const duration=warning+intercept, rate=state.brake?2.9:.9;
    const riderAt=t=>state.distance+state.targetSpeed*t+(state.speed-state.targetSpeed)*(-Math.expm1(-rate*t))/rate;
    const catchS=riderAt(duration)+1.10;
    if(catchS>coastEnd-8){nextAt=coastEnd;return}
    const preferred=lanes[sequence%lanes.length];
    const candidates=[preferred];
    if(blockedAt!==null&&state.distance-blockedAt>=12){
      candidates.push(...[-1,1,0].filter(l=>l!==preferred&&l!==lastLane));
      if(lastLane!==null&&state.distance-blockedAt>=42)candidates.push(lastLane);
    }
    const lane=candidates.find(candidate=>laneOpenForFish(candidate,riderAt,duration));
    if(lane===undefined){blockedAt??=state.distance;nextAt=state.distance+4;return}
    blockedAt=null;
    const startS=catchS+3.4, fromX=roadX(startS)-19.6, toX=roadX(catchS)+lane*3.1;
    const dy=roadHeight(catchS)+2.06-waterY;
    const vy=dy/intercept+gravity*intercept*.5;
    const groundTime=(vy+Math.sqrt(vy*vy-2*gravity*(roadHeight(catchS)+.10-waterY)))/gravity;
    event={lane,fromX,startS,vx:(toX-fromX)/intercept,vs:(catchS-startS)/intercept,vy,
      groundTime,age:-warning,caughtAt:null};
    nextAt=state.distance+gaps[sequence%gaps.length];lastLane=lane;sequence++;hasPrevious=false;
  }
  function drawSplash(e,distance){
    const t=e.age;
    splash.visible=t<.96;
    if(!splash.visible)return;
    splash.position.set(e.fromX,waterY-roadHeight(distance)+.035,distance-e.startS);
    for(let i=0;i<rings.length;i++){
      const age=t+warning-i*.25;
      const ring=rings[i];ring.visible=age>=0;
      if(age<0)continue;
      ring.scale.setScalar(.18+age*(i?1.5:1.84));ring.material.opacity=Math.max(0,1-age/1.73)*.70;
    }
    droplets.visible=t>=0&&t<.61;
    if(!droplets.visible)return;
    for(let i=0;i<droplets.count;i++){
      const a=i*2.39996,v=1.8+(i%5)*.34,y=(2.15+i%4*.37)*t-4.9*t*t;
      const size=y>0?.035+(i%3)*.011:0;
      drop.position.set(Math.cos(a)*v*t+.6*t,y,Math.sin(a)*v*t);
      drop.scale.set(size,size*1.9,size);drop.updateMatrix();droplets.setMatrixAt(i,drop.matrix);
    }
    droplets.instanceMatrix.needsUpdate=true;
  }
  function intersectsBill(){
    if(!hasPrevious)return relative.lengthSq()<=1;
    delta.subVectors(relative,previous);
    const fraction=T.MathUtils.clamp(-previous.dot(delta)/(delta.lengthSq()||1),0,1);
    return delta.multiplyScalar(fraction).add(previous).lengthSq()<=1;
  }
  function update(state,dt,beak,impact){
    const riding=state.mode==='ride', advancing=riding||state.mode==='crash';
    const distance=state.distance;
    result.lane=null;result.caught=false;
    if(state.routeIndex!==2||state.mode==='home'){
      if(event||fish.group.visible||splash.visible)reset(distance);
      return result;
    }
    if(!event&&riding&&distance>=nextAt&&distance<coastEnd)launch(state);
    if(!event){
      if(advancing)api.framing=T.MathUtils.damp(api.framing,0,4,dt);
      return result;
    }
    const e=event;
    if(advancing)e.age+=dt;
    const t=e.age,flight=Math.min(e.groundTime,Math.max(0,t)),grounded=t>=e.groundTime;
    const showLane=riding&&!impact&&e.caughtAt===null&&!grounded;
    result.lane=showLane?e.lane:null;
    const targetFrame=showLane||e.caughtAt!==null?1:0;
    if(advancing)api.framing+=(targetFrame-api.framing)*(1-Math.exp(-dt*4));
    drawSplash(e,distance);
    fish.group.visible=t>=0;
    if(t<0)return result;
    beak.getWorldPosition(mouth);
    if(e.caughtAt===null){
      const sinceGround=Math.max(0,t-e.groundTime);
      fish.group.scale.setScalar(fishScale*(1-T.MathUtils.smoothstep(sinceGround,1.9,2.3)));
      const skid=(1-Math.exp(-sinceGround*5))*.34;
      const at=e.startS+e.vs*flight;
      fish.group.position.set(e.fromX+e.vx*flight+skid,
        (grounded?roadHeight(at)+.10+.11*Math.abs(Math.sin(sinceGround*12))*Math.exp(-sinceGround*2):waterY+e.vy*flight-.5*gravity*flight*flight)-roadHeight(distance),
        distance-at);
      tangent.set(e.vx,grounded?0:e.vy-gravity*flight,-e.vs).normalize();
      fish.group.quaternion.setFromUnitVectors(forward,tangent);
      fish.group.rotateX(grounded?1.42+.34*Math.sin(sinceGround*16)*Math.exp(-sinceGround*2):-.20-.55*Math.sin(Math.PI*flight/e.groundTime));
      fish.animate(t,grounded?.72*Math.exp(-sinceGround):.68);
      relative.subVectors(fish.group.position,mouth);
      const close=riding&&!impact&&!grounded&&relative.lengthSq()<15;
      relative.set(relative.x/reach[0],relative.y/reach[1],relative.z/reach[2]);
      if(advancing)api.gape=T.MathUtils.damp(api.gape,Number(close),15,dt);
      if(riding&&!impact&&!grounded&&t>.35&&intersectsBill()){
        e.caughtAt=t;result.caught=true;result.lane=null;
      }
      previous.copy(relative);hasPrevious=true;
    }
    if(e.caughtAt!==null){
      const held=t-e.caughtAt, swallow=T.MathUtils.smoothstep(held,.35,.73);
      api.gape=1-T.MathUtils.smoothstep(held,.03,.26)+.30*Math.sin(swallow*Math.PI);
      api.swallow=Math.sin(swallow*Math.PI);
      fish.group.scale.setScalar(fishScale*(1-swallow));
      fish.group.position.set(.04*(1-swallow),-.018,-.075+swallow*.28);
      beak.localToWorld(fish.group.position);
      beak.getWorldQuaternion(fish.group.quaternion);
      fish.group.rotateZ(.16*(1-swallow));fish.animate(held,.8*(1-swallow));
    }
    if((e.caughtAt!==null&&t-e.caughtAt>.78)||t>e.groundTime+2.3){
      event=null;fish.group.visible=false;fish.group.scale.setScalar(fishScale);splash.visible=false;
      api.gape=0;api.swallow=0;hasPrevious=false;
    }
    return result;
  }
  reset(0);
  return api;
}
