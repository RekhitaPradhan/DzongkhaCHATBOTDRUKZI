import {extract,chunk,LIM,shrink} from './docs.js';
// DRUKZI front end: chat UI, conversation storage, message actions and the Explore panel.
// Model work (translation, answers and image analysis) lives in worker.js.
const $=(i)=>document.getElementById(i);const K='drukzi.chats';
let chats=JSON.parse(localStorage.getItem(K)||'[]'),cur=null,ready=false,started=false,queued=null,wd;
const save=()=>localStorage.setItem(K,JSON.stringify(chats));
const worker=new Worker('js/worker.js',{type:'module'});
const SUG=[['📎 Upload a document and ask questions',''],['📝 Help me understand my assignment',''],['ཁྱོད་ག་དེ་སྦེ་ཡོད?','How are you?'],['Tell me about Bhutan.',''],['Teach me Dzongkha.',''],['འབྲུག་གི་སྐོར་ལས་ཤོད།','Tell me about Bhutan.']];
const TOPIC_GROUPS={
  "🇧🇹 Bhutan": [
    "Tell me about Bhutan.",
    "What is the capital of Bhutan?",
    "Who is the current King of Bhutan?",
    "Who was the fourth King of Bhutan?",
    "What is Gross National Happiness?",
    "Why is Bhutan called the Land of the Thunder Dragon?",
    "What is the national language of Bhutan?",
    "What currency is used in Bhutan?",
    "What is the national animal of Bhutan?",
    "What is the national bird of Bhutan?",
    "What is the national flower of Bhutan?",
    "What is the national tree of Bhutan?",
    "What is the national sport of Bhutan?",
    "How many districts are there in Bhutan?",
    "What are the main geographical regions of Bhutan?",
    "Tell me about the history of Bhutan.",
    "When did Bhutan become a democracy?",
    "What is the Constitution of Bhutan?",
    "What are the main responsibilities of the King?",
    "What is the role of the National Assembly?"
  ],
  "🏛 Places & culture": [
    "Tell me about Paro Taktsang (Tiger's Nest).",
    "Tell me about Punakha Dzong.",
    "What is a dzong?",
    "What is the meaning of the Bhutanese flag?",
    "What is the national day of Bhutan?",
    "What is Tshechu?",
    "Why do Bhutanese people wear gho and kira?",
    "What are traditional Bhutanese foods?",
    "How is ema datshi prepared?",
    "What is Bhutanese archery?",
    "What is a traditional Bhutanese mask dance?",
    "What is the significance of prayer flags?",
    "What is a chorten?",
    "Tell me about the Bumthang valleys.",
    "What is special about Phobjikha Valley?",
    "What is the significance of Dochula Pass?",
    "What are some famous festivals in Bhutan?",
    "What are Bhutanese traditional values?",
    "What is Zorig Chusum?",
    "What are the main languages spoken in Bhutan?"
  ],
  "🌍 World & geography": [
    "What is the largest country in the world?",
    "What is the smallest country in the world?",
    "Which continent has the most countries?",
    "What are the seven continents?",
    "What are the five oceans?",
    "What is the highest mountain in the world?",
    "How are mountains formed?",
    "What is the difference between weather and climate?",
    "What causes earthquakes?",
    "What causes volcanoes to erupt?",
    "What is the water cycle?",
    "Why do we have seasons?",
    "What is the equator?",
    "What is the difference between latitude and longitude?",
    "What is a desert?",
    "What is the Amazon rainforest?",
    "What is the Great Barrier Reef?",
    "Why is the Himalayas important?",
    "What is a glacier?",
    "How do rivers form?"
  ],
  "🔬 Science & nature": [
    "What is photosynthesis?",
    "How does the human heart work?",
    "What are the main parts of a cell?",
    "What is DNA?",
    "What is gravity?",
    "What is energy?",
    "What is the difference between mass and weight?",
    "How does electricity work?",
    "What are atoms and molecules?",
    "What is the periodic table?",
    "What is climate change?",
    "What is biodiversity?",
    "Why are bees important?",
    "How do plants breathe?",
    "What is the solar system?",
    "Why does the Moon change shape?",
    "What causes day and night?",
    "What is an ecosystem?",
    "What is the difference between renewable and non-renewable energy?",
    "How does the human brain work?"
  ],
  "💻 Technology & AI": [
    "What is artificial intelligence?",
    "How does machine learning work?",
    "What is deep learning?",
    "What is a neural network?",
    "What is generative AI?",
    "What is a chatbot?",
    "How does the internet work?",
    "What is cloud computing?",
    "What is cybersecurity?",
    "How can I create a website?",
    "What is Python programming?",
    "What is a database?",
    "What is data science?",
    "What is natural language processing?",
    "What is computer vision?",
    "What is an algorithm?",
    "What is a large language model?",
    "What are the benefits and risks of AI?",
    "How do search engines work?",
    "What is the difference between software and hardware?"
  ],
  "📚 Education & everyday learning": [
    "Explain mathematics in simple terms.",
    "How do I improve my study habits?",
    "What is critical thinking?",
    "What is research methodology?",
    "How do I write a good introduction?",
    "How do I prepare for an examination?",
    "What is the difference between a thesis and a hypothesis?",
    "What is statistics?",
    "What is a mean, median and mode?",
    "What is correlation?",
    "What is regression analysis?",
    "What is probability?",
    "What is a business model?",
    "What is entrepreneurship?",
    "What is marketing?",
    "What is financial literacy?",
    "How do I make a good presentation?",
    "How do I write a professional email?",
    "Can you explain a difficult topic step by step?",
    "Can you help me understand a picture or screenshot?"
  ]
};
const TOPICS=Object.entries(TOPIC_GROUPS).flatMap(([category,qs])=>qs.map(q=>[category,q]));
const PH=[{dz:'སྐུ་གཟུགས་བཟང་པོ་ལགས།',tr:'Kuzuzangpo la',en:'Hello'},{dz:'བཀའ་དྲིན་ཆེ་ལགས།',tr:'Kadrinche la',en:'Thank you'},{dz:'བཀྲ་ཤིས་བདེ་ལེགས།',tr:'Tashi delek',en:'Good luck and blessings'}];
// Pictures shown under an answer when its text mentions the topic. Real photos in assets/photos/ win; illustrations are the fallback.
const IMGS=[
 {re:/flag/i,src:'assets/flag.svg',cap:'Flag of Bhutan (illustration)'},
 {re:/taktsang|tiger/i,src:'assets/photos/tigers-nest.jpg',fb:'assets/mountains.svg',cap:"Paro Taktsang, the Tiger's Nest"},
 {re:/punakha|dzong\b/i,src:'assets/photos/punakha-dzong.jpg',fb:'assets/dzong.svg',cap:'A Bhutanese dzong (illustration)'},
 {re:/himalaya|gangkhar|mountain/i,src:'assets/mountains.svg',cap:'The Himalayas (illustration)'},
 {re:/thunder dragon|druk yul/i,src:'assets/dragon.jpg',cap:'Druk, the Thunder Dragon'}];
