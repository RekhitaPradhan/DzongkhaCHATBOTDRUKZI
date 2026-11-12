// DRUKZI document module. Everything runs in the browser: files are never uploaded anywhere.
// extract() needs a browser; chunk() and retrieve() are pure and also run inside worker.js.
export const LIM={size:15e6,files:6,pages:300,ocrPages:15};
export const OK=/./; // any file is tried; unreadable ones give a clear error
const CDN='https://cdn.jsdelivr.net/npm/',PDF=CDN+'pdfjs-dist@4.10.38/build/';
const LIBS={mammoth:CDN+'mammoth@1.8.0/mammoth.browser.min.js',XLSX:CDN+'xlsx@0.18.5/dist/xlsx.full.min.js',JSZip:CDN+'jszip@3.10.1/dist/jszip.min.js',Tesseract:CDN+'tesseract.js@5.1.1/dist/tesseract.min.js'};
const lib=(k)=>window[k]?Promise.resolve(window[k]):new Promise((ok,no)=>{const s=document.createElement('script');s.src=LIBS[k];s.onload=()=>ok(window[k]);s.onerror=()=>no(new Error('Could not load the '+k+' reader (internet needed once).'));document.head.append(s)});
const dec=(t)=>t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

// Pure helpers (testable without a browser)
export async function pptxSlides(JSZip,buf){const z=await JSZip.loadAsync(buf);
 const names=Object.keys(z.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>a.match(/\d+/)[0]-b.match(/\d+/)[0]).slice(0,200);
 const out=[];for(const n of names){const x=await z.file(n).async('string');
  const t=[...x.matchAll(/<a:p[ >][\s\S]*?<\/a:p>/g)].map(p=>[...p[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>m[1]).join('')).filter(Boolean).join('\n');
  out.push({n:+n.match(/\d+/)[0],u:'slide ',text:dec(t)})}
 return out}
export function sheets(XLSX,buf){const wb=XLSX.read(buf,{type:'array',cellDates:true});
 return wb.SheetNames.map(n=>({n:null,text:'# Sheet: '+n+'\n'+XLSX.utils.sheet_to_csv(wb.Sheets[n]).split('\n').slice(0,5000).join('\n')}))}
const rtf=(t)=>t.replace(/\\par[d]?/g,'\n').replace(/\{\\\*[^}]*\}/g,'').replace(/\\'[0-9a-f]{2}/gi,'').replace(/\\[a-z]+-?\d* ?/gi,'').replace(/[{}]/g,'');

const OLL='http://localhost:11434',OVISION='gemma3:4b';
export async function shrink(f,m,q=.85){const b=await createImageBitmap(f),k=Math.min(1,m/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);c.getContext('2d').drawImage(b,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q)}
const VPREF=['qwen2.5vl','gemma3','moondream','llava-phi3','minicpm-v','llava']; // small to mid vision models that run on 8 GB RAM, best first
export const pickVision=(names)=>{names=names.filter(n=>!/gemma3:(1b|270m)/.test(n));for(const p of VPREF){const n=names.find(x=>x.startsWith(p));if(n)return n}return null};
const VPROMPT='Analyse this image for a student assistant. 1) Transcribe ALL visible text, code and error messages exactly, line by line. 2) Write any mathematical expression exactly as shown. 3) For charts and tables give the title, axes, series and every value you can read. 4) For diagrams and flowcharts list each component and each arrow or relationship. 5) For photographs list objects, people, actions and setting. Write [unreadable] for anything you cannot read. Never guess.';
async function vision(file){ // the real picture goes to a local Ollama vision model; it never leaves your computer
 const tg=await fetch(OLL+'/api/tags',{signal:AbortSignal.timeout(1500)}).then(r=>r.json()).catch(()=>null);
 if(!tg)throw new Error('Ollama is not running (start it with: ollama serve).');
 const vm=pickVision((tg.models||[]).map(m=>m.name));if(!vm)throw new Error('No vision model installed (run: ollama pull moondream, or qwen2.5vl:3b, or gemma3:4b).');
 const b64=(await shrink(file,1536)).split(',')[1];
 const r=await fetch(OLL+'/api/chat',{method:'POST',signal:AbortSignal.timeout(300000),body:JSON.stringify({model:vm,stream:false,keep_alive:'10m',options:{temperature:0.1,num_predict:700,num_ctx:4096},messages:[{role:'user',content:VPROMPT,images:[b64]}]})});
 if(!r.ok)throw new Error('Vision model failed: '+(await r.text()).slice(0,200));const t=(await r.json()).message.content.trim();if(!t)throw new Error('Vision model returned nothing.');return {text:t,model:vm}}
let cap;async function caption(file){const {pipeline}=await import(CDN+'@huggingface/transformers@3.5.1');cap??=await pipeline('image-to-text','Xenova/vit-gpt2-image-captioning');const u=URL.createObjectURL(file);try{return (await cap(u))[0].generated_text}finally{URL.revokeObjectURL(u)}}
async function ocr(sources,prog){ // sources: Blob or canvas list. English + Tibetan-script (Dzongkha) models, downloaded once.
 const T=await lib('Tesseract'),lg={logger:(m)=>m.status==='recognizing text'&&prog(m.progress)},w=await T.createWorker('eng+bod',1,lg).catch(()=>T.createWorker('eng',1,lg)),out=[];
 try{for(const s of sources)out.push((await w.recognize(s)).data.text)}finally{await w.terminate()}
 return out}

export async function extract(file,prog=()=>{}){
 if(!file.size)throw new Error('The file is empty.');
 if(file.size>LIM.size)throw new Error('File is too large (max 15 MB).');
 const ext=(file.name.split('.').pop()||'').toLowerCase(),pages=[];let thumb=null,note='';
 if(ext==='pdf'){
  const pdfjs=await import(PDF+'pdf.min.mjs');
  // A cross-origin worker is blocked by browsers, so load it through a same-origin blob.
  pdfjs.GlobalWorkerOptions.workerSrc=URL.createObjectURL(await (await fetch(PDF+'pdf.worker.min.mjs')).blob());
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  for(let i=1;i<=Math.min(pdf.numPages,LIM.pages);i++){
   const t=await (await pdf.getPage(i)).getTextContent();let s='',y=null;
   for(const it of t.items){if(y!==null&&Math.abs(it.transform[5]-y)>2)s+='\n';else if(s&&!/\s$/.test(s))s+=' ';s+=it.str;y=it.transform[5]}
   pages.push({n:i,text:s});prog(i/pdf.numPages/2)}
  if(pages.map(p=>p.text).join('').trim().length<20){ // scanned PDF: render pages and read them with OCR
   const n=Math.min(pdf.numPages,LIM.ocrPages),cv=[];
   for(let i=1;i<=n;i++){const pg=await pdf.getPage(i),vp=pg.getViewport({scale:2}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;cv.push(c)}
   pages.length=0;(await ocr(cv,(p)=>prog(.5+p/2))).forEach((t,i)=>pages.push({n:i+1,text:t}));
   if(pdf.numPages>n)pages.push({n:null,text:'(Only the first '+n+' pages were read with OCR.)'})}
 }else if(ext==='docx'){
  const m=await lib('mammoth'),d=new DOMParser().parseFromString((await m.convertToHtml({arrayBuffer:await file.arrayBuffer()})).value,'text/html');
  pages.push({n:null,text:[...d.body.children].map(e=>/^H[1-6]$/.test(e.tagName)?'# '+e.textContent:e.tagName==='TABLE'?[...e.rows].map(r=>[...r.cells].map(c=>c.textContent.trim()).join(' | ')).join('\n'):e.textContent).join('\n')});
 }else if(ext==='pptx'){pages.push(...await pptxSlides(await lib('JSZip'),await file.arrayBuffer()));
 }else if(['xlsx','xlsm','xls','ods'].includes(ext)){pages.push(...sheets(await lib('XLSX'),await file.arrayBuffer()));
 }else if(/^(png|jpe?g|gif|webp|bmp|tiff?)$/.test(ext)||file.type.startsWith('image/')){
  thumb=URL.createObjectURL(file);
  const [o,v]=await Promise.allSettled([ocr([file],prog),vision(file)]); // printed text (OCR) + a description of the picture (local vision model)
  const t=o.status==='fulfilled'?o.value[0]:'';let dsc='',vis='none',why=v.status==='rejected'?String(v.reason?.message||v.reason):'';if(v.status==='fulfilled'){dsc=v.value.text;vis=v.value.model}else{dsc=await caption(file).then(x=>'Basic automatic caption (small model, may be wrong): '+x).catch(()=>'');if(dsc)vis='caption'}
  if(t.trim().length<3&&!dsc)throw new Error('Could not read this image. '+why+' To describe photos and artwork, run "ollama pull gemma3:4b" and keep Ollama running. Reading printed text needs internet once for the OCR reader.');
  note=vis==='none'?'No vision model analysed this picture, only its text was read. '+why:vis==='caption'?'Only a basic caption was made. '+why:'';pages.push({n:null,text:(dsc?'# Image analysis by '+(vis==='caption'?'a basic captioner':vis)+'\n'+dsc+'\n':'')+(t.trim().length>=3?'# Text read by OCR'+(dsc?'':' only (no vision model)')+'\n'+t:'')});
 }else if(ext==='doc'||ext==='ppt')throw new Error('Old .'+ext+' files cannot be read. Save it as .'+ext+'x and upload again.');
 else{const b=new Uint8Array(await file.slice(0,4096).arrayBuffer());
  if(b.includes(0))throw new Error('This file type is not readable as text or a known document format.');
  const t=await file.text();
  if(/^(html?|xml)$/.test(ext)){const d=new DOMParser().parseFromString(t,'text/html');d.querySelectorAll('script,style').forEach(e=>e.remove());
   pages.push({n:null,text:[...d.body.querySelectorAll('h1,h2,h3,p,li,tr,pre,td')].map(e=>/^H/.test(e.tagName)?'# '+e.textContent:e.textContent.trim()).join('\n')||d.body.textContent})}
  else pages.push({n:null,text:ext==='rtf'?rtf(t):t})}
 prog(1);if(!pages.some(p=>p.text.trim()))throw new Error('No readable text found.');
 return {name:file.name,size:file.size,pages,thumb,note};
}

const PLAIN=/^[A-Z][A-Za-z0-9&\-]*(?: [A-Za-z0-9&\-]+){0,5}$/; // short title-like line = heading even without # or numbering
const HEAD=/^(?:#{1,3}\s+.+|(?:\d+(?:\.\d+)*[.)]\s+|(?:chapter|section|part|question|q|task|exercise)\s*\d+\b).{0,70})$/i;
export function chunk(doc){const out=[];let h='';
 for(const pg of doc.pages){let buf='';const flush=()=>{if(buf.trim())out.push({d:doc.name,p:pg.n,u:pg.u,h,t:buf.trim()});buf=''};
  for(const raw of pg.text.split(/\n+/)){const l=raw.trim();if(!l)continue;
   if(l.length<80&&(HEAD.test(l)||PLAIN.test(l))&&!/[.,;]$/.test(l)){flush();h=l.replace(/^#+\s*/,'')}
   if(buf.length+l.length>900)flush();buf+=l+'\n'}
  flush()}
 return out}

const STOP=new Set('the a an and or of to in on for is are was were be it this that with as at by from what which who how do does did can you i me my please about give tell explain document documents uploaded'.split(' '));
const tok=(s)=>(s.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>!STOP.has(w)).map(w=>w.replace(/(?<=.{4})(ing|ed|es|s)$/,''));
function bm25(ch,q){const N=ch.length,tf=ch.map(c=>{const m={};tok(c.t+' '+c.h).forEach(w=>m[w]=(m[w]||0)+1);return m});
 const len=tf.map(m=>Object.values(m).reduce((a,b)=>a+b,0)),avg=len.reduce((a,b)=>a+b,0)/N||1,qs=[...new Set(tok(q))],df={};
 qs.forEach(w=>df[w]=tf.filter(m=>m[w]).length);
 return ch.map((c,i)=>{let s=0;for(const w of qs){const f=tf[i][w]||0;if(f)s+=Math.log(1+(N-df[w]+.5)/(df[w]+.5))*f*2.2/(f+1.2*(.25+.75*len[i]/avg))}return s})}

const BROAD=/summar|\bimages?\b|picture|photo|describe|edit|proofread|rewrite|rephrase|grammar|correct|overview|explain (this|the|my)|main (topics|points)|compare|differen|similar|study notes|\bnotes\b|quiz|flashcard|practice|multiple.choice|\bmcq|key (terms|concepts)|definitions|revision|assignment/i;
// Returns the passages to show the model and the user. Each hit keeps its file, page and heading so references are never invented.
export function retrieve(chunks,en,raw=''){
 if(!chunks.length)return {hits:[],ctx:'',broad:false};
 const q=en+' '+raw,broad=BROAD.test(q),sc=bm25(chunks,q),pick=new Set();
 const qn=en.match(/\b(?:question|q|part|section|exercise|task)\s*#?(\d+)/i);
 const pn=en.match(/\bpages?\s*#?(\d+)/i);if(pn)chunks.forEach((c,i)=>{if(c.p==+pn[1])pick.add(i)});
 if(qn){const re=new RegExp('^\\s*(?:question|q|task|exercise|part)?\\s*'+qn[1]+'\\s*[.):\\-]','im');
  chunks.forEach((c,i)=>{if(re.test(c.t)){pick.add(i);if(chunks[i+1]?.d===c.d)pick.add(i+1)}})}
 sc.map((s,i)=>[s,i]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,broad?3:4).forEach(x=>pick.add(x[1]));
 if(broad){const names=[...new Set(chunks.map(c=>c.d))],per=Math.max(2,Math.ceil(8/names.length));
  for(const n of names){const ix=chunks.map((c,i)=>c.d===n?i:-1).filter(i=>i>=0),step=Math.max(1,Math.floor(ix.length/per));
   for(let k=0;k<ix.length&&k<per*step;k+=step)pick.add(ix[k])}}
 const ix=[...pick];if(broad)ix.sort((a,b)=>a-b);const hits=ix.slice(0,broad?8:5).map(i=>chunks[i]);
 const ctx=hits.map((c,i)=>`[${i+1}] ${c.d}${c.p?', '+(c.u||'p.')+c.p:''}${c.h?', '+c.h:''}\n${c.t}`).join('\n\n');
 return {hits,ctx,broad};
}
