// Normal map on the tyre's unwrapped cross-section. U follows the rotation;
// V runs from the inner bead over the shoulders to the visible outer bead.
export function tireCompound(T,pickup){
  const width=768,height=128,profile=new Float32Array(width*height);
  const periodic=x=>Math.abs(x-Math.round(x));
  const groove=(distance,half)=>Math.max(0,Math.min(1,(half-distance)/(.42*half)));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/(height-1),a=Math.abs(v-.5),sign=v<.5?-1:1;
    const ribs=pickup?3:4,pitch=pickup?49:78;
    const stagger=Math.floor(a*ribs*3.5)*.31;
    let h=0;
    if(a<.283){
      const edge=Math.max(0,Math.min(1,(.283-a)/.035));
      const angle=a*(pickup?2.3:3.4)*sign;
      const notch=groove(periodic(u*pitch+stagger+angle),pickup?.13:.066);
      const rings=groove(periodic((v-.5)*ribs/.49+.5),pickup?.077:.091);
      h-=edge*Math.max(notch*(pickup?1:.63),rings);
      h-=edge*.22*groove(periodic(u*pitch*2-angle*.8+stagger),.056);
    }else{
      // Shallow mould ribs occupy the outer shoulder; the main sidewall stays smooth.
      h+=.09*groove(periodic(u*130+a*5),.18)*Math.max(0,1-Math.abs(a-.325)/.023);
      for(const bead of [.292,.364,.455])h+=.15*Math.max(0,1-Math.abs(a-bead)/.008);
    }
    profile[y*width+x]=h;
  }
  const glyph={
    A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],D:[30,17,17,17,17,17,30],
    E:[31,16,16,30,16,16,31],I:[14,4,4,4,4,4,14],L:[16,16,16,16,16,16,31],
    N:[17,25,25,21,19,19,17],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],
    T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14]
  };
  function stamp(label,start){
    for(const [j,letter] of [...label].entries()){
      const rows=glyph[letter];if(!rows)continue;
      for(let v=0;v<7;v++)for(let u=0;u<5;u++)if((rows[v]>>(4-u))&1){
        const x=start+j*7+u,y=108+v;
        profile[y*width+x]+=.40;profile[(height-y-1)*width+x]+=.40;
      }
    }
  }
  stamp(pickup?'ALL TERRAIN':'RADIAL',34);stamp('TUBELESS',420);
  const pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;
    const dx=(profile[y*width+(x+1)%width]-profile[y*width+(x+width-1)%width])*.87;
    const dy=(profile[Math.min(height-1,y+1)*width+x]-profile[Math.max(0,y-1)*width+x])*.81;
    const inv=1/Math.hypot(dx,dy,1);
    pixels.set([Math.round(127.5*(1-dx*inv)),Math.round(127.5*(1-dy*inv)),Math.round(127.5*(1+inv)),255],4*i);
  }
  const texture=new T.DataTexture(pixels,width,height,T.RGBAFormat);
  texture.name=pickup?'All-terrain tread':'Touring tread';texture.wrapS=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}