const GALLERY=[{src:'assets/dragon.jpg',cap:'Druk, the Thunder Dragon'},{src:'assets/flag.svg',cap:'Flag of Bhutan (illustration)'},{src:'assets/photos/tigers-nest.jpg',fb:'assets/mountains.svg',cap:"Paro Taktsang, the Tiger's Nest"},{src:'assets/photos/punakha-dzong.jpg',fb:'assets/dzong.svg',cap:'Punakha Dzong'},{src:'assets/photos/thimphu.jpg',cap:'Thimphu'}];

const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const act=(label,fn,title)=>{const b=el('button','act',label);b.type='button';if(title)b.title=title;b.onclick=fn;return b};
const busy=()=>!!$('pending');
const hasDz=(s)=>/[\u0F00-\u0FFF]/.test(s);

function newChat(){cur={id:Date.now(),title:'New conversation',msgs:[]};chats.unshift(cur);save();render()}

function render(){syncDocs();
 const q=$('search').value.trim().toLowerCase();
 const shown=chats.filter(c=>!q||c.title.toLowerCase().includes(q)||c.msgs.some(m=>m.text.toLowerCase().includes(q)||(m.en||'').toLowerCase().includes(q)));
 $('list').replaceChildren(...shown.map(c=>{
  const d=el('div',c===cur?'on':'');d.append(el('span','t',c.title));
  d.append(act('✎',(e)=>{e.stopPropagation();const n=prompt('Rename conversation',c.title);if(n&&n.trim()){c.title=n.trim().slice(0,60);save();render()}},'Rename'),
   act('✕',(e)=>{e.stopPropagation();if(!confirm('Delete this conversation?'))return;chats=chats.filter(x=>x!==c);if(!chats.length)return newChat();if(c===cur)cur=chats[0];save();render()},'Delete'));
  d.onclick=()=>{cur=c;render();$('side').classList.remove('open')};return d}));
 const m=$('msgs');m.replaceChildren();
 if(!cur.msgs.length){const w=el('div','welcome');
  w.innerHTML='<img class="hero" src="assets/dragon.jpg" alt="Golden Bhutanese dragon"><h1>DRUKZI</h1><h2 class="dz">སྐུ་གཟུགས་བཟང་པོ་ལགས།</h2><p class="en">Hello (Kuzuzangpo la)</p><p>Your Smart Dzongkha AI Assistant</p><div class="chips"></div>';
  SUG.forEach(([t,e])=>{const b=el('button','',t);if(hasDz(t)){b.className='dz';if(e)b.append(el('small','',e))}b.onclick=()=>/^[📎📝]/u.test(t)?$('file').click():send(t);w.querySelector('.chips').append(b)});m.append(w);return}
 cur.msgs.forEach((x,i)=>add(x,i))}

