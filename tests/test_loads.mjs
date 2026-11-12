// Parses every script as an ES module (what the browser does) and boots the worker with stubs. Catches errors that `node --check` misses.
import {readFileSync,writeFileSync,mkdtempSync} from 'fs';import {tmpdir} from 'os';import {execFileSync} from 'child_process';import {join} from 'path';
let bad=0;const d=mkdtempSync(join(tmpdir(),'dz-'));
for(const f of ['app','worker','docs']){const p=join(d,f+'.mjs');writeFileSync(p,readFileSync(new URL('../js/'+f+'.js',import.meta.url)));
 try{execFileSync('node',['--check',p],{stdio:'pipe'});console.log('PASS parses as module: js/'+f+'.js')}catch(e){bad++;console.log('FAIL js/'+f+'.js\n'+String(e.stderr).split('\n').slice(0,4).join('\n'))}}
const posts=[];globalThis.self=globalThis;globalThis.postMessage=(m)=>posts.push(m);globalThis.fetch=async(u)=>{u=String(u);if(u.startsWith('file:'))return {ok:true,json:async()=>JSON.parse(readFileSync(new URL(u)))};throw new Error('offline')};
try{await import('../js/worker.js');
 console.log(typeof self.onmessage==='function'?'PASS worker evaluates and registers onmessage':'FAIL no onmessage');if(typeof self.onmessage!=='function')bad++;
 await self.onmessage({data:{type:'chat',id:1,text:'hi',history:[]}});
 const r=posts.find(m=>m.type==='reply');console.log(r&&r.en?'PASS phrasebook "hi" answered by the worker':'FAIL no reply: '+JSON.stringify(posts.at(-1)));if(!r)bad++;
}catch(e){bad++;console.log('FAIL worker top level:',e.message)}
process.exit(bad?1:0);
