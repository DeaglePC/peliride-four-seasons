import * as T from 'three';
import {createSky} from './sky.js';

export function atmosphere(scene,camera,renderer){
 const sky=createSky(scene,renderer);
 const hemi=new T.HemisphereLight(),sun=new T.DirectionalLight();
 sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);
 Object.assign(sun.shadow.camera,{left:-20,right:20,top:19,bottom:-19,near:.25,far:120});
 sun.shadow.normalBias=.022;sun.shadow.bias=-.00019;sun.shadow.radius=2;
 scene.add(hemi,sun,sun.target);
 const amount=720,rainPos=new Float32Array(amount*6),snowPos=new Float32Array(amount*3),windPos=new Float32Array(65*6);
 function particles(pos,mat,points){let geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));let obj=points?new T.Points(geo,mat):new T.LineSegments(geo,mat);obj.frustumCulled=false;scene.add(obj);return obj}
 const rainMesh=particles(rainPos,new T.LineBasicMaterial({color:0xb3d7e5,transparent:true,opacity:.6,depthWrite:false}),false);
 const flake=document.createElement('canvas');flake.width=flake.height=32;const fc=flake.getContext('2d'),fg=fc.createRadialGradient(16,16,1,16,16,15);fg.addColorStop(0,'#fff');fg.addColorStop(.32,'#fff');fg.addColorStop(1,'#ffffff00');fc.fillStyle=fg;fc.fillRect(0,0,32,32);
 const snowMesh=particles(snowPos,new T.PointsMaterial({color:0xf1f8ff,map:new T.CanvasTexture(flake),size:.10,transparent:true,opacity:.93,depthWrite:false}),true);
 const windMesh=particles(windPos,new T.LineBasicMaterial({color:0xe8d5a6,transparent:true,opacity:.72,depthWrite:false}),false);
 let seed=17101;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const flakes=Array.from({length:amount},()=>[rand()*70,rand()*22,rand()*68,rand()*7]);const col=new T.Color(),temp=new T.Color(),fog=new T.Fog(0xcbdacb,65,245);scene.fog=fog;
 let first=true,night=0,wet=0,aurora=0,storm=0,lastLight=performance.now();
 return function update({time,dt,weather,riderX,distance}){
  const now=performance.now(),lightStep=Math.max(dt,Math.min(1,(now-lastLight)/1000));lastLight=now;
  const k=first?1:1-Math.exp(-lightStep*1.75);first=false;
  const snow=weather==='snow',rain=weather==='rain'||weather==='rainNight',gale=weather==='wind';
  night=T.MathUtils.lerp(night,+(weather==='night'||weather==='rainNight'||weather==='aurora'),k);wet=T.MathUtils.lerp(wet,+rain,k*.78);aurora=T.MathUtils.lerp(aurora,+(weather==='aurora'),k);
  storm=T.MathUtils.lerp(storm,rain?.98:snow?.89:gale?.22:0,k);
  const lightDir=sky(camera,distance,dt,time,night,storm,aurora);
  const lowSun=1-T.MathUtils.smoothstep(lightDir.y,.13,.53);
  fog.color.copy(col.set('#c0d4dc').lerp(temp.set('#a3abb1'),storm).lerp(temp.set('#213347'),night));
  fog.near=T.MathUtils.lerp(fog.near,snow?19:rain?27:64,k);fog.far=T.MathUtils.lerp(fog.far,snow?127:rain?158:285,k);
  hemi.intensity=1.0+.69*storm*(1.-night*.76)-.45*night;
  hemi.color.copy(col.set('#cfdfef').lerp(temp.set('#d3dde0'),storm).lerp(temp.set('#9dbcdf'),night));
  hemi.groundColor.copy(col.set('#ada88f').lerp(temp.set('#bcc4cd'),snow?.82:0).lerp(temp.set('#465b72'),night));
  sun.intensity=(2.95+lowSun*.33)*(1-.88*storm)*(1-.85*night);
  sun.color.copy(col.set('#fff0d4').lerp(temp.set('#ffc69c'),lowSun).lerp(temp.set('#e6eef6'),storm).lerp(temp.set('#b2c8ed'),night));
  sun.position.copy(lightDir).multiplyScalar(44);sun.position.x+=riderX;sun.position.z-=4;sun.target.position.set(riderX,0,-4);
   rainMesh.material.opacity=.35+.34*wet;rainMesh.visible=rain;snowMesh.visible=snow;windMesh.visible=gale;
  if(rainMesh.visible||snowMesh.visible||windMesh.visible){
   const rain=rainMesh.visible,wind=windMesh.visible,buf=rain?rainPos:wind?windPos:snowPos,count=wind?65:amount;
   for(let j=0;j<count;j++){
    const [a,b,c,p]=flakes[j],fall=rain?18:wind?.45:1.35,drift=rain?2.4:wind?12:1.2;
    let y=((b-time*fall)%22+22)%22,x=(a+time*drift+Math.sin(time+p)*(rain?.04:.39))%70-35+riderX,z=((c+distance)%68+68)%68-54;
    let n=j*(rain||wind?6:3);buf[n]=x;buf[n+1]=y;buf[n+2]=z;if(rain||wind){buf[n+3]=x+(rain?.09:.48);buf[n+4]=y-(rain?.57:.04);buf[n+5]=z+.055}
   }
   (rain?rainMesh:wind?windMesh:snowMesh).geometry.attributes.position.needsUpdate=true;
  }
  return {night,wet};
 };
}
