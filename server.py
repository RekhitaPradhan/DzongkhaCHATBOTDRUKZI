"""Local helper for DRUKZI: fast NLLB translation (CTranslate2 int8) + Dzongkha translation. Listens on localhost only."""
import time,re,threading,os,json,urllib.request,urllib.parse,ctranslate2,transformers
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
# A Dzongkha/English fine-tune based on NLLB-200. Set DRUKZI_NLLB_MODEL
# to facebook/nllb-200-distilled-600M if you need the original base model.
NLLB=os.environ.get('DRUKZI_NLLB_MODEL','kinleyrabgay/nllb-200-600M-dzo-eng-300k')
def load_mt():
    if not os.path.isdir('nllb-ct2'):
        try:
            print('Converting NLLB once (a few minutes)...')
            from ctranslate2.converters import TransformersConverter
            TransformersConverter(NLLB).convert('nllb-ct2',quantization='int8')
        except Exception as e: print('NLLB conversion failed:',e);return None
    return ctranslate2.Translator('nllb-ct2',device='cpu',compute_type='int8',intra_threads=0)
mt=load_mt()
# Optional: Dzongkha->English fine-tune (KarmaCST). Convert once into ./nllb-dz-en-ct2 (see README); otherwise base NLLB is used.
mt2=ctranslate2.Translator('nllb-dz-en-ct2',device='cpu',compute_type='int8',intra_threads=0) if os.path.isdir('nllb-dz-en-ct2') else None
print('dz->en model:','fine-tuned' if mt2 else 'base NLLB')
toks={}
def tk(src):
    if src not in toks: toks[src]=transformers.AutoTokenizer.from_pretrained(NLLB,src_lang=src)
    return toks[src]
def _tr(text,src,tgt):
    m=mt2 if (mt2 and src=='dzo_Tibt') else mt
    t=tk(src);src_t=t.convert_ids_to_tokens(t.encode(text))
    r=m.translate_batch([src_t],target_prefix=[[tgt]],beam_size=1,repetition_penalty=1.3,no_repeat_ngram_size=3,
        max_decoding_length=min(200,len(text.split())*8+16))
    return t.decode(t.convert_tokens_to_ids(r[0].hypotheses[0][1:]),skip_special_tokens=True)
CF='docs/.dz_cache.json'  # translations survive restarts, so the helper starts instantly after the first run
try: TC=json.load(open(CF,encoding='utf8'))
except Exception: TC={}
def translate(text,src,tgt):
    k=NLLB+'|'+src+'|'+tgt+'|'+text
    if k not in TC:
        TC[k]=_tr(text,src,tgt)
        if threading.current_thread().name=='prewarm': time.sleep(.3)  # leave CPU for real requests
    return TC[k]
class H(BaseHTTPRequestHandler):
    def _c(self,code,ct,body):
        self.send_response(code);self.send_header('Content-Type',ct);self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Headers','*');self.send_header('Cross-Origin-Resource-Policy','cross-origin')
        self.end_headers();self.wfile.write(body)
    def do_OPTIONS(self):self._c(204,'text/plain',b'')
    def do_GET(self):
        if self.path.startswith('/world-search'):
            try:
                q=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('q',[''])[0].strip()[:300]
                if not q: return self._c(400,'application/json',b'{\"error\":\"Missing query\"}')
                params=urllib.parse.urlencode({'action':'query','list':'search','srsearch':q,'srlimit':5,'format':'json','utf8':1})
                req=urllib.request.Request('https://en.wikipedia.org/w/api.php?'+params,headers={'User-Agent':'DRUKZI/17.0 (local educational assistant)'})
                with urllib.request.urlopen(req,timeout=12) as r: hits=json.loads(r.read().decode('utf8')).get('query',{}).get('search',[])
                pages=[]
                for h in hits[:4]:
                    title=h.get('title',''); pageid=h.get('pageid');
                    if not pageid: continue
                    ep=urllib.parse.urlencode({'action':'query','pageids':pageid,'prop':'extracts','explaintext':1,'exintro':1,'format':'json'})
                    er=urllib.request.Request('https://en.wikipedia.org/w/api.php?'+ep,headers={'User-Agent':'DRUKZI/17.0 (local educational assistant)'})
                    with urllib.request.urlopen(er,timeout=12) as rr: pg=json.loads(rr.read().decode('utf8')).get('query',{}).get('pages',{}).get(str(pageid),{})
                    extract=re.sub(r'\s+',' ',pg.get('extract','')).strip()
                    if extract: pages.append({'title':title,'text':extract[:1800],'url':'https://en.wikipedia.org/wiki/'+urllib.parse.quote(title.replace(' ','_'))})
                return self._c(200,'application/json',json.dumps({'results':pages},ensure_ascii=False).encode('utf8'))
            except Exception as e:
                return self._c(502,'application/json',json.dumps({'error':'World knowledge lookup unavailable: '+str(e)[:180]}).encode('utf8'))
        if self.path not in ('/','/health'):
            return self._c(404,'application/json',b'{}')
        self._c(200,'application/json',json.dumps({
            'helper':True,'mt':mt is not None,'translation_model':NLLB
        }).encode())
    def do_POST(self):
        d=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        try:
            if self.path=='/translate':self._c(200,'application/json',json.dumps({'text':translate(d['text'],d['src'],d['tgt'])}).encode())
            else:self._c(404,'text/plain',b'')
        except Exception as e:
            print('ERR',e);self._c(500,'text/plain',str(e).encode())
if mt: translate('Hello.','eng_Latn','dzo_Tibt')  # warm-up so the first real request is fast
def prewarm():  # translate every stored fact/phrase once at startup so answers about Bhutan appear instantly
    try:
        for f in json.load(open('docs/facts.json',encoding='utf8')):
            if not f.get('dz'):
                for x in re.split(r'(?<=[.!?])\s+',f['t']):
                    if x.strip(): translate(x,'eng_Latn','dzo_Tibt')
        for e in json.load(open('docs/phrasebook.json',encoding='utf8')):
            if not e.get('dz'): translate(e['en'],'eng_Latn','dzo_Tibt')
        json.dump(TC,open(CF,'w',encoding='utf8'),ensure_ascii=False);print('prewarm done')
    except Exception as e: print('prewarm skipped:',e)
if mt: threading.Thread(target=prewarm,name='prewarm',daemon=True).start()
print('DRUKZI helper on http://localhost:8000');ThreadingHTTPServer(('127.0.0.1',8000),H).serve_forever()
