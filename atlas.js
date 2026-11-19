import {seasonPhotos} from './photography.js';
export const seasons=[
  {name:'春日',en:'SPRING',bg:'#dee9ce',sky:'#c8dbc6',far:'#acc5a4',near:'#7eaa76',dark:'#487551'},
  {name:'盛夏',en:'SUMMER',bg:'#d9eae6',sky:'#c0e2e4',far:'#8cc5c1',near:'#60aaa5',dark:'#387b7b'},
  {name:'金秋',en:'AUTUMN',bg:'#f2dfbf',sky:'#f2dbb2',far:'#d9bb8f',near:'#c98e52',dark:'#96683e'},
  {name:'凛冬',en:'WINTER',bg:'#dfe8ef',sky:'#cedee8',far:'#aec3d3',near:'#8faabf',dark:'#5e7a92'}
];
export const stops=[
 ['高山花甸','ALPINE MEADOWS',18],['春樱林道','BLOSSOM WOODS',16],['蔚蓝海岸','AZURE COAST',27],['金色沙海','AMBER DUNES',34],
 ['枫林山谷','MAPLE VALLEY',14],['都市天际线','CITY SKYLINE',12],['雪峰垭口','SNOWY SUMMIT',-4],['极光北境','AURORA PASS',-12]
];
export const weatherOptions={auto:['随路线变化','route'],sun:['晴朗','sun'],rain:['阵雨','rain'],wind:['大风','wind'],snow:['降雪','snow'],night:['星夜','moon'],rainNight:['雨夜','rain'],aurora:['极光','spark']};
export const outfits={coast:['海岸骑手','青绿头盔 · 珊瑚红围巾','#dce9d8','#d87251','helmet'],alpine:['高山旅人','绒球针织帽 · 保暖马甲','#eee1d3','#a74843','mountain'],night:['夜航骑士','反光护目镜 · 亮黄围巾','#dbe3e8','#294e61','moon']};
const paths={
 expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/>',
 bike:'<circle cx="5.5" cy="17" r="4"/><circle cx="18.5" cy="17" r="4"/><path d="m6 17 4-9 5 9H6m4-9h5m0-4h2l2 13M7 7h4"/>',
 shirt:'<path d="m8 4-6 4 3 5 3-2v10h8V11l3 2 3-5-6-4c-1.5 2.5-6.5 2.5-8 0Z"/>',
 map:'<path d="m2 6 6-3 8 3 6-3v15l-6 3-8-3-6 3V6Zm6-3v15m8-12v15"/>',
 sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8q4 4 0 8m3-11q7 7 0 14"/>',
 muted:'<path d="M3 9h4l5-4v14l-5-4H3zM17 9l5 6m0-6-5 6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5.3.3c0 1.8-2.8 2.4-2.8 4M12 16.5h.01"/>',
 play:'<path d="M6 3.5v17l14-8.5z" fill="currentColor" stroke-linejoin="round"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1m0-15.6-2.1 2.1M6.3 17.7l-2.1 2.1"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',check:'<path d="m5 12 4 4 10-10"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.5"/>',
 pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',route:'<circle cx="5" cy="18" r="2.1"/><circle cx="19" cy="6" r="2.1"/><path d="M7 18h8a3.5 3.5 0 0 0 0-7h-6a3 3 0 0 1 0-6h7"/>',
 x:'<path d="m6 6 12 12M18 6 6 18"/>',rain:'<path d="M5 14a4 4 0 0 1 .7-8 6 6 0 0 1 11.1.6A3.8 3.8 0 0 1 19 14M8 16l-1 3m6-3-1 3m6-3-1 3"/>',
 wind:'<path d="M3 8h11a3 3 0 1 0-3-3M2 12h16a3 3 0 1 1-3 3M4 16h4a3 3 0 1 1-3 3"/>',
 snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3m-6 16 3-3 3 3M4 10l4-1-1-4m10 14-1-4 4-1m-16 0 4 1-1 4M17 5l-1 4 4 1"/>',
 moon:'<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
 spark:'<path d="m12 2 2.1 6.8L21 11l-6.9 2.2L12 20l-2.2-6.8L3 11l6.8-2.2zM20 16v5m-2.5-2.5h5"/>',
 left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',brake:'<path d="M3 8h18M3 12h18M3 16h18"/>',boost:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
 mountain:'<path d="m2 20 9-16 11 16zm5-9 4 3 3-5"/>',helmet:'<path d="M3 14a9 9 0 1 1 18 0l-6 1-4 6H7l2-7zm7-8-1 4m5-5-1 5"/>'
};
export function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||'')+'</svg>'}
export function stamp(canvas,index){
 const img=new Image();img.onload=()=>{
  const c=canvas.getContext('2d'),w=canvas.width=560,h=canvas.height=152;
  const u=[.51,.58,.48,.82][index],v=[.69,.70,.72,.69][index];
  const crop=img.width*.29,high=crop*h/w;
  c.drawImage(img,u*img.width-crop/2,Math.min(img.height-high,Math.max(0,v*img.height-high/2)),crop,high,0,0,w,h);
  const shade=c.createLinearGradient(0,0,w,0);shade.addColorStop(0,'rgba(8,17,18,.80)');shade.addColorStop(.60,'rgba(9,20,21,.21)');shade.addColorStop(1,'rgba(15,27,26,.04)');c.fillStyle=shade;c.fillRect(0,0,w,h);
 };img.src=seasonPhotos[index];
}
