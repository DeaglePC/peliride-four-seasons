import * as T from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {panoramas,bearings,routeSkies} from './photography.js';
import mapProfile from './assets/panorama/horizons.png';
import alpineLight from './assets/panorama/alps-light.hdr';

const vertexShader=`
 varying vec3 ray;
 void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
const fragmentShader=`
 varying vec3 ray;
 uniform sampler2D plateA,plateB,overcast,stars,profiles,cityLights;
 uniform vec2 bearing,profileRow;
 uniform float travel,night,aurora,storm,clock,city,ready;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 vec2 plateUv(vec2 uv){return vec2(fract(uv.x),clamp((uv.y-.325)/.625,.001,.999));}
 void main(){
  vec3 d=normalize(ray);float az=atan(d.z,d.x);vec2 uv=vec2(az*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);
  vec2 ua=vec2(fract(uv.x+bearing.x),uv.y),ub=vec2(fract(uv.x+bearing.y),uv.y);
  vec3 land=mix(texture2D(plateA,plateUv(ua)).rgb,texture2D(plateB,plateUv(ub)).rgb,travel);
  float lineA=texture2D(profiles,vec2(ua.x,profileRow.x)).r,lineB=texture2D(profiles,vec2(ub.x,profileRow.y)).r;
  float sky=mix(smoothstep(lineA-.004,lineA+.005,uv.y),smoothstep(lineB-.004,lineB+.005,uv.y),travel);
  vec3 greySky=texture2D(overcast,plateUv(vec2(uv.x+.29+clock*.00032,uv.y))).rgb;
  float lum=dot(land,vec3(.2126,.7152,.0722));
  vec3 overLand=mix(land,vec3(lum*.82,lum*.93,lum),.48)*.62+vec3(.018,.028,.035);
  vec3 day=mix(land,mix(overLand,greySky*vec3(.81,.90,1.)*.88,sky),storm);
  vec3 starscape=texture2D(stars,plateUv(vec2(uv.x+.28,uv.y))).rgb;
  vec3 nightLand=(land*.17+lum*.04)*vec3(.34,.49,.74)+vec3(.003,.005,.011);
  vec3 dark=mix(nightLand,starscape*vec3(.22,.37,.60)+vec3(.001,.003,.007),sky);
  vec3 skyline=texture2D(cityLights,plateUv(vec2(uv.x+.32,uv.y))).rgb;
  dark=mix(dark,skyline*vec3(.75,.80,.99),city);
  dark=mix(dark,greySky*vec3(.036,.054,.085),storm*sky*.77);
  float elevation=max(d.y,0.);
  for(int i=0;i<3;i++){
   float f=float(i),a=az*2.8+f*.52+clock*.022;
   float rim=.18+.064*f+.067*sin(a)+.043*sin(a*2.54+.8)+.015*sin(a*8.1);
   float dy=elevation-rim;
   float folds=.28+.49*noise(vec2(az*22.+clock*.037,f))+.21*noise(vec2(az*118.+clock*.062,f));
   float ribbon=smoothstep(-.014,.012,dy)*exp(-max(dy,0.)*(11.+f*1.8));
   dark+=aurora*sky*folds*ribbon*mix(vec3(.012,.36,.18),vec3(.115,.075,.26),f*.32);
  }
  vec3 color=mix(day,dark,night);
  color=mix(vec3(.42,.57,.65),color,ready);
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
 }`;

export function createSky(scene,renderer){
 const loader=new T.TextureLoader(),cache=new Map(),finished=new Set();
 const textureFor=i=>{
  if(!cache.has(i)){
   const tex=loader.load(panoramas[i],()=>finished.add(i));
   tex.colorSpace=T.SRGBColorSpace;tex.wrapS=T.RepeatWrapping;
   cache.set(i,tex);
  }
  return cache.get(i);
 };
 const profiles=loader.load(mapProfile);profiles.flipY=false;profiles.generateMipmaps=false;profiles.minFilter=T.LinearFilter;
 const u={plateA:{value:textureFor(0)},plateB:{value:textureFor(0)},profiles:{value:profiles},overcast:{value:textureFor(8)},stars:{value:textureFor(7)},cityLights:{value:textureFor(9)},travel:{value:0},bearing:{value:new T.Vector2()},profileRow:{value:new T.Vector2()},night:{value:0},storm:{value:0},aurora:{value:0},clock:{value:0},city:{value:0},ready:{value:0}};
 const dome=new T.Mesh(new T.SphereGeometry(425,40,20),new T.ShaderMaterial({uniforms:u,vertexShader,fragmentShader,side:T.BackSide,depthWrite:false,fog:false}));
 dome.renderOrder=-10;dome.frustumCulled=false;scene.add(dome);
 // Prefilter the actual high-dynamic-range sky once for glass, clear coat and chrome.
 new HDRLoader().load(alpineLight,source=>{
  const pmrem=new T.PMREMGenerator(renderer);
  const filtered=pmrem.fromEquirectangular(source);scene.environment=filtered.texture;
  source.dispose();pmrem.dispose();
 });
 // Measured solar bearings in each equirectangular capture, in turns and degrees.
 const sunPos=[[.607,40],[.66,44],[.606,7],[.57,23],[.60,21],[.593,39],[.56,9]];
 const solarA=new T.Vector3(),solarB=new T.Vector3();
 function sunDirection(id,target){
  const [u,alt]=sunPos[id],yaw=(u-bearings[id]-.5)*2*Math.PI,e=alt*Math.PI/180;
  return target.set(Math.cos(yaw)*Math.cos(e),Math.sin(e),Math.sin(yaw)*Math.cos(e));
 }
 return function update(camera,distance,dt,time,night,storm,aurora){
  const loc=T.MathUtils.clamp(distance/520,0,7.999);
  const i=Math.floor(loc),f=loc-i;
  let a=routeSkies[i],b=a,mix=0;
  if(f>.90&&i<7){b=routeSkies[i+1];mix=T.MathUtils.smoothstep(f,.90,1.10)}
  else if(f<.10&&i>0){a=routeSkies[i-1];mix=T.MathUtils.smoothstep(f,-.10,.10)}
  const ta=textureFor(a),tb=textureFor(b);
  if(finished.has(a)&&finished.has(b)){u.plateA.value=ta;u.plateB.value=tb;u.bearing.value.set(bearings[a],bearings[b]);u.profileRow.value.set((a+.5)/10,(b+.5)/10);u.travel.value=mix;u.ready.value=1}
  u.city.value=(a===4?1-mix:0)+(b===4?mix:0);u.night.value=night;u.storm.value=storm;u.aurora.value=aurora;u.clock.value=time;dome.position.copy(camera.position);
  scene.environmentIntensity=(.55-.37*night)*(1-.24*storm);scene.environmentRotation.y=(bearings[0]-.5)*Math.PI*2;
  return sunDirection(a,solarA).lerp(sunDirection(b,solarB),mix).normalize();
 };
}
