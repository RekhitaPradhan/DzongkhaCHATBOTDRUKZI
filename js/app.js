const $=(i)=>document.getElementById(i);const K='drukzi.chats';
let chats=JSON.parse(localStorage.getItem(K)||'[]'),cur=null,ready=false,speakOn=true,ctx,src,started=false;
const save=()=>localStorage.setItem(K,JSON.stringify(chats));
const worker=new Worker('js/worker.js',{type:'module'});
const SUG=['ཁྱོད་ག་དེ་སྦེ་ཡོད?','Tell me about Bhutan.','Teach me Dzongkha.','འབྲུག་གི་སྐོར་ལས་ཤོད།'];
function newChat(){cur={id:Date.now(),title:'New conversation',msgs:[]};chats.unshift(cur);save();render()}
function render(){
 $('list').replaceChildren(...chats.map(c=>{const d=document.createElement('div');d.textContent=c.title;d.className=c===cur?'on':'';
  d.onclick=()=>{cur=c;render();$('side').classList.remove('open')};return d}));
 const m=$('msgs');m.replaceChildren();
 if(!cur.msgs.length){const w=document.createElement('div');w.className='welcome';
  w.innerHTML='<h1>DRUKZI</h1><h2 class="dz">ཀུ་ཟུ་བཟང་།</h2><p>Your Smart Dzongkha AI Assistant</p><div class="chips"></div>';
  SUG.forEach(s=>{const b=document.createElement('button');b.textContent=s;b.className='dz';b.onclick=()=>send(s);w.querySelector('.chips').append(b)});m.append(w);return}
 cur.msgs.forEach(add)}
function add(x){const d=document.createElement('div');d.className='m '+(x.role==='user'?'u':'a');d.textContent=x.text;
 if(x.en){const s=document.createElement('small');s.textContent='English source (machine-translated to Dzongkha): '+x.en;d.append(s);
  const b=document.createElement('button');b.textContent='🔊 Speak';b.onclick=()=>worker.postMessage({type:'tts',text:x.text});d.append(b)}
 $('msgs').append(d);d.scrollIntoView({block:'end'});return d}
function start(){if(started)return;started=true;$('loader').hidden=false;worker.postMessage({type:'load'})}
function send(t){t=t.trim();if(!t)return;if(!ready){$('status').textContent='Models are loading. Your message was not sent yet.';return start()}
 cur.msgs.push({role:'user',text:t});if(cur.title==='New conversation')cur.title=t.slice(0,40);
 const history=cur.msgs.slice(0,-1).filter(m=>m.enIn||m.en).slice(-8).map(m=>m.role==='user'?{role:'user',content:m.enIn}:{role:'assistant',content:m.en});
 render();const p=add({role:'assistant',text:''});p.classList.add('dots');p.id='pending';save();
 worker.postMessage({type:'chat',id:cur.id,text:t,history});$('in').value=''}
worker.onmessage=({data:d})=>{
 if(d.type==='stage'){$('status').textContent=d.text;$('ltxt').textContent=d.text}
 if(d.type==='progress'&&d.pct!=null){$('lbar').style.width=d.pct+'%';$('ltxt').textContent=`Downloading ${d.file.split('/').pop()} ${Math.round(d.pct)}%`}
 if(d.type==='ready'){ready=true;$('loader').hidden=true;$('status').textContent=d.tts?'Ready':'Ready (Dzongkha voice not installed, see README)'}
 if(d.type==='partial'){const p=$('pending');if(p){p.classList.remove('dots');p.textContent=d.en+' (translating to Dzongkha…)'}}
 if(d.type==='chunk'){const p=$('pending');if(p){p.classList.remove('dots');p.textContent=d.dz}}
 if(d.type==='reply'){const u=[...cur.msgs].reverse().find(m=>m.role==='user');if(u)u.enIn=d.userEn;
  cur.msgs.push({role:'assistant',text:d.dz,en:d.en});save();render();$('status').textContent='Ready';
  if(speakOn)worker.postMessage({type:'tts',text:d.dz})}
 if(d.type==='audio'){stop();ctx??=new AudioContext();const b=ctx.createBuffer(1,d.audio.length,d.rate);b.copyToChannel(d.audio,0);
  src=ctx.createBufferSource();src.buffer=b;src.connect(ctx.destination);src.start()}
 if(d.type==='wav'){stop();ctx??=new AudioContext();ctx.decodeAudioData(d.buf).then(b=>{src=ctx.createBufferSource();src.buffer=b;src.connect(ctx.destination);src.start()})}
 if(d.type==='tts-missing')$('status').textContent='Dzongkha voice model not installed (see README)';
 if(d.type==='error'){$('pending')?.remove();$('status').textContent='Error: '+d.text}};
function stop(){try{src?.stop()}catch{}}
$('f').onsubmit=(e)=>{e.preventDefault();send($('in').value)};$('new').onclick=newChat;$('stop').onclick=stop;
$('speak').onclick=()=>{speakOn=!speakOn;$('speak').textContent=speakOn?'🔊 On':'🔇 Off'};
$('menu').onclick=()=>$('side').classList.toggle('open');
$('theme').onclick=()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'':'dark';localStorage.setItem('drukzi.theme',r.dataset.theme)};
$('clearAll').onclick=()=>{if(confirm('Delete all conversations from this browser?')){chats=[];save();newChat()}};
document.documentElement.dataset.theme=localStorage.getItem('drukzi.theme')||'';
chats.length?(cur=chats[0],render()):newChat();
$('in').addEventListener('focus',start,{once:true});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