function pictureFor(x){if(x.role!=='assistant'||!x.en)return null;return IMGS.find(p=>p.re.test(x.en))||null}
function picture(p){const f=el('figure','pic'),i=el('img');i.alt=p.cap;i.loading='lazy';i.src=p.src;
 i.onerror=()=>{if(p.fb&&!i.src.endsWith(p.fb)){i.src=p.fb}else f.remove()};i.onclick=()=>lightbox(i.src,p.cap);
 f.append(i,el('figcaption','',p.cap));return f}

function add(x,i){
 const user=x.role==='user',d=el('div','m '+(user?'u':'a'));d.textContent=x.text;
 const e=(x.en&&x.en!==x.text?x.en:'')||(user&&x.enIn&&hasDz(x.text)?x.enIn:'');
 if(e)d.append(el('small','en','English: '+e));
 if(x.imgs?.length){const g=el('div','thumbs');x.imgs.forEach((s)=>{const i=el('img');i.src=s;i.alt='Attached image';i.onclick=()=>lightbox(s,'Attached image');g.append(i)});d.append(g)}
 const p=pictureFor(x);if(p)d.append(picture(p));
 if(x.src?.length)d.append(srcBlock(x.src));
 if(i!=null){const row=el('div','acts');
  if(user)row.append(act('✎ Edit',()=>editMsg(i,d),'Edit and resend'));
  row.append(act('⧉ Copy',(ev)=>copy(x,ev.currentTarget),'Copy text'));
  if(!user&&x.en&&i===cur.msgs.length-1)row.append(act('↻ Regenerate',regenerate,'Ask again'));
  d.append(row)}
 $('msgs').append(d);d.scrollIntoView({block:'end'});return d}

function copy(x,b){const t=x.text+(x.en&&x.en!==x.text?'\nEnglish: '+x.en:'');
 (navigator.clipboard?.writeText(t)||Promise.reject()).then(()=>{b.textContent='✓ Copied';setTimeout(()=>b.textContent='⧉ Copy',1200)}).catch(()=>{b.textContent='Copy failed'})}

// Edit a sent message: everything after it is dropped and the edited text is sent again.
function editMsg(i,d){
 if(busy())return;
 const ta=el('textarea','edit');ta.value=cur.msgs[i].text;ta.rows=Math.min(6,Math.max(2,Math.ceil(ta.value.length/40)));
 const go=()=>{const t=ta.value.trim();if(!t)return;cur.msgs.length=i;if(i===0)cur.title='New conversation';send(t)};
 const row=el('div','acts');row.append(act('Save & resend',go),act('Cancel',render));
 d.replaceChildren(ta,row);ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
 ta.onkeydown=(ev)=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();go()}if(ev.key==='Escape')render()}}

