// Alpha atlas sources: photographed conifers by rubberduck and understory by
// para (opengameart.org/content/high-res-tree-textures and
// opengameart.org/content/paramecijs-vegetation-base-texture-pack), CC0.
// Deciduous trees, spring blossom and palm: PurePNG free-for-commercial-use
// cutouts 15166, 15168, 15141, 15135, 15099 and 8211. Autumn foliage and
// snowy crowns are seasonal color treatments of the original silhouettes.
import foliageURL from '../assets/nature/foliage.webp';
import meadowURL from '../assets/nature/meadow.jpg';
import earthURL from '../assets/nature/earth.jpg';
import sandURL from '../assets/nature/sand.jpg';
import snowURL from '../assets/nature/snow.jpg';
import architectureURL from '../assets/nature/architecture.jpg';

const species=['maple','oak','ash','birch','sapling','blossom','gold','orange','goldOak','pine','pricklyPear','fir','snowFir','snowPine','palm','shrub','grass','straw','daisies','fern'];
const aspects=[.689,1.321,.478,.452,.627,.892,.478,.689,1.321,.489,.665,.398,.398,.489,.714,.598,2.548,2.718,2.19,.628];
const index=Object.fromEntries(species.map((name,i)=>[name,i]));

export function createNature(THREE) {
  const loader=new THREE.TextureLoader();
  function load(url,repeat){
    const texture=loader.load(url);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;
    if(repeat)texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    return texture;
  }
  const foliage=load(foliageURL,false);
  const clock={value:0},wind={value:.12};
  const cardsMaterial=new THREE.MeshBasicMaterial({map:foliage,vertexColors:true,alphaTest:.31,side:THREE.DoubleSide});
  const shadowMaterial=new THREE.MeshDepthMaterial({map:foliage,alphaTest:.38,side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking});
  function useFacingCards(shader){
    shader.uniforms.natureClock=clock;shader.uniforms.natureWind=wind;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec2 cardOffset; uniform float natureClock,natureWind;')
      .replace('#include <begin_vertex>',`
        vec3 transformed=position;
        vec3 foot=(modelMatrix*vec4(position,1.)).xyz;
        vec2 direction = cameraPosition.xz-foot.xz;
        vec2 side = normalize(vec2(direction.y+.0001,-direction.x));
        float sway = sin(position.x*.38+position.z*.31+natureClock*1.42) + .4*sin(natureClock*2.1+position.x);
        transformed.xz += side * cardOffset.x;
        transformed.x += cardOffset.y*sway*natureWind*.015;
        transformed.y += cardOffset.y;
      `);
  }
  cardsMaterial.onBeforeCompile=useFacingCards;
  shadowMaterial.onBeforeCompile=useFacingCards;
  const day=new THREE.Color('#e3e4d6'), night=new THREE.Color('#586c88'), rain=new THREE.Color('#afc0be');
  function update(time,nightAmount,weather){
    clock.value=time;
    wind.value=weather==='wind'?.95:weather==='rain'?.50:.20;
    cardsMaterial.color.copy(day).lerp(night,nightAmount).lerp(rain,weather==='rain'?.60:0);
  }
  const newBatch=()=>({position:[],uv:[],offset:[],color:[]});
  function plant(batch,name,x,y,z,h,random,width=1){
    const i=index[name], c=i%5, row=Math.floor(i/5);
    const u0=(c+.0135)/5,u1=(c+.9865)/5,v0=1-(row+.9865)/4,v1=1-(row+.0135)/4;
    const flip=random()<.5,left=flip?u1:u0,right=flip?u0:u1;
    const halfWidth=h*aspects[i]*width*.5,shade=.80+random()*.24;
    for(const [xx,yy,u,v] of [[-halfWidth,0,left,v0],[halfWidth,0,right,v0],[-halfWidth,h,left,v1],[-halfWidth,h,left,v1],[halfWidth,0,right,v0],[halfWidth,h,right,v1]]){
      batch.position.push(x,y-.025,z);batch.uv.push(u,v);batch.offset.push(xx,yy);
      batch.color.push(shade,shade*.99,shade*(.95+random()*.035));
    }
  }
  function createCards(batch){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(batch.position,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uv,2));
    g.setAttribute('cardOffset',new THREE.Float32BufferAttribute(batch.offset,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(batch.color,3));
    g.computeBoundingSphere();g.boundingSphere.radius+=18;
    const m=new THREE.Mesh(g,cardsMaterial);m.castShadow=true;m.customDepthMaterial=shadowMaterial;
    return m;
  }
  // Four CC0 photogrammetry diffuse maps from polyhaven.com: leafy_grass,
  // forest_floor, sand_02, snow_02. Store the small local variants with the
  // game so the entire circuit renders without contacting a texture server.
  const groundMaps=[meadowURL,earthURL,sandURL,snowURL].map(url=>load(url,true));
  const groundMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  groundMaterial.onBeforeCompile=shader=>{
    groundMaps.forEach((map,i)=>{shader.uniforms['natureT'+i]={value:map};});
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec4 surfaceWeight; attribute vec2 terrainUV; varying vec2 vTerrain; varying vec4 vSurface;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrain=terrainUV;vSurface=surfaceWeight;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec2 vTerrain; varying vec4 vSurface; uniform sampler2D natureT0,natureT1,natureT2,natureT3;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 uv = vTerrain;
        vec2 coarse = mat2(.81,.58,-.58,.81)*uv*.18;
        float macro = texture2D(natureT1,coarse).g;
        vec3 meadow=texture2D(natureT0,uv).rgb;
        vec3 earth=texture2D(natureT1,uv*.66).rgb;
        vec3 sand=texture2D(natureT2,uv*.73).rgb;
        vec3 snow=texture2D(natureT3,uv*.48).rgb;
        vec3 cover=meadow*vSurface.x+earth*vSurface.y+sand*vSurface.z+snow*vSurface.w;
        diffuseColor.rgb *= cover*(.91+.74*macro);
      `);
  };
  const oceanMaterial=new THREE.MeshPhongMaterial({color:'#407a80',specular:'#afc9c8',shininess:65,side:THREE.DoubleSide});
  oceanMaterial.onBeforeCompile=shader=>{
    shader.uniforms.natureClock=clock;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec2 waterCoord;varying vec2 vWater;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvWater=waterCoord;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec2 vWater;uniform float natureClock;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 p=vWater; float t=natureClock;
        float rip=sin(p.y*2.7+sin(p.x*.49+t)+t*.85)*.056 + sin(p.y*3.9+p.x*1.16-t*1.7)*.038;
        normal=normalize(normal + vec3(rip*.76,rip*.23,rip));
        float shore=1.-smoothstep(0.,16.,p.x);
        float foam=smoothstep(.81,1.,sin(p.x*1.9+sin(p.y*.72)*.66-t*.81))*shore;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.49,.60,.58),foam*.64);
      `);
  };
  // CC0 Poly Haven scans: clay_roof_tiles, white_plaster_02,
  // wood_planks_grey and old_stone_wall_02, tiled in scene-space metres.
  const surfaces=load(architectureURL,false);
  const architectureMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  architectureMaterial.onBeforeCompile=shader=>{
    shader.uniforms.natureBuildings={value:surfaces};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float surfaceKind; varying float vKind; varying vec3 vBuildingPos,vBuildingNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvKind=surfaceKind;vBuildingPos=position;vBuildingNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D natureBuildings;varying float vKind;varying vec3 vBuildingPos,vBuildingNormal;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        if(vKind>.5){
          vec3 n=abs(vBuildingNormal);
          vec2 uv=n.y>.72 ? vBuildingPos.xz : n.z>n.x ? vBuildingPos.xy : vBuildingPos.zy;
          if(vKind<1.5)uv=vec2(vBuildingPos.z,vBuildingPos.x+vBuildingPos.y*.4)*.63;
          else uv*=vKind>3.5?.40:.52;
          float idx=min(3.,floor(vKind-.5));
          vec2 origin=vec2(mod(idx,2.),1.-floor(idx/2.))*.5;
          vec2 uvMap=origin+(.003+.994*fract(uv))*.5;
          vec3 tex=textureGrad(natureBuildings,uvMap,dFdx(uv)*.5,dFdy(uv)*.5).rgb;
          if(vKind<1.5)diffuseColor.rgb=tex*.91;
          else if(vKind<2.5)diffuseColor.rgb*=.44+tex*1.08;
          else if(vKind<3.5)diffuseColor.rgb=mix(diffuseColor.rgb,tex*1.13+vec3(.024,.021,.018),.59);
          else if(vKind<4.5)diffuseColor.rgb=mix(diffuseColor.rgb,tex*.87,.88);
          else {
            float grain=dot(tex,vec3(.30,.53,.17));
            vec3 stone=vec3(.15,.155,.145)*(.53+2.6*grain);
            if(vKind>6.5)diffuseColor.rgb*=.65+.42*sin(vBuildingPos.y*9.+grain*6.)+grain*1.36;
            else if(vKind>5.5){
              float snow=smoothstep(.15,.71,normalize(vBuildingNormal).y+grain*.35);
              diffuseColor.rgb=mix(stone,vec3(.72,.79,.81)*(.83+.74*grain),snow);
            }else diffuseColor.rgb=stone;
          }
        }
      `);
  };
  return {newBatch,plant,createCards,groundMaterial,oceanMaterial,architectureMaterial,update};
}
