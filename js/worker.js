// Inference worker: Dzongkha/English -> English LLM -> Dzongkha. All local, no external AI APIs.
import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';
env.allowLocalModels=true;env.localModelPath=new URL('../models/',import.meta.url).href;
const post=(m)=>self.postMessage(m);let llm,mt,tts,local=false;const SRV='http://localhost:8000',OLL='http://localhost:11434',OMODEL='qwen2.5:3b';
const up=(u)=>fetch(u,{signal:AbortSignal.timeout(1500)}).then(r=>r.ok).catch(()=>false);
const progress=(p)=>post({type:'progress',file:p.file||'',status:p.status,pct:p.progress??null});
const TIB=/[\u0F00-\u0FFF]+(?:\s+[\u0F00-\u0FFF]+)*/g;
const SYSTEM="You are DRUKZI, a friendly Bhutanese assistant. Answer in 1 to 3 short, simple, plain English sentences. When greeted, greet back and ask how you can help. Avoid idioms. If you do not know, say so honestly.";
const clean=(t)=>t.replace(/(.{1,12}?)\1{2,}/gu,'$1').trim(); // collapse runaway repetition
function brief(t){const seen=new Set(),o=[];for(const x of clean(t).split(/(?<=[.!?])\s+/)){const k=x.toLowerCase();if(x&&!seen.has(k)){seen.add(k);o.push(x)}if(o.length==2)break}return o.join(' ')}
async function tr(t,src,tgt){if(!t.trim())return t;
 if(local){const r=await fetch(SRV+'/translate',{method:'POST',body:JSON.stringify({text:t,src,tgt})});return clean((await r.json()).text)}const n=t.split(/\s+/).length;
 const o=await mt(t,{src_lang:src,tgt_lang:tgt,max_new_tokens:Math.min(200,n*8+16),no_repeat_ngram_size:3,repetition_penalty:1.3,num_beams:1});
 return clean(o[0].translation_text)}
async function toEnglish(t){const runs=t.match(TIB);if(!runs)return t;let out=t;
  for(const r of runs)out=out.replace(r,await tr(r,'dzo_Tibt','eng_Latn'));return out}
async function toDzongkha(t){const s=t.split(/(?<=[.!?])\s+/).filter(Boolean);const o=[];for(const x of s)o.push(await tr(x,'eng_Latn','dzo_Tibt'));return o.join(' ')}
async function streamLocal(msgs){ // Ollama streams tokens; each finished sentence is translated while the next is generated
 const r=await fetch(OLL+'/api/chat',{method:'POST',body:JSON.stringify({model:OMODEL,messages:msgs,stream:true,keep_alive:'30m',options:{temperature:0.6,num_predict:80,repeat_penalty:1.15}})});
 const rd=r.body.getReader(),dec=new TextDecoder();let buf='',pend='',n=0,chain=Promise.resolve();const en=[],dz=[];
 const flush=(x)=>{if(n>=2||!x.trim())return;n++;en.push(x.trim());chain=chain.then(async()=>{dz.push(await tr(x,'eng_Latn','dzo_Tibt'));post({type:'chunk',dz:dz.join(' ')})})};
 for(;;){const {done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
  while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;
   pend+=JSON.parse(line).message?.content||'';let m;while((m=pend.match(/^([\s\S]*?[.!?])\s+([\s\S]*)$/))){flush(m[1]);pend=m[2]}}}
 flush(pend);await chain;return {en:en.join(' '),dz:dz.join(' ')}}
self.onmessage=async({data:d})=>{try{
 if(d.type==='load'){
  if(await up(SRV+'/health')&&await up(OLL+'/api/tags')){local=true;fetch(OLL+'/api/generate',{method:'POST',body:JSON.stringify({model:OMODEL,keep_alive:'30m'})}).catch(()=>{});post({type:'stage',text:'Local mode: Ollama + CTranslate2'});return post({type:'ready',tts:true})}
  const gpu=!!self.navigator.gpu;post({type:'stage',text:`Loading language model (${gpu?'WebGPU':'WASM'})`});
  llm=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{dtype:gpu?'q4f16':'q8',device:gpu?'webgpu':'wasm',progress_callback:progress});
  post({type:'stage',text:'Loading Dzongkha translation model'});
  mt=await pipeline('translation','Xenova/nllb-200-distilled-600M',{dtype:'q8',progress_callback:progress});
  try{post({type:'stage',text:'Loading Dzongkha voice'});tts=await pipeline('text-to-speech','mms-tts-dzo',{dtype:'fp32',local_files_only:true})}
  catch(e){tts=null}
  post({type:'ready',tts:!!tts});}
 if(d.type==='chat'){
  post({type:'stage',text:'Understanding…'});const en=await toEnglish(d.text);
  const msgs=[{role:'system',content:SYSTEM},...d.history,{role:'user',content:en}];
  post({type:'stage',text:'Thinking…'});
  if(local){const o=await streamLocal(msgs);return post({type:'reply',id:d.id,en:o.en,dz:o.dz,userEn:en})}
  let reply;if(local){const r=await fetch(OLL+'/api/chat',{method:'POST',body:JSON.stringify({model:OMODEL,messages:msgs,stream:false,options:{temperature:0.6,num_predict:80,repeat_penalty:1.15}})});reply=brief((await r.json()).message.content)}
  else{const g=await llm(msgs,{max_new_tokens:60,do_sample:true,temperature:0.6,top_p:0.9,repetition_penalty:1.15,no_repeat_ngram_size:3});reply=brief(g[0].generated_text.at(-1).content)}
  
  post({type:'partial',en:reply});post({type:'stage',text:'Writing in Dzongkha…'});const dz=await toDzongkha(reply);
  post({type:'reply',id:d.id,en:reply,dz,userEn:en});}
 if(d.type==='tts'){ if(local){const r=await fetch(SRV+'/tts',{method:'POST',body:JSON.stringify({text:d.text})});if(!r.ok)return post({type:'tts-missing'});const buf=await r.arrayBuffer();return self.postMessage({type:'wav',buf},[buf])}
  if(!tts)return post({type:'tts-missing'});
  const a=await tts(d.text);post({type:'audio',audio:a.audio,rate:a.sampling_rate});}
}catch(e){post({type:'error',text:String(e.message||e)})}};
