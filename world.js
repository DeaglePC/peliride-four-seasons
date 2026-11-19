import * as T from 'three';
import {createRider} from './models/rider.js';
import {createLandscape} from './models/landscape.js';
import {createTraffic} from './models/traffic.js';
import {createTrafficReflections} from './models/traffic-reflections.js';
import {createCoastEncounter} from './models/coast-encounter.js';
import {atmosphere} from './atmosphere.js';
import {buildRoad} from './road.js';
import {roadHeight,grade} from './elevation.js';
export function roadX(s){return 9*Math.sin(s*.013)+13*Math.sin(s*.006)-4*Math.sin(s*.028)}
export function createWorld(canvas){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.09,450);const rider=createRider(T);scene.add(rider.group);
 const ground=buildRoad(scene,renderer,roadX),scenery=createLandscape(T,scene),traffic=createTraffic(T,scene),atmos=atmosphere(scene,camera,renderer);
 const updateReflections=createTrafficReflections(renderer,traffic.setReflection);
 const coast=createCoastEncounter(T,scene,roadX,traffic.laneOpenForFish);
 const lamp=new T.SpotLight(0xffe8ba,0,38,.34,.61,1.65);lamp.position.set(0,1.15,-.88);lamp.target.position.set(0,.01,-12);rider.bicycle.add(lamp,lamp.target);
 const shadowC=document.createElement('canvas');shadowC.width=shadowC.height=64;const ctx=shadowC.getContext('2d'),g=ctx.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'#1a271abe');g.addColorStop(.5,'#26332778');g.addColorStop(1,'#25332500');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 const shadowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowC),transparent:true,depthWrite:false});
 const shadow=new T.Group();for(let z of [-.765,.765]){const contact=new T.Mesh(new T.PlaneGeometry(.38,.71),shadowMat);contact.rotation.x=-Math.PI/2;contact.position.z=z;shadow.add(contact)}scene.add(shadow);
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const desired=new T.Vector3(),look=new T.Vector3(),focus=new T.Vector3(),fallLook=new T.Vector3(),fallCamera=new T.Vector3();let width=0,height=0,first=true,frames=0,slow=0;
 return {
  outfit:id=>rider.setOutfit(id),reset(d){traffic.reset(d);coast.reset(d)},
  draw(state,dt,time){
   const w=canvas.clientWidth,h=canvas.clientHeight;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();first=true}
   const {distance,offset,steer,brake,mode,weather,routeIndex,cam,wardrobe,crash}=state;
   const moving=mode==='ride'||mode==='crash',speed=moving?state.speed:0;
   const x=roadX(distance),rx=x+offset,roadSlope=(roadX(distance+1)-roadX(distance-1))*.5,narrow=camera.aspect<.96;
   const incline=grade(distance);let home=mode==='home';rider.group.position.set(rx,.025,0);rider.group.rotation.x=Math.atan(incline);rider.group.rotation.y=-Math.atan(roadSlope)-steer*.06;rider.group.rotation.z=-steer*.13;
   shadow.visible=!crash;shadow.position.set(rx,.043,0);shadow.rotation.x=rider.group.rotation.x;shadow.rotation.y=rider.group.rotation.y;
   rider.update(mode==='pause'||mode==='result'?0:dt,{speed:home?1.2:speed,time,steer,brake,crash,gape:coast.gape,swallow:coast.swallow});
   const {night,wet}=atmos({time,dt,weather,riderX:rx,distance});
   updateReflections(distance,night,wet,weather,dt);
   const e=traffic.update({distance,dt,time,speed,riderX:rx,roadX,night,wet,playing:moving,detectHits:mode==='ride'&&state.grace<=0});
   const fishing=coast.update(state,dt,rider.beak,e.impact);
   e.fishLane=fishing.lane;e.caught=fishing.caught;
   const cinematic=home&&cam===0;
   if(wardrobe){desired.set(rx+3.5,1.65,3.2);look.set(rx+(narrow?0:1.3),1.3,-.4)}
   else if(cinematic){
    desired.set(rx+(narrow?3.7:3.8),narrow?1.58:1.48,narrow?3.65:4.55);
    look.set(rx+(narrow?-.51:-1.35),narrow?1.89:1.61,narrow?-.22:.58);
   }else if(cam===2){desired.set(rx+4.6,1.95,2.4);look.set(rx,1.12,-.5)}
   else if(cam===1){desired.set(rx+1.3,3.5,6.65);look.set(roadX(distance+8)+offset*.5,.97,-6.9)}
   else{desired.set(rx+1.38,2.75,5.8);look.set(roadX(distance+6)+offset*.67,1.08,-5.4)}
   desired.y-=desired.z*incline;look.y-=look.z*incline;
   const seaView=!crash&&!home&&!wardrobe&&cam===0&&!reducedMotion?coast.framing:0;
   desired.x+=seaView*2.3;look.x-=seaView*1.5;
   if(!home&&!wardrobe&&!reducedMotion){const motion=Math.min(1,speed/16);desired.x+=Math.sin(distance*1.32)*.008*motion;desired.y+=Math.sin(distance*2.31)*.009*motion+Math.cos(distance*.61)*.016*motion;desired.x-=steer*.16}
   let fallFrame=0;
   if(crash&&!wardrobe){
    const m=crash.motion,returning=crash.recover?T.MathUtils.smoothstep(crash.elapsed,T.MathUtils.lerp(m.remountStart,m.endTime,.60),m.endTime):0;
    fallFrame=T.MathUtils.smoothstep(crash.elapsed,0,.42)*(1-returning);
    // Keep the horizon level and frame both the sliding bicycle and the bird.
    rider.group.updateMatrixWorld();fallLook.copy(rider.framingPoint).applyMatrix4(rider.group.matrixWorld);
    const width=Math.min(2.9,m.totalDistance*.13);
    fallCamera.set(fallLook.x+crash.side*((narrow?4.2:3.75)+width),2.45+width*.37,fallLook.z+5.15+width);
    fallCamera.y-=fallCamera.z*incline;
    desired.lerp(fallCamera,fallFrame);look.lerp(fallLook,fallFrame);
   }
   const fov=(home?43:wardrobe?43:44+Math.min(5,speed*.26))+fallFrame*(narrow?13:8)+seaView*(narrow?9:6);
   const nextFov=T.MathUtils.lerp(camera.fov,fov,first?1:1-Math.exp(-dt*3));if(Math.abs(nextFov-camera.fov)>.003){camera.fov=nextFov;camera.updateProjectionMatrix()}
   const lerp=first?1:1-Math.exp(-dt*(wardrobe||home?3.2:7));camera.position.lerp(desired,lerp);focus.lerp(look,lerp);camera.lookAt(focus);first=false;
   lamp.intensity=night*62+wet*11;ground.update(distance,wet,weather==='snow',time,dt,rx,rider.group.rotation.y,!crash);scenery.update({distance,time,routeIndex,progress:(distance%520)/520,night,roadX,weather:weather==='rainNight'?'rain':weather});
   ground.reflect(camera,rx,distance,wet);renderer.render(scene,camera);
   if(mode==='ride'&&++frames%100===0){if(dt>.041)slow++;else slow=Math.max(0,slow-1);if(slow>=3&&renderer.getPixelRatio()>1){renderer.setPixelRatio(1);slow=0}}
   return e;
  }
 };
}