function regenerate(){if(busy()||!ready)return;
 const i=cur.msgs.map(m=>m.role).lastIndexOf('user');if(i<0)return;const t=cur.msgs[i].text;cur.msgs.length=i;if(i===0)cur.title='New conversation';send(t)}

function start(){if(started)return;started=true;$('loader').hidden=false;worker.postMessage({type:'load'});
 if(location.protocol==='file:')$('ltxt').textContent='⚠ index.html was opened as a file. Run "npx serve ." and open http://localhost:3000 instead.';
 clearTimeout(wd);wd=setTimeout(()=>{if(!ready&&/Preparing|file/.test($('ltxt').textContent))$('ltxt').textContent='Still starting after 10 s: the worker has not answered. Open the browser console (F12) to see the error.'},10000)}
function send(t){t=t.trim();if(!t)return;const ims=curDocs().filter(d=>d.small&&!d.shown);ims.forEach(d=>d.shown=true);cur.msgs.push({role:'user',text:t,imgs:ims.map(d=>d.small)});if(cur.title==='New conversation')cur.title=t.slice(0,40);
 const history=cur.msgs.slice(0,-1).filter(m=>m.enIn||m.en).slice(-6).map(m=>m.role==='user'?{role:'user',content:m.enIn}:{role:'assistant',content:m.en});
 render();const p=add({role:'assistant',text:''});p.classList.add('dots');p.id='pending';save();
 const im=curDocs().filter(d=>d.b64).map(d=>d.b64).slice(-3),cid=cur.id,job=()=>worker.postMessage({type:'chat',id:cid,text:t,history,images:im});if(ready)job();else{queued=job;start();$('status').textContent='Loading models… will answer when ready'};$('in').value='';$('in').dispatchEvent(new Event('input'))}

worker.onerror=(e)=>{started=false;$('loader').hidden=false;$('ltxt').textContent='The model worker failed to start: '+(e.message||'open the browser console with F12')+'. Open DRUKZI at http://localhost:3000 (run: npx serve .), not as a file.';$('status').textContent='Worker failed'};
worker.onmessage=({data:d})=>{
 if(d.type==='stage'){$('status').textContent=d.text;$('ltxt').textContent=d.text}
 if(d.type==='progress'&&d.pct!=null){$('lbar').style.width=d.pct+'%';$('ltxt').textContent=`Downloading ${d.file.split('/').pop()} ${Math.round(d.pct)}%`}
 if(d.type==='ready'){ready=true;if(queued){const j=queued;queued=null;setTimeout(j)};$('loader').hidden=true;$('status').textContent=d.msg||'Ready'}
 if(d.type==='chunk'){const p=$('pending');if(p){p.classList.remove('dots');p.textContent=d.dz}}
 if(d.type==='reply'){const c=chats.find(x=>x.id===d.id)||cur,u=[...c.msgs].reverse().find(m=>m.role==='user');if(u)u.enIn=d.userEn;
  c.msgs.push({role:'assistant',text:d.dz,en:d.en,src:d.src});save();render();$('status').textContent='Ready';
 }
 if(d.type==='error'){{const p=$('pending');if(p){p.removeAttribute('id');p.classList.remove('dots');p.textContent='⚠ '+d.text;p.append(el('br'),act('↻ Retry',regenerate,'Try again'))}}if(!ready){started=false;queued=null;$('loader').hidden=true}$('status').textContent='Error: '+d.text}};
// ---- Export, lightbox ----
function exportChat(){if(!cur.msgs.length)return;
 const t=cur.msgs.map(m=>(m.role==='user'?'You: ':'DRUKZI: ')+m.text+(m.en?'\nEnglish: '+m.en:m.enIn&&hasDz(m.text)?'\nEnglish: '+m.enIn:'')).join('\n\n');
 const a=el('a');a.href=URL.createObjectURL(new Blob([cur.title+'\n\n'+t],{type:'text/plain;charset=utf-8'}));
 a.download='drukzi-'+cur.title.replace(/[^\w]+/g,'-').slice(0,30)+'.txt';a.click();URL.revokeObjectURL(a.href)}
