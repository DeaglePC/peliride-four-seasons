import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {roadHeight,grade} from './elevation.js';
import colorUrl from './assets/surface/road-color.webp';
import normalUrl from './assets/surface/road-normal.jpg';
import roughUrl from './assets/surface/road-rough.jpg';
import wearUrl from './assets/surface/road-wear.jpg';
import gravelUrl from './assets/surface/shoulder.webp';

const shaderCommon=`
 varying vec3 roadPosition;varying vec2 roadCoord;
 uniform float wetness,ice,elapsed,tyreShadow;uniform vec4 tyreContact;uniform sampler2D wear,reflection;uniform mat4 mirrorUV;
 float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),mix(hash2(i+vec2(0,1)),hash2(i+1.),f.x),f.y);}
 float stripe(float offset,float width,float aa){return 1.-smoothstep(width-aa,width+aa,abs(offset));}
 `;
export function buildRoad(scene,renderer,roadX){
 const loader=new T.TextureLoader(),aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 function tile(url,color=false){
  const t=loader.load(url);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=aniso;if(color)t.colorSpace=T.SRGBColorSpace;return t;
 }
 const normal=tile(normalUrl);normal.repeat.set(3.7,3.7);
 const mat=new T.MeshPhysicalMaterial({map:tile(colorUrl,true),normalMap:normal,normalScale:new T.Vector2(.51,.51),roughnessMap:tile(roughUrl),roughness:.95,clearcoat:.08,clearcoatRoughness:.5});
 const shoulder=new T.MeshStandardMaterial({map:tile(gravelUrl,true),color:0xa7a59a,roughness:1});shoulder.map.repeat.set(2.4,2.4);
 const mobile=matchMedia('(pointer:coarse)').matches;
 const mirror=new Reflector(new T.PlaneGeometry(1,1),{textureWidth:mobile?288:576,textureHeight:mobile?192:320,multisample:0,clipBias:.001});
 const inverse=new T.Matrix4(),project=new T.Matrix4();let nextReflection=0;
 const inputs={wetness:{value:0},ice:{value:0},elapsed:{value:0},tyreContact:{value:new T.Vector4()},tyreShadow:{value:1},wear:{value:tile(wearUrl)},reflection:{value:mirror.getRenderTarget().texture},mirrorUV:{value:project}};
 mat.onBeforeCompile=s=>{
  Object.assign(s.uniforms,inputs);
  s.vertexShader='varying vec3 roadPosition;varying vec2 roadCoord;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nroadPosition=position;roadCoord=uv;');
  s.fragmentShader=shaderCommon+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float lateral=(roadCoord.x-.5)*10.,metres=roadCoord.y*11.;
   vec2 pavement=vec2(lateral,metres);float wearSample=texture2D(wear,roadCoord*vec2(1.18,.91)).r;
   float variation=noise2(pavement*vec2(.48,.25))*.63+noise2(pavement*vec2(1.51,1.04))*.37;
   float tracks=smoothstep(.32,.98,abs(sin((lateral+.30)*2.01)))*.17;
   float water=wetness*smoothstep(.26,.72,variation+tracks);
   float grit=dot(diffuseColor.rgb,vec3(.22,.65,.13));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(grit),.54)*mix(.91,.37,wetness);
   float aa=clamp(fwidth(lateral)*.65,.003,.11);
   float edge=stripe(abs(lateral)-4.78,.052,aa);
   float centre=stripe(abs(lateral+1.55)-.085,.042,aa);
   float dash=mod(metres,9.0);float divider=stripe(lateral-1.55,.058,aa)*smoothstep(.0,.075,dash)*(1.-smoothstep(3.25,3.34,dash));
   float bite=smoothstep(.33,.78,wearSample)*mix(.47,.91,smoothstep(.02,.20,grit))*(.72+.28*variation);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.70,.58),max(edge,divider)*bite);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.49,.17),centre*bite);
   float slush=ice*smoothstep(3.0,4.95,abs(lateral)+variation*.5)*smoothstep(.23,.70,variation);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.52,.58,.60),slush*.8);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.11,water);');
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
   if(water>.015){
    vec4 proj=mirrorUV*vec4(roadPosition,1.);vec2 sampleUv=proj.xy/max(.001,proj.w);
    vec2 cells=pavement*3.8,ring=fract(cells)-.5;float phase=fract(elapsed*1.47+hash2(floor(cells)));
    float ripple=exp(-pow((length(ring)-phase*.54)*17.,2.))*(1.-phase);
    vec2 distorted=sampleUv+water*(normal.xy*.0024+ring*ripple*.003);
    vec3 reflected=texture2D(reflection,clamp(distorted,vec2(.004),vec2(.996))).rgb;
    float grazing=pow(1.-abs(normalize(cameraPosition-roadPosition).y),2.8);
    float nearField=1.-smoothstep(22.,42.,length(cameraPosition-roadPosition));
    outgoingLight=mix(outgoingLight,reflected,water*nearField*(.17+.65*grazing));
   }
   vec2 rear=(roadPosition.xz-tyreContact.xy)*vec2(10.,5.8),front=(roadPosition.xz-tyreContact.zw)*vec2(10.,5.8);
   outgoingLight*=1.-.54*tyreShadow*max(exp(-dot(rear,rear)),exp(-dot(front,front)));
   #include <opaque_fragment>`);
 };
 const M=266,step=1.6,layers=[];
 function ribbon(width,height,material){
  const g=new T.BufferGeometry(),verts=new Float32Array((M+1)*6),uv=new Float32Array((M+1)*4),norm=new Float32Array(verts.length),ids=[];
  for(let i=0;i<=M;i++){uv[i*4+2]=1;if(i<M)ids.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2)}
  g.setIndex(ids);for(const [key,buf,size] of [['position',verts,3],['uv',uv,2],['normal',norm,3]])g.setAttribute(key,new T.BufferAttribute(buf,size).setUsage(T.DynamicDrawUsage));
  const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);layers.push({width,height,mesh,verts,uv,norm});
 }
 ribbon(5.58,.006,shoulder);ribbon(5,.025,mat);
 let previous=Infinity;
 return {
  update(distance,wet,snow,time,dt,riderX,yaw,showContact=true){
   inputs.tyreShadow.value=Number(showContact);
   const x=Math.sin(yaw)*.765,z=Math.cos(yaw)*.765;inputs.tyreContact.value.set(riderX+x,z,riderX-x,-z);
   inputs.wetness.value=wet;inputs.ice.value=T.MathUtils.lerp(inputs.ice.value,+snow,1-Math.exp(-dt));inputs.elapsed.value=time;
   mat.clearcoat=.04+wet*.76;mat.clearcoatRoughness=.45-wet*.27;
   if(Math.abs(previous-distance)<.004)return;previous=distance;
   const base=roadHeight(distance);
   for(let i=0;i<=M;i++){
    const d=-35+i*step,s=distance+d,x=roadX(s),y=roadHeight(s)-base,incline=grade(s),len=1/Math.hypot(incline,1);
    for(const l of layers){const j=i*6;l.verts[j]=x-l.width;l.verts[j+3]=x+l.width;l.verts[j+1]=l.verts[j+4]=y+l.height;l.verts[j+2]=l.verts[j+5]=-d;l.uv[i*4+1]=l.uv[i*4+3]=s/11;l.norm[j+1]=l.norm[j+4]=len;l.norm[j+2]=l.norm[j+5]=incline*len}
   }
   for(const {mesh} of layers)for(const name of ['position','uv','normal'])mesh.geometry.attributes[name].needsUpdate=true;
  },
  reflect(camera,x,distance,wet){
   const now=performance.now();if(wet<.045||now<nextReflection)return;nextReflection=now+(mobile?125:70);
   mirror.position.set(x,.031,0);mirror.rotation.x=-Math.PI/2+Math.atan(grade(distance));mirror.updateMatrixWorld();
   for(const l of layers)l.mesh.visible=false;
   camera.updateMatrixWorld();mirror.onBeforeRender(renderer,scene,camera);
   for(const l of layers)l.mesh.visible=true;
   project.copy(mirror.material.uniforms.textureMatrix.value).multiply(inverse.copy(mirror.matrixWorld).invert());
  }
 };
}
