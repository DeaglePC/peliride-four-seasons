import {createWorld} from './world.js';
import {seasons,stops,weatherOptions,outfits,icon,stamp} from './atlas.js';
import {rideAudio} from './audio.js';
import {grade} from './elevation.js';
import {crashMotion,crashRootTravel,crashRollProgress} from './models/crash-motion.js';
import panoramaCredits from './assets/panorama/credits.txt';
import plantingCredits from './assets/nature/credits.txt';
import birdCredits from './assets/rider/CREDITS.txt';
import vehicleCredits from './assets/traffic/credits.txt';
const $=id=>document.getElementById(id),app=$('app'),panel=$('panel'),body=$('panel-body'),audio=rideAudio(),length=4160;
const read=(k,f)=>{try{return localStorage.getItem('peliride.'+k)||f}catch{return f}};
function save(k,v){try{localStorage.setItem('peliride.'+k,v)}catch{}}
const state={mode:'home',distance:0,offset:0,speed:0,targetSpeed:0,lane:0,steer:0,brake:false,routeIndex:0,weather:'sun',cam:0,wardrobe:false,crash:null,grace:0,fishCount:0,fishLane:null};
let world,dialogName='',weatherSetting='auto',costume=read('outfit','coast'),sound=false,health=3,passed=0,near=0,ridden=0,rideSeconds=0,resumeMode=null,startingAt=0,noteTimer,done=false,autoWeatherTag='';
if(!outfits[costume])costume='coast';
const held=new Set(),laneWidth=3.1,weatherSchedule=[['sun','wind'],['rain','sun'],['sun','wind'],['wind','night'],['sun','wind'],['rainNight','night'],['snow','sun'],['night','aurora']];
function paintIcons(scope=document){scope.querySelectorAll('i[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon))}
function setIcon(el,name){el.dataset.icon=name;el.innerHTML=icon(name)}
function notice(msg){let el=$('notice');el.textContent=msg;el.classList.add('on');clearTimeout(noteTimer);noteTimer=setTimeout(()=>el.classList.remove('on'),2100)}
function setMode(v){state.mode=v;app.dataset.state=v}
function updateHud(){
 $('speed').textContent=Math.round(state.speed*3.6);$('mileage').textContent=(state.distance/1000).toFixed(2)+' km';$('hearts').textContent='♥ '.repeat(health)+'♡ '.repeat(3-health);$('hearts').setAttribute('aria-label','剩余体力 '+health);$('meter-fill').style.width=Math.min(100,state.distance/length*100)+'%';
 $('fish-readout').hidden=state.routeIndex!==2;
 $('fish-count').textContent='接鱼 '+state.fishCount;
 $('fish-lane').textContent=state.fishLane===null?'':['去左道','走中道','去右道'][state.fishLane+1];
}
function syncLocation(announce=false){
 const n=Math.min(7,Math.floor(state.distance/520)),d=state.distance-n*520,old=state.routeIndex;state.routeIndex=n;
 app.toggleAttribute('data-seaside',n===2);
 const zone=weatherSchedule[n][d>=280?1:0],weather=weatherSetting==='auto'?zone:weatherSetting;const changed=weather!==state.weather;state.weather=weather;
 if(old!==n||!autoWeatherTag){$('location-en').textContent=stops[n][1];$('location-cn').textContent=stops[n][0];document.querySelectorAll('.season-card').forEach((el,i)=>{el.classList.toggle('active',i===Math.floor(n/2));el.setAttribute('aria-pressed',i===Math.floor(n/2))})}
 if(changed||old!==n||!autoWeatherTag){$('weather-text').textContent=weatherOptions[weather][0];setIcon($('weather-symbol'),weatherOptions[weather][1]);$('temperature').textContent=(stops[n][2]+({rain:-4,rainNight:-7,wind:-2,snow:-4,night:-6,aurora:-5}[weather]||0))+'°'}
 if(announce&&old!==n)notice(seasons[Math.floor(n/2)].name+' · '+stops[n][0]);else if(announce&&changed)notice(weatherOptions[weather][0]+'路段');
 autoWeatherTag=zone;
}
function jump(index){
 if(state.crash&&state.mode!=='result'){
  if(!state.crash.recover)return;
  state.crash=null;state.speed=4.5;
  if(state.mode==='crash')setMode('ride');
  if(resumeMode==='crash')resumeMode='ride';
 }
 state.distance=index*520;state.lane=0;state.offset=0;state.steer=0;state.grace=0;state.fishLane=null;world?.reset(state.distance);syncLocation();updateHud();notice('已到达 · '+stops[index][0]);
}
function start(){
 if(!world)return;
 if(dialogName)closePanel(false);if(state.mode==='result')jump(startingAt);
 startingAt=Math.floor(state.distance/520);health=3;passed=0;near=0;ridden=0;rideSeconds=0;done=false;state.crash=null;state.grace=0;state.brake=false;state.steer=0;state.lane=0;state.offset=0;state.speed=7;state.cam=0;state.fishCount=0;state.fishLane=null;world.reset(state.distance);held.clear();setMode('ride');updateHud();audio.bell();notice(state.routeIndex===2?'看海面水花，骑进提示车道接鱼':matchMedia('(pointer:coarse)').matches?'左右切换车道，避开车流':'A / D 变道　·　W 加速　·　S 刹车');
}
function finish(reached){done=reached;held.clear();state.speed=0;setMode('result');let best=Number(read('best','0'));if(ridden>best)save('best',Math.floor(ridden));if(reached)audio.finish();openPanel('result')}
function beginCrash(impact,previousDistance,previousOffset){
 const overshoot=(state.distance-previousDistance)*(1-impact.fraction);
 state.distance-=overshoot;ridden-=overshoot;
 state.offset=previousOffset+(state.offset-previousOffset)*impact.fraction;
 const severity=Math.max(0,Math.min(1,(impact.closingSpeed-3)/19));
 health--;held.clear();
 const motion=crashMotion(state.speed,severity,impact.headOn);
 state.crash={elapsed:0,side:impact.side,severity,headOn:impact.headOn,speed:state.speed,motion,recover:health>0,origin:state.offset,
  travelScale:Math.min(1,(length-state.distance)/motion.totalDistance)};
 state.fishLane=null;
 state.speed*=impact.headOn?.16:.38;state.steer=0;state.brake=false;
 setMode('crash');syncLocation();updateHud();audio.hit(severity);
 notice(health?'撞车翻倒 · 剩余 '+health+' 格体力':'撞车翻倒 · 体力耗尽');
}
function advanceCrash(dt){
 const fall=state.crash,previous=fall.elapsed;fall.elapsed+=dt;rideSeconds+=dt;
 state.speed*=Math.exp(-dt*4.5);if(state.speed<.12)state.speed=0;
 const motion=fall.motion;
 const slide=(crashRootTravel(motion,fall.elapsed,fall.recover)-crashRootTravel(motion,previous,fall.recover))*fall.travelScale;
 state.distance=Math.min(length,state.distance+slide);ridden+=slide;
 if(Math.min(7,Math.floor(state.distance/520))!==state.routeIndex)syncLocation();
 const drift=(1-Math.exp(-fall.elapsed*5))*(.52+.35*fall.severity);
 state.offset=Math.max(-4.15,Math.min(4.15,fall.origin+fall.side*drift));
 if(previous<motion.landTime&&fall.elapsed>=motion.landTime)audio.scrape(fall.severity);
 const turns=crashRollProgress(motion,fall.elapsed)*motion.rolls;
 if(Math.floor(turns+.46)>Math.floor(crashRollProgress(motion,previous)*motion.rolls+.46)){
  audio.tumble((.45+.55*motion.pace)*(1-.65*turns/motion.rolls));
 }
 if(fall.elapsed<(fall.recover?motion.endTime:motion.restTime+.48))return;
 if(!fall.recover){finish(false);return}
 state.crash=null;state.grace=1.65;state.lane=Math.max(-1,Math.min(1,Math.round(state.offset/laneWidth)));
 state.speed=4.5;held.clear();
 if(state.distance>=length){finish(true);return}
 setMode('ride');updateHud();notice('已扶正，可以继续骑行');
}
const h=(name)=>'<i data-icon="'+name+'">'+icon(name)+'</i>';
function routeMini(canvas){const c=canvas.getContext('2d');canvas.width=800;canvas.height=176;
 c.fillStyle='#e8eddc';c.fillRect(0,0,800,176);
 for(let j=0;j<22;j++){c.beginPath();for(let x=0;x<=810;x+=5){let y=18+j*8+Math.cos(x/76+j*.28)*11+Math.sin(x/40+j*.18)*4;if(!x)c.moveTo(x,y);else c.lineTo(x,y)}c.strokeStyle=j%3?'#d4dfc9':'#c9d8bc';c.lineWidth=1;c.stroke()}
 const points=[[56,108],[147,62],[252,76],[350,39],[450,75],[551,126],[660,90],[750,50]];c.lineCap='round';c.lineJoin='round';
 for(const [color,w] of [['#fcfaf0',11],['#718e69',4]]){c.strokeStyle=color;c.lineWidth=w;c.beginPath();points.forEach(([x,y],i)=>{if(!i)c.moveTo(x,y);else{const [px,py]=points[i-1];c.bezierCurveTo(px+50,py+12,x-45,y-16,x,y)}});c.stroke()}
 points.forEach(([x,y],i)=>{c.beginPath();c.fillStyle=i===state.routeIndex?'#234d35':'#fffbee';c.strokeStyle='#456b4c';c.lineWidth=3;c.arc(x,y,i===state.routeIndex?11:6,0,7);c.fill();c.stroke()})
}
function panelContent(name){
 const title={map:['ROUTE ATLAS','四季路书'],wardrobe:['CYCLING WARDROBE','骑行衣橱'],weather:['WEATHER','天气与时光'],help:['RIDER GUIDE','操作指南'],pause:['RIDE PAUSED','骑行已暂停'],result:['RIDE JOURNAL',done?'抵达终点':'本次骑行结束']}[name];$('panel-en').textContent=title[0];$('panel-title').textContent=title[1];
 if(name==='map'){body.innerHTML='<canvas id="route-map" class="route-map" aria-label="八段环线路线图"></canvas><div class="route-options">'+stops.map((s,i)=>'<button class="option '+(i===state.routeIndex?'chosen':'')+'" data-stop="'+i+'"><span class="num">'+String(i+1).padStart(2,'0')+'</span><span><b>'+s[0]+'</b><small>'+seasons[Math.floor(i/2)].name+' · '+(i*.52).toFixed(2)+' km</small></span></button>').join('')+'</div>';routeMini($('route-map'))}
 if(name==='wardrobe'){body.innerHTML='<div class="outfits">'+Object.entries(outfits).map(([id,[label,note,bg,fg,sym]])=>'<button class="outfit '+(id===costume?'chosen':'')+'" aria-pressed="'+(id===costume)+'" data-outfit="'+id+'"><span class="swatch" style="--sw:'+bg+';--color:'+fg+'">'+h(sym)+'</span><span><strong>'+label+'</strong><small>'+note+'</small></span>'+(id===costume?'<span class="tick">'+h('check')+'</span>':'')+'</button>').join('')+'</div><button class="panel-cta" data-action="close">穿好了</button>'}
 if(name==='weather'){body.innerHTML='<div class="weather-options">'+Object.entries(weatherOptions).map(([id,[label,sym]])=>'<button class="option '+(id===weatherSetting?'chosen':'')+'" aria-pressed="'+(id===weatherSetting)+'" data-weather="'+id+'">'+h(sym)+'<b>'+label+'</b></button>').join('')+'</div>'}
 if(name==='help'){body.innerHTML='<div class="keys">'+[['向左 / 向右变道',['A','D','←','→']],['加速 / 刹车',['W','S','↑','↓']],['切换第三人称机位',['C']],['沉浸模式',['F']],['按车铃',['B']],['暂停 / 继续',['空格']],['打开路书',['M']]].map(([label,keys])=>'<div><span>'+label+'</span><span class="keycaps">'+keys.map(k=>'<kbd>'+k+'</kbd>').join('')+'</span></div>').join('')+'</div><p class="panel-note">沿公路骑至极光北境。擦身越过车辆可以累积近距闪避。撞到车辆会翻车，失去一格体力。骑得越快，鹈鹕被甩得越远，落地后还会翻滚。有体力时会扶车继续。在蔚蓝海岸，跟着水花和车道提示迎上跃起的鱼，鹈鹕会张嘴接住。触屏可使用画面下方的四个骑行按钮。</p>'}
 if(name==='help'){
  const sources=document.createElement('details'),title=document.createElement('summary'),copy=document.createElement('pre');
  sources.className='sources';title.textContent='摄影、模型与材质来源';copy.textContent=[panoramaCredits,plantingCredits,birdCredits,vehicleCredits].join('\n\n');sources.append(title,copy);body.append(sources);
 }
 if(name==='pause'){body.innerHTML='<div class="score-row"><span>当前位置</span><b>'+stops[state.routeIndex][0]+' · '+(state.distance/1000).toFixed(2)+' km</b></div><button class="panel-cta" data-action="close">继续骑行</button><button class="secondary" data-action="home">返回起点</button>'}
 if(name==='result'){body.innerHTML='<div class="scores">'+[['本次里程',(ridden/1000).toFixed(2)+' km'],['骑行用时',Math.floor(rideSeconds/60)+' 分 '+Math.floor(rideSeconds%60)+' 秒'],['避开车辆',passed+' 辆'],['近距闪避',near+' 次'],['海岸接鱼',state.fishCount+' 条'],['最佳里程',(Number(read('best','0'))/1000).toFixed(2)+' km']].map(([a,b])=>'<div class="score-row"><span>'+a+'</span><b>'+b+'</b></div>').join('')+'</div><button class="panel-cta" data-action="again">再骑一次</button><button class="secondary" data-action="home">回到首页</button>'}
}
function navMark(name){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.action===(['map','wardrobe'].includes(name)?name:'ride')))}
function openPanel(name){
 if(dialogName===name)return;if(!dialogName){resumeMode=['ride','crash'].includes(state.mode)?state.mode:null;if(resumeMode)setMode('pause');held.clear()}
 state.wardrobe=name==='wardrobe';app.classList.toggle('wearing',state.wardrobe);dialogName=name;navMark(name);panelContent(name);if(!panel.open)panel.showModal();
}
function closePanel(resume=true){
 const wasResult=dialogName==='result';dialogName='';state.wardrobe=false;app.classList.remove('wearing');if(panel.open)panel.close();navMark('ride');if(resume&&resumeMode&&state.mode==='pause')setMode(resumeMode);resumeMode=null;if(wasResult&&resume)home();
}
function home(){closePanel(false);setMode('home');state.crash=null;state.speed=0;state.cam=0;held.clear();jump(0);$('notice').classList.remove('on')}
function changeLane(dir){if(state.mode==='ride'){state.lane=Math.max(-1,Math.min(1,state.lane+dir))}}
function act(value){
 switch(value){
  case 'immersive':{const v=app.classList.toggle('immersive');document.querySelector('[data-action=immersive]').setAttribute('aria-pressed',String(v));break}
  case 'start':start();break;case 'again':closePanel(false);jump(startingAt);start();break;case 'home':home();break;
  case 'ride':if(dialogName)closePanel();else if(state.mode==='home')start();break;case 'close':closePanel();break;
  case 'map':case 'wardrobe':case 'weather':case 'help':case 'pause':openPanel(value);break;
  case 'camera':state.cam=(state.cam+1)%3;notice((state.mode==='home'?['旅行机位','追随远景','侧后近景']:['追随近景','追随远景','侧后近景'])[state.cam]);break;
  case 'sound':sound=!sound;audio.on(sound);const button=document.querySelector('[data-action=sound]');button.setAttribute('aria-label',sound?'关闭声音':'开启声音');button.title=button.getAttribute('aria-label');setIcon(button.querySelector('i'),sound?'sound':'muted');break;
 }
}
function bootUI(){
 $('seasons').innerHTML=seasons.map((s,i)=>'<button aria-label="跳到'+s.name+'" class="season-card" style="--bg:'+s.bg+'" data-season="'+i+'"><canvas aria-hidden="true"></canvas><small>'+s.en+'</small><strong>'+s.name+'</strong><span class="sel">'+icon('check')+'</span></button>').join('');
 document.querySelectorAll('.season-card canvas').forEach((c,i)=>stamp(c,i));paintIcons();syncLocation();
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset;if(a.action)act(a.action);else if(a.season!==undefined)jump(Number(a.season)*2);else if(a.stop!==undefined){jump(Number(a.stop));closePanel()}else if(a.weather){weatherSetting=a.weather;syncLocation();closePanel();notice(a.weather==='auto'?'天气随路段自动变化':weatherOptions[a.weather][0])}else if(a.outfit){costume=a.outfit;save('outfit',costume);world?.outfit(costume);panelContent('wardrobe');body.querySelector('[data-outfit="'+costume+'"]').focus()}});
 panel.addEventListener('cancel',e=>{e.preventDefault();closePanel()});panel.addEventListener('click',e=>{if(e.target===panel){let r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel()}});
 document.querySelectorAll('[data-touch]').forEach(b=>{const key=b.dataset.touch;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(key==='left'||key==='right')changeLane(key==='left'?-1:1);else held.add(key)});for(let event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>held.delete(key))});
 window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;let k=e.key.toLowerCase();
  if(dialogName){if(!e.repeat&&k===' '&&dialogName==='pause'){e.preventDefault();closePanel()}return}
  if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k))e.preventDefault();if(e.repeat)return;
  if(k==='a'||k==='arrowleft')changeLane(-1);if(k==='d'||k==='arrowright')changeLane(1);if(k==='w'||k==='arrowup')held.add('boost');if(k==='s'||k==='arrowdown')held.add('brake');
  if(k===' '){if(state.mode==='home')start();else if(['ride','crash'].includes(state.mode))openPanel('pause')}if(k==='escape'&&['ride','crash'].includes(state.mode))openPanel('pause');if(k==='f')act('immersive');if(k==='c')act('camera');if(k==='m')openPanel('map');if(k==='b'){if(!sound)act('sound');audio.bell();notice('叮铃！')}
 });
 window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(['w','arrowup'].includes(k))held.delete('boost');if(['s','arrowdown'].includes(k))held.delete('brake')});
 window.addEventListener('blur',()=>held.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden&&['ride','crash'].includes(state.mode))openPanel('pause')});
}
bootUI();
try{world=createWorld($('scene'));world.outfit(costume);world.reset(0)}catch(e){const err=$('world-error');err.textContent='三维场景加载失败。请在启用硬件加速的 Chrome 或 Edge 中打开。';err.hidden=false;document.querySelector('.start').disabled=true;console.error(e)}
let previous=performance.now(),time=0,lastHud=-1;
function frame(now){
 const dt=Math.max(0,Math.min((now-previous)/1000,.1));previous=now;if(!world)return;
 const riding=state.mode==='ride',crashing=state.mode==='crash',previousDistance=state.distance,previousOffset=state.offset;
 if(riding||crashing||state.mode==='home'||state.wardrobe)time+=dt;
 if(riding){
  state.brake=held.has('brake');const target=state.brake?3.4:(held.has('boost')?18.6:12.5)-grade(state.distance)*15;
  state.targetSpeed=target;
  state.speed+=(target-state.speed)*(1-Math.exp(-dt*(state.brake?2.9:.9)));const delta=Math.min(length-state.distance,state.speed*dt);state.distance+=delta;ridden+=delta;rideSeconds+=dt;
  const gust=state.weather==='wind'?Math.sin(time*1.8)*.19:0,aim=state.lane*laneWidth+gust,diff=aim-state.offset;state.offset+=diff*(1-Math.exp(-dt*6.3));state.steer+=(Math.max(-1,Math.min(1,diff*.6))-state.steer)*(1-Math.exp(-dt*10));state.grace=Math.max(0,state.grace-dt);
  syncLocation(true);
 }else if(crashing)advanceCrash(dt);
 const e=world.draw(state,dt,time);
 if(riding){
  passed+=e.passed;
  state.fishLane=e.fishLane;
  if(e.caught){state.fishCount++;audio.catchFish();notice('接住了！本次已接住 '+state.fishCount+' 条鱼');updateHud()}
  if(e.impact)beginCrash(e.impact,previousDistance,previousOffset);
  else if(state.distance>=length)finish(true);
  else if(e.nearMiss){near++;notice('近距闪避！')}
 }
 audio.update(state.speed,state.weather,state.mode==='ride'||state.mode==='crash',e.audible);if((riding||crashing)&&now-lastHud>100){updateHud();lastHud=now}requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
