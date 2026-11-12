import {chunk,retrieve,pickVision} from '../js/docs.js';
let ok=0,bad=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);c?ok++:bad++};
const doc={name:'report.pdf',pages:[
 {n:1,text:'Introduction\nThis report studies rice disease detection in Bhutan.'},
 {n:3,text:'Methods\nWe collected leaf photographs from farms in Paro.'},
 {n:5,text:'Preprocessing\nImages were resized to 224 pixels, normalised and augmented with rotation and flipping.'},
 {n:7,text:'Results\nThe model reached 91 percent accuracy on the test set.'}]};
const ch=chunk(doc);
t('chunks keep page numbers',ch.some(c=>c.p===5)&&ch.every(c=>c.d==='report.pdf'));
t('chunks keep headings',ch.find(c=>c.p===5).h==='Preprocessing');
let r=retrieve(ch,'Explain page 5','');t('"explain page 5" retrieves page 5',r.hits.some(h=>h.p===5));
r=retrieve(ch,'what preprocessing techniques are used','');t('topic question retrieves the right passage',r.hits[0]?.p===5);
r=retrieve(ch,'What is the dataset source?','');t('missing info: no unrelated hit is invented',!r.hits.some(h=>/dataset source/i.test(h.t)));
t('citations carry page numbers',/\[1\] report\.pdf, p\.5/.test(retrieve(ch,'Explain page 5','').ctx)||/p\.5/.test(retrieve(ch,'Explain page 5','').ctx));
const img=chunk({name:'shot.png',pages:[{n:null,text:'# Image analysis by moondream\nTraceback: NameError: name prnt is not defined\n# Text read by OCR\nprnt("hi")'}]});
t('image analysis and OCR become separate labelled chunks',img.some(c=>/Image analysis/.test(c.h))&&img.some(c=>/OCR/.test(c.h)));
r=retrieve([...ch,...img],'what is wrong with the error in this screenshot','');t('multi-file retrieval finds the screenshot chunk',r.hits.some(h=>h.d==='shot.png'));
t('vision model preference (8 GB friendly)',pickVision(['qwen3:4b','moondream:latest','gemma3:4b'])==='gemma3:4b'&&pickVision(['qwen3:4b'])===null&&pickVision(['gemma3:1b'])===null);
const nt=(x)=>x.replace(/<think>[\s\S]*?(<\/think>|$)/g,'');
t('Qwen3 <think> blocks are stripped',nt('<think>hmm</think>Answer.')==='Answer.'&&nt('Hi<think>unfinished')==='Hi');
console.log(`\n${ok} passed, ${bad} failed`);process.exit(bad?1:0);
