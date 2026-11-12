"""Live end-to-end check (needs Ollama + Pillow). Proves a real image reaches the vision model and its findings reach Qwen3."""
import json,base64,io,sys,urllib.request as u
O='http://localhost:11434'
def post(b):return json.load(u.urlopen(u.Request(O+'/api/chat',json.dumps(b).encode()),timeout=400))['message']['content']
try:tags=[m['name'] for m in json.load(u.urlopen(O+'/api/tags',timeout=3))['models']]
except Exception as e:sys.exit('FAIL Ollama not reachable: '+str(e))
print('installed:',tags)
txt=next((n for n in tags if n.startswith('qwen3')),None)
vis=next((n for p in ['qwen2.5vl','gemma3','moondream','llava-phi3','minicpm-v'] for n in tags if n.startswith(p) and not n.startswith('gemma3:1b')),None)
if not txt:sys.exit('FAIL no Qwen3 model: ollama pull qwen3:4b')
if not vis:sys.exit('FAIL no vision model: ollama pull moondream')
try:from PIL import Image,ImageDraw,ImageFont
except ImportError:sys.exit('pip install pillow')
def shot(lines):
    try:f=ImageFont.load_default(size=30)
    except TypeError:f=ImageFont.load_default()
    im=Image.new('RGB',(900,60+50*len(lines)),'white');d=ImageDraw.Draw(im)
    for i,l in enumerate(lines):d.text((20,20+50*i),l,fill='black',font=f)
    b=io.BytesIO();im.save(b,'PNG');return base64.b64encode(b.getvalue()).decode()
def run(name,lines,question,must_see,must_answer):
    look=post({'model':vis,'stream':False,'options':{'temperature':0.1},'messages':[{'role':'user','content':'Transcribe all visible text and code exactly. Say [unreadable] if unsure.','images':[shot(lines)]}]})
    seen=all(w.lower() in look.lower() for w in must_see)
    ans=post({'model':txt,'stream':False,'think':False,'messages':[{'role':'user','content':'Vision model findings:\n'+look+'\n\nUsing ONLY these findings answer: '+question}]})
    got=all(w.lower() in ans.lower() for w in must_answer)
    print(('PASS' if seen and got else 'FAIL'),name,'| vision saw text:',seen,'| answer correct:',got);return seen and got
r=[run('python error screenshot',['Traceback (most recent call last):','  File "app.py", line 3, in <module>','    prnt("hello")',"NameError: name 'prnt' is not defined"],'What is wrong with this code and how do I fix it?',['prnt'],['print']),
   run('maths photo',['Solve: 12 x 7 + 5 = ?'],'Solve the question in the image.',['12','7','5'],['89'])]
sys.exit(0 if all(r) else 1)