function lightbox(s,c){const l=$('lb');l.querySelector('img').src=s;l.querySelector('figcaption').textContent=c;l.hidden=false}
$('lb').onclick=()=>{$('lb').hidden=true};

// ---- Explore panel ----
let facts=['Bhutan measures progress by Gross National Happiness, not only by GDP.','The Tiger\'s Nest monastery clings to a cliff about 3,120 metres above sea level.','Thimphu is famous for having no traffic lights.'],fi=0,pi=0;
const showFact=()=>{$('fact').textContent=facts[fi=Math.floor(Math.random()*facts.length)]};
fetch('docs/facts.json').then(r=>r.json()).then(f=>{if(f.length)facts=f.map(x=>x.t)}).catch(()=>{}).finally(showFact);
const showPh=()=>{const p=PH[pi%PH.length];$('phDz').textContent=p.dz;$('phEn').textContent=`${p.tr}: ${p.en}`};
$('phNext').onclick=()=>{pi++;showPh()};
$('nextFact').onclick=showFact;
Object.entries(TOPIC_GROUPS).forEach(([category,qs])=>{const box=el('details','topic-group');box.append(el('summary','',category+' · '+qs.length));const list=el('div','tchips');qs.forEach(q=>{const b=el('button','ghost sm',q);b.type='button';b.onclick=()=>{tab(false);send(q)};list.append(b)});box.append(list);$('topics').append(box)});
GALLERY.forEach(p=>{const i=el('img');i.alt=p.cap;i.title=p.cap;i.loading='lazy';i.src=p.src;
 i.onerror=()=>{if(p.fb&&!i.src.endsWith(p.fb))i.src=p.fb;else i.remove()};i.onclick=()=>lightbox(i.src,p.cap);$('gallery').append(i)});
showPh();

