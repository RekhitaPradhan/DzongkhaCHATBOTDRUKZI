"""Local helper for DRUKZI: fast NLLB translation (CTranslate2 int8) + MMS Dzongkha TTS. Listens on localhost only."""
import json,io,wave,numpy as np,ctranslate2,transformers
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
NLLB='facebook/nllb-200-distilled-600M'
mt=ctranslate2.Translator('nllb-ct2',device='cpu',compute_type='int8',intra_threads=0)
toks={};tts=None
def tk(src):
    if src not in toks: toks[src]=transformers.AutoTokenizer.from_pretrained(NLLB,src_lang=src)
    return toks[src]
def translate(text,src,tgt):
    t=tk(src);src_t=t.convert_ids_to_tokens(t.encode(text))
    r=mt.translate_batch([src_t],target_prefix=[[tgt]],beam_size=1,repetition_penalty=1.3,no_repeat_ngram_size=3,
        max_decoding_length=min(200,len(text.split())*8+16))
    return t.decode(t.convert_tokens_to_ids(r[0].hypotheses[0][1:]),skip_special_tokens=True)
def speak(text):
    global tts
    import torch
    if tts is None: tts=(transformers.VitsModel.from_pretrained('facebook/mms-tts-dzo'),transformers.AutoTokenizer.from_pretrained('facebook/mms-tts-dzo'))
    m,t=tts
    with torch.no_grad(): w=m(**t(text,return_tensors='pt')).waveform[0].numpy()
    b=io.BytesIO();f=wave.open(b,'wb');f.setnchannels(1);f.setsampwidth(2);f.setframerate(m.config.sampling_rate)
    f.writeframes((np.clip(w,-1,1)*32767).astype('int16').tobytes());f.close();return b.getvalue()
class H(BaseHTTPRequestHandler):
    def _c(self,code,ct,body):
        self.send_response(code);self.send_header('Content-Type',ct);self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Headers','*');self.send_header('Cross-Origin-Resource-Policy','cross-origin')
        self.end_headers();self.wfile.write(body)
    def do_OPTIONS(self):self._c(204,'text/plain',b'')
    def do_GET(self):self._c(200,'text/plain',b'ok')
    def do_POST(self):
        d=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        try:
            if self.path=='/translate':self._c(200,'application/json',json.dumps({'text':translate(d['text'],d['src'],d['tgt'])}).encode())
            elif self.path=='/tts':self._c(200,'audio/wav',speak(d['text']))
            else:self._c(404,'text/plain',b'')
        except Exception as e:
            print('ERR',e);self._c(500,'text/plain',str(e).encode())
print('DRUKZI helper on http://localhost:8000');ThreadingHTTPServer(('127.0.0.1',8000),H).serve_forever()
