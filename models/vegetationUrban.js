import cityDayURL from '../assets/panorama/shanghai_riverside.webp';
import cityNightURL from '../assets/panorama/shanghai_bund.webp';
import pavingURL from '../assets/nature/sidewalk.jpg';
import brickURL from '../assets/nature/brick.jpg';

export function urbanSurfaces(T) {
  const loader=new T.TextureLoader();
  const load=url=>{
    const t=loader.load(url);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
  };
  const day=load(cityDayURL),dusk=load(cityNightURL),pavement=load(pavingURL),brick=load(brickURL);
  const darkness={value:0};
  const walls=new T.MeshBasicMaterial({side:T.DoubleSide});
  walls.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{urbanDay:{value:day},urbanDusk:{value:dusk},urbanBrick:{value:brick},urbanNight:darkness});
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec2 facadeUV,facadeType; varying vec2 vPanel,vStyle; varying vec3 vSurfaceP,vOut;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvPanel=facadeUV;vStyle=facadeType;vSurfaceP=(modelMatrix*vec4(position,1.)).xyz;vOut=normal;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        varying vec2 vPanel,vStyle;varying vec3 vSurfaceP,vOut;
        uniform sampler2D urbanDay,urbanDusk,urbanBrick;uniform float urbanNight;
        float urbanHash(vec2 id) {return fract(sin(dot(id,vec2(127.1,311.7)))*43758.54);}
        float band(float v,float edge,float aa){return smoothstep(edge-aa,edge+aa,v);}
      `)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float style=floor(vStyle.x+.01),seed=floor(vStyle.y*16.+.5)*.0625;
        vec2 cell=vec2(style<.5?2.0:style<1.5?1.58:1.83,style<.5?3.02:3.32);
        vec2 grid=vPanel/cell,fr=fract(grid);
        vec2 aa=min(fwidth(grid)*.6,vec2(.10));
        float room=urbanHash(floor(grid)+seed*32.),tower=urbanHash(vec2(seed,5.));
        float gallery=1.-step(3.20,vPanel.y);
        vec3 n=normalize(vOut),view=normalize(vSurfaceP-cameraPosition);
        vec3 direction=reflect(view,n);
        vec2 envUV=vec2(atan(direction.z,direction.x)*.159155+.54+seed*.029,asin(clamp(direction.y,-1.,1.))*.31831+.51);
        envUV.y=clamp((envUV.y-.325)/.625,.01,.99);
        envUV.x+=.002*sin(floor(grid.x)*6.12+seed)+.002*sin(grid.y*2.2);
        vec3 evening=texture2D(urbanDusk,envUV).rgb;
        evening=mix(evening,vec3(dot(evening,vec3(.30,.52,.18))),.42)*.30;
        vec3 sky=mix(texture2D(urbanDay,envUV).rgb,evening,urbanNight);
        float margin=style<.5?.145:style<1.5?.032:.050;
        float bottom=style<.5?.27:style<1.5?.16:.085;
        float top=style<.5?.80:style<1.5?.88:.965;
        if(gallery>.5){margin=.042;bottom=.065;top=.82;}
        float pane=band(fr.x,margin,aa.x)*(1.-band(fr.x,1.-margin,aa.x))*band(fr.y,bottom,aa.y)*(1.-band(fr.y,top,aa.y));
        float inner=band(fr.x,margin+.022,aa.x)*(1.-band(fr.x,1.-margin-.022,aa.x))*band(fr.y,bottom+.016,aa.y)*(1.-band(fr.y,top-.018,aa.y));
        float centerBar=1.-smoothstep(.010,.016+aa.x,abs(fr.x-.50));
        inner*=1.-centerBar*(style<1.5?.92:.14);
        float crossBar=1.-smoothstep(.009,.012+aa.y,abs(fr.y-.70));inner*=1.-crossBar*(gallery>.5?.97:.38);
        float outdoors=mix(1.,.20,urbanNight)*(.75+max(0.,dot(n,normalize(vec3(-.56,.76,.32))))*.31);
        vec3 masonry=style<.5?texture2D(urbanBrick,vPanel*vec2(.49,.49)).rgb*1.29:
          mix(vec3(.21,.24,.24),vec3(.35,.35,.32),tower)*(.75+.25*urbanHash(floor(vPanel/vec2(1.80,.70))+seed));
        if(style>1.5)masonry=mix(sky*vec3(.43,.57,.60),vec3(.035,.067,.086),.42)*(.95+.15*room);
        vec3 ledge=masonry*outdoors*(.82+.18*smoothstep(.015,.13,fr.y)); 
        vec3 rim=vec3(.075,.090,.096)*outdoors;
        vec3 surface=mix(ledge,rim,pane);
        float grazing=.20+.62*pow(1.-abs(dot(view,n)),2.);
        float blindLevel=.12+.7*room;
        float blinds=step(.64,room)*step(blindLevel,fr.y);
        vec3 internal=mix(vec3(.033,.045,.053),vec3(.10,.115,.113),room);
        internal=mix(internal,vec3(.20,.215,.20)*(.79+.21*smoothstep(.22,.61,fract(vPanel.y*11.))),blinds*.68);
        vec3 glass=mix(internal*outdoors,sky*vec3(.71,.88,.93),grazing+.16)*(.89+room*.20);
        float on=step(.67,room)*(1.-step(.45,abs(fr.x-.5)));
        vec3 light=mix(vec3(.66,.39,.16),vec3(.76,.79,.72),urbanHash(floor(grid)+seed*.41));
        float furniture=.63+.37*smoothstep(.31,.42,fr.y);
        float sideShade=.65+.35*smoothstep(.03,.22,fr.x);
        glass+=light*.56*urbanNight*on*furniture*sideShade*(.70+.30*(1.-blinds));
        diffuseColor.rgb=mix(surface,glass,inner);
      `);
  };
  const paving=new T.MeshStandardMaterial({map:pavement,color:'#c2c4bf',roughness:.86,side:T.DoubleSide});
  const soft=new T.MeshBasicMaterial({color:'#efcb94',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  soft.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 lightUV;varying vec2 vGlow;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvGlow=lightUV;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vGlow;')
      .replace('#include <color_fragment>','#include <color_fragment>\nfloat rad=dot(vGlow,vGlow);diffuseColor.a*=exp(-4.6*rad)*(1.-smoothstep(.55,1.,rad));');
  };
  function batch(){return {p:[],uv:[],types:[]};}
  function quad(b,a,c,d,e,w,h,style=0,seed=0) {
    const uv=[[0,0],[w,0],[w,h],[0,0],[w,h],[0,h]];
    for(const [i,pt] of [a,c,d,a,d,e].entries()){
      b.p.push(...pt);b.uv.push(...uv[i]);b.types.push(style,seed);
    }
  }
  function wallsOf(b,x,y,z,w,h,depth,style,seed) {
    const l=x-w*.5,r=x+w*.5,f=z+depth*.5,k=z-depth*.5,t=y+h;
    quad(b,[l,y,f],[r,y,f],[r,t,f],[l,t,f],w,h,style,seed);
    quad(b,[r,y,k],[l,y,k],[l,t,k],[r,t,k],w,h,style,seed);
    quad(b,[r,y,f],[r,y,k],[r,t,k],[r,t,f],depth,h,style,seed);
    quad(b,[l,y,k],[l,y,f],[l,t,f],[l,t,k],depth,h,style,seed);
  }
  function make(b,type) {
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));
    g.setAttribute(type==='facade'?'facadeUV':type==='pool'?'lightUV':'uv',new T.Float32BufferAttribute(b.uv,2));
    if(type==='facade')g.setAttribute('facadeType',new T.Float32BufferAttribute(b.types,2));
    g.computeVertexNormals();
    const m=new T.Mesh(g,type==='facade'?walls:type==='pool'?soft:paving);
    m.receiveShadow=type!=='pool';m.castShadow=type==='facade';
    return m;
  }
  function lightPool(b,x,y,z,rx,rz) {
    const start=b.uv.length;
    quad(b,[x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y,z-rz],[x-rx,y,z-rz],2,2);
    for(let i=start;i<b.uv.length;i++)b.uv[i]-=1;
  }
  function update(night){darkness.value=night;soft.opacity=.32*night;}
  return {batch,quad,wallsOf,make,lightPool,update};
}
