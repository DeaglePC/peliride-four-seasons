import * as T from 'three';
import meadow from '../assets/traffic/reflections/meadow.webp';
import grove from '../assets/traffic/reflections/grove.webp';
import shore from '../assets/traffic/reflections/shore.webp';
import dunes from '../assets/traffic/reflections/dunes.webp';
import valley from '../assets/traffic/reflections/valley.webp';
import metro from '../assets/traffic/reflections/metro.webp';
import peaks from '../assets/traffic/reflections/peaks.webp';
import polar from '../assets/traffic/reflections/polar.webp';
import rain from '../assets/traffic/reflections/rain.webp';
import ruralNight from '../assets/traffic/reflections/rural-night.webp';
import metroNight from '../assets/traffic/reflections/metro-night.webp';
import polarNight from '../assets/traffic/reflections/polar-night.webp';

const daylight=[meadow,grove,shore,dunes,valley,metro,peaks,polar];

// These panoramic probes were captured at vehicle height on the actual route.
// The square-root log encoding preserves dim window reflections and bright lamps.
export function createTrafficReflections(renderer,apply){
  const cache=new Map(),loading=new Set(),failed=new Set(),linear=new Uint16Array(256);
  for(let i=0;i<256;i++)linear[i]=T.DataUtils.toHalfFloat(2**(4*(i/255)**2)-1);
  const pmrem=new T.PMREMGenerator(renderer),one=T.DataUtils.toHalfFloat(1);
  let current=null,next=null,alpha=0,requested=null;
  function evict(){
    for(const [key,target] of cache){
      if(cache.size<=3)break;
      if(key===current||key===next||key===requested)continue;
      target.dispose();cache.delete(key);
    }
  }
  function load(key){
    if(loading.has(key)||failed.has(key))return;
    loading.add(key);
    const image=new Image();
    image.onload=()=>{
      loading.delete(key);
      if(requested!==key)return;
      const {width,height}=image,canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const rgb=context.getImageData(0,0,width,height).data,pixels=new Uint16Array(rgb.length);
      for(let i=0;i<rgb.length;i+=4){
        pixels[i]=linear[rgb[i]];pixels[i+1]=linear[rgb[i+1]];pixels[i+2]=linear[rgb[i+2]];pixels[i+3]=one;
      }
      const map=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.HalfFloatType);
      map.flipY=true;map.mapping=T.EquirectangularReflectionMapping;map.needsUpdate=true;
      const filtered=pmrem.fromEquirectangular(map);map.dispose();cache.set(key,filtered);evict();
    };
    image.onerror=()=>{loading.delete(key);failed.add(key)};
    image.src=key;
  }
  return function update(distance,night,wet,weather,dt){
    const leg=Math.min(7,Math.max(0,Math.floor(distance/520)));
    requested=daylight[leg];
    if(night>.55)requested=leg===5?metroNight:(weather==='aurora'||leg===7)?polarNight:ruralNight;
    else if(wet>.65&&leg!==5&&leg<6)requested=rain;
    if(!cache.has(requested))load(requested);
    if(!current&&cache.has(requested)){
      current=requested;apply(cache.get(current).texture,cache.get(current).texture,0);
    }
    if(!next&&requested!==current&&cache.has(requested)){next=requested;alpha=0;}
    if(!next)return;
    alpha=Math.min(1,alpha+Math.max(.001,dt)*1.6);
    apply(cache.get(current).texture,cache.get(next).texture,alpha*alpha*(3-2*alpha));
    if(alpha===1){
      current=next;next=null;
      apply(cache.get(current).texture,cache.get(current).texture,0);evict();
    }
  };
}
