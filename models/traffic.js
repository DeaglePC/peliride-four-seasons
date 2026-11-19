import {createCoachbuilder,modelIds} from './vehicle-coachwork.js';
import {roadHeight,grade} from '../elevation.js';
// Traffic moves along the same distance coordinate as the road. Each direction
// has a common cruising speed, so vehicles in a stream keep their spacing.
export function createTraffic(THREE, scene) {
  const lane = 3.1;
  const ahead = 180;
  const group = new THREE.Group();
  group.name = 'Passing traffic';
  scene.add(group);

  const coachbuilder=createCoachbuilder(THREE);
  const cars=[];
  for(let i=0;i<10;i++) {
    const root=new THREE.Group();
    root.visible=false;
    group.add(root);
    cars.push({root,garage:new Map(),active:false});
  }
  let seed=1, priorDistance=0, initialFrame=true, upcoming=[];
  function random() {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  }
  function place(direction, at, type, palette, startLane, mayChange=false) {
    const car=cars.find(item=>!item.active);
    if(!car) return;
    if(!car.garage.has(type))car.garage.set(type,coachbuilder.build(type,palette));
    const template=car.garage.get(type);template.repaint(palette);
    if(car.template)car.root.remove(car.template.root);
    car.root.add(template.root);
    Object.assign(car,{active:true, at, direction, startLane, template, mayChange, previousAlong:null,previousAcross:0,
      changeAt: 9+random()*9, hit:false, reported:false, closest:Infinity, age:0,brakeTime:0});
    car.root.visible=false;
  }
  function generated(direction,at) {
    if(!upcoming.length){
      upcoming=[...modelIds,'model3','modelY'];
      for(let i=upcoming.length-1;i>0;i--){
        const j=Math.floor(random()*(i+1));[upcoming[i],upcoming[j]]=[upcoming[j],upcoming[i]];
      }
    }
    const type=upcoming.pop();
    const palette=Math.floor(random()*coachbuilder.paletteCount(type));
    const startLane=direction<0?-1:random()<.55?1:0;
    place(direction,at,type,palette,startLane,direction>0&&random()<.62);
  }
  function reset(distance=0) {
    for(const car of cars){ car.active=false; car.root.visible=false; }
    seed=(0x8f39cd2a+Math.floor(distance/17))>>>0;
    priorDistance=distance; initialFrame=true;upcoming=[];
    const opening=['cybertruck','model3','modelX','modelY','roadster','modelS'];
    const leg=Math.floor(distance/520),layout=[
      [-1,24,-1],[1,57,1],[-1,105,-1],[1,138,0],[-1,181,-1],[1,213,1]
    ];
    layout.forEach(([direction,gap,startLane],i)=>{
      const type=opening[(i+leg)%opening.length];
      const palette=i===0?0:(i+leg)%coachbuilder.paletteCount(type);
      place(direction,distance+gap,type,palette,startLane,i===3);
    });
  }
  function fillStream(direction, distance) {
    let farthest=distance+30;
    for(const car of cars) if(car.active&&car.direction===direction) farthest=Math.max(farthest,car.at);
    if(farthest<distance+ahead-38) generated(direction,farthest+64+random()*23);
  }
  function laneNow(car,age=car.age) {
    if(!car.mayChange) return car.startLane;
    const t=Math.max(0,Math.min(1,(age-car.changeAt)/3.8));
    return car.startLane+(1-2*car.startLane)*t*t*(3-2*t);
  }
  function laneOpenForFish(targetLane,riderAt,duration){
    for(let t=0;t<=duration+.3;t+=.15){
      const at=riderAt(t);
      for(const car of cars){
        if(!car.active||Math.abs(targetLane-laneNow(car,car.age+t))*lane>car.template.width+.8)continue;
        const velocity=car.direction<0?-6.7:3.5;
        const carAt=car.at+velocity*Math.max(0,t-car.brakeTime);
        if(Math.abs(carAt-at)<car.template.length+2.6)return false;
      }
    }
    return true;
  }
  function update({distance,dt,riderX,roadX,night,wet=0,playing,detectHits=playing}) {
    const events={hit:false,impact:null,passed:0,nearMiss:false,audible:null};
    let closestSound=32*32;
    if(Math.abs(distance-priorDistance)>45) reset(distance);
    const elapsed=playing?Math.max(0,dt):0;
    const darkness=Math.min(1,Math.max(0,Number(night)||0));
    coachbuilder.light(darkness,wet);
    for(const car of cars) {
      if(!car.active) continue;
      const oldAlong=car.previousAlong;
      const oldAt=car.at;
      car.age+=elapsed;
      car.brakeTime=Math.max(0,car.brakeTime-elapsed);
      const velocity=(car.direction<0?-6.7:3.5)*(1-Math.min(1,car.brakeTime/.28));
      car.at+=elapsed*velocity;
      const rel=car.at-distance, x=roadX(car.at)+laneNow(car)*lane;
      const lateral=x-riderX,squaredDistance=rel*rel+lateral*lateral;
      if(squaredDistance<closestSound){
        closestSound=squaredDistance;
        events.audible={x:lateral,z:rel,direction:car.direction,speed:Math.abs(velocity)};
      }
      car.root.position.set(x,roadHeight(car.at)-roadHeight(distance),-rel);
      car.root.visible=true;
      const tangent=(roadX(car.at+1)-roadX(car.at-1))*.5;
      // A slight lean during a manoeuvre makes the lane change legible at a distance.
      const u=(car.age-car.changeAt)/3.8, manoeuvring=car.mayChange&&u>0&&u<1;
      const drift=manoeuvring?(1-2*car.startLane)*lane*6*u*(1-u)/3.8/3.5:0;
      car.root.rotation.set(Math.atan(grade(car.at)),-Math.atan(tangent+drift)+(car.direction<0?Math.PI:0),
        manoeuvring?drift*.025:0);
      car.template.draw({rel,elapsed,velocity,night:darkness,wet,
        signal:car.mayChange&&u>-.35&&u<1&&Math.floor(car.age*3.2)%2===0,signalDirection:1-2*car.startLane});
      // Sweep in the car's road-aligned frame so the bumper and side panels
      // agree with the rendered vehicle in bends and during lane changes.
      const heading=tangent+drift,inv=1/Math.hypot(1,heading);
      const along=(rel+lateral*heading)*inv,across=(lateral-rel*heading)*inv;
      if(detectHits&&!initialFrame&&oldAlong!==null) {
        const halfLength=car.template.length+1.13;
        if(Math.max(along,oldAlong)>=-halfLength&&Math.min(along,oldAlong)<=halfLength) {
          const dz=along-oldAlong;
          const t1=dz?(-halfLength-oldAlong)/dz:0, t2=dz?(halfLength-oldAlong)/dz:1;
          const entry=Math.max(0,Math.min(t1,t2)), exit=Math.min(1,Math.max(t1,t2));
          const before=car.previousAcross,change=across-before;
          const d1=before+change*entry, d2=before+change*exit;
          const separation=d1*d2<=0?0:Math.min(Math.abs(d1),Math.abs(d2));
          const halfWidth=car.template.width+.31,clearance=separation-halfWidth;
          car.closest=Math.min(car.closest,clearance);
          if(clearance<=0&&!car.hit){
            const fraction=entry+(Math.abs(d1)>halfWidth?(Math.abs(d1)-halfWidth)/Math.abs(change):0);
            const contactAcross=before+change*fraction;
            const side=Math.abs(contactAcross)>.13?-Math.sign(contactAcross):(laneNow(car)<0?-1:1);
            const headOn=car.direction<0&&oldAlong>=halfLength&&Math.abs(d1)<=halfWidth;
            if(!events.impact||fraction<events.impact.fraction){
              events.impact={fraction,side,headOn,closingSpeed:Math.hypot(dz,change)/Math.max(.001,dt)};
            }
            car.hit=true;events.hit=true;
            if(car.direction<0){car.at=oldAt+(car.at-oldAt)*fraction;car.brakeTime=.90}
          }
        }
        if(oldAlong>=-halfLength&&along< -halfLength&&!car.reported){
          car.reported=true;
          if(!car.hit){events.passed++; if(car.closest<.72) events.nearMiss=true;}
        }
      }
      car.previousAlong=along;car.previousAcross=across;
      if(rel< -18||rel>ahead+52) {car.active=false;car.root.visible=false;}
    }
    if(playing) {fillStream(-1,distance); fillStream(1,distance);}
    priorDistance=distance;initialFrame=false;
    return events;
  }
  reset();
  return {update,reset,laneOpenForFish,setReflection:coachbuilder.setReflection};
}