// ---- Documents (kept in memory only, per conversation; never uploaded) ----
const docs=new Map(),fmt=(n)=>n>1e6?(n/1e6).toFixed(1)+' MB':Math.ceil(n/1e3)+' KB';
const curDocs=()=>docs.get(cur.id)||[];
function syncDocs(){worker.postMessage({type:'docs',chunks:curDocs().flatMap(d=>d.chunks||[])});renderFiles()}
function srcBlock(s){const web=s.some(x=>x.url);const b=el('details','src');b.open=true;b.append(el('summary','',web?'World reference sources':'From your documents (extracted text)'));
 s.forEach(x=>{const r=el('div','sr');r.append(el('b','',x.d+(x.p?' · '+(x.u||'p.')+x.p:'')+(x.h?' · '+x.h:'')),el('span','',' '+x.t+(x.t.length>=260?'…':'')));if(x.url){const a=el('a','','Open source');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';r.append(a)}b.append(r)});
 b.append(el('small','note',web?'Retrieved live from Wikipedia. Check the linked page and date for important or changing facts.':'The answer above is generated from these passages and can be wrong. Check the source.'));return b}
function renderFiles(){const l=curDocs();$('files').replaceChildren(...l.map(d=>{
  const c=el('div','chip'+(d.err?' bad':''));if(d.thumb){const im=el('img','th');im.src=d.thumb;im.alt='';c.append(im)}c.append(el('span','',(d.err?'⚠ ':d.thumb?'':'📄 ')+d.name+' · '+fmt(d.size)+' · '+(d.err||(d.chunks?d.pages+(d.pages?' pp, ':' ')+d.chunks.length+' passages · ✓ Ready'+(d.note?' · ⚠ '+d.note:''):(d.st||'Processing')+' '+Math.round(d.pct*100)+'%'))));
  const x=act('✕',()=>{docs.set(cur.id,curDocs().filter(y=>y!==d));syncDocs()},'Remove this file');c.append(x);if(d.err&&d.file)c.append(act('↻ Retry',()=>{docs.set(cur.id,curDocs().filter(y=>y!==d));addFiles([d.file])},'Try this file again'));return c}));
 if(l.length)$('files').append(act('Clear all',()=>{docs.delete(cur.id);syncDocs()},'Remove all files from this conversation'));
 const ok=l.some(d=>d.chunks);$('study').hidden=!ok;
 if(ok&&!$('study').children.length)[['Summarize','Summarize the uploaded documents.'],['Describe image','Describe the uploaded image in detail.'],['Proofread','Proofread the uploaded text and list the corrections.'],['Rewrite','Rewrite the uploaded text in clearer language.'],['Explain simply','Explain the uploaded document in simple language.'],['Key terms','List the key terms and definitions from the documents.'],['Quiz','Create 5 multiple-choice questions from the documents.'],['Flashcards','Create flashcards from the documents.'],['Study notes','Write study notes from the documents.'],['Compare','Compare the main topics of the documents.']].forEach(([a,q])=>{const b=el('button','ghost sm',a);b.type='button';b.onclick=()=>{if(!busy())send(q)};$('study').append(b)})}
const attach=async(d,f)=>{if(/^image\//.test(f.type))try{d.b64=(await shrink(f,1024)).split(',')[1];d.small=await shrink(f,240)}catch{}};
async function addFiles(fl){if(!cur)return;let l=docs.get(cur.id)||[];docs.set(cur.id,l);start();
 for(const f of fl){if(l.length>=LIM.files){$('status').textContent='Up to '+LIM.files+' files per conversation.';break}
  if(l.some(d=>d.name===f.name&&d.size===f.size))continue;const d={name:f.name,size:f.size,pct:0,file:f,st:/^image\//.test(f.type)?'Analyzing image':'Reading document'};l.push(d);renderFiles();
  const isImage=/^image\//.test(f.type);if(isImage)await attach(d,f);
   try{const r=await extract(f,(p)=>{d.pct=p;renderFiles()});d.thumb=r.thumb||d.small;d.note=r.note;d.pages=r.pages.length>1||r.pages[0].n?r.pages.length:0;d.chunks=chunk(r);if(!d.chunks.length&&!isImage)throw new Error('No readable text found.');if(!d.chunks.length&&isImage)d.note='Image attached. Ask a question about the picture.'}
   catch(e){if(isImage&&d.b64){d.chunks=[];d.thumb=d.small;d.note='Image attached. OCR was unavailable; image understanding needs a local vision model.'}else d.err=String(e.message||e)}
  syncDocs()}
 $('file').value=''}
$('attach').onclick=()=>$('file').click();$('file').onchange=()=>addFiles([...$('file').files]);
for(const ev of['dragenter','dragover'])addEventListener(ev,(e)=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();$('drop').hidden=false}});
addEventListener('dragleave',(e)=>{if(!e.relatedTarget)$('drop').hidden=true});
addEventListener('drop',(e)=>{e.preventDefault();$('drop').hidden=true;addFiles([...e.dataTransfer.files])});
// Enter sends, Shift+Enter adds a line; the box grows with the text.
$('in').onkeydown=(e)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('f').requestSubmit()}};
$('in').oninput=()=>{$('in').style.height='auto';$('in').style.height=Math.min(160,$('in').scrollHeight)+'px'};
// ---- Controls ----
$('f').onsubmit=(e)=>{e.preventDefault();send($('in').value)};$('new').onclick=newChat;$('export').onclick=exportChat;
$('search').oninput=render;$('menu').onclick=()=>$('side').classList.toggle('open');
const tab=(x)=>{$('chatsPane').hidden=x;$('explore').hidden=!x;$('tChats').classList.toggle('on',!x);$('tExplore').classList.toggle('on',x)};
$('tChats').onclick=()=>tab(false);$('tExplore').onclick=()=>tab(true);$('rtoggle').onclick=()=>{tab(true);$('side').classList.add('open')};
$('theme').onclick=()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='light'?'':'light';localStorage.setItem('drukzi.theme',r.dataset.theme)};
$('clearAll').onclick=()=>{if(confirm('Delete all conversations from this browser?')){chats=[];save();newChat()}};
addEventListener('keydown',(e)=>{if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();$('in').focus()}if(e.key==='Escape')$('lb').hidden=true});
document.documentElement.dataset.theme=localStorage.getItem('drukzi.theme')||'';
chats.length?(cur=chats[0],render()):newChat();
start(); // begin loading at page open, not on first click
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
