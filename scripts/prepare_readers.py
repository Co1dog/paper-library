#!/usr/bin/env python3
"""Build light reading views; source reading.html and original PDFs stay intact."""
import base64,hashlib,json,re,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'/'reading'
ASSETS.mkdir(parents=True,exist_ok=True)
def store(data,kind,folder=''):
 name=hashlib.sha256(data).hexdigest()[:20]+'.'+kind
 path=ASSETS/folder/name;path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists() or path.read_bytes()!=data:path.write_bytes(data)
 return path.relative_to(ASSETS).as_posix()
def fonts(css):
 def replace(m):
  ext={'font/woff2':'woff2','font/woff':'woff','application/x-font-ttf':'ttf','font/ttf':'ttf'}.get(m[1],'bin')
  return 'url(fonts/'+store(base64.b64decode(m[2]),ext,'fonts').split('/')[-1]+')'
 return re.sub(r'url\([\"\']?data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)[\"\']?\)',replace,css)
def restore_api(script):
 script=script.replace("decodeURIComponent(location.pathname)","decodeURIComponent(location.pathname.replace(/\\/view\\.html$/, '/reading.html'))")
 restore='''
  function restore(snapshot) {
    $$('mark.xr-m').forEach(function (el) {var p=el.parentNode;while(el.firstChild)p.insertBefore(el.firstChild,el);el.remove();p.normalize();});
    $$('.xr-card').forEach(function(el){el.remove();});
    state.marks=JSON.parse(JSON.stringify(snapshot.marks||[]));state.updated=snapshot.updatedAt||now();
    state.marks.forEach(anchor);cards();
    try{localStorage.setItem(KEY,JSON.stringify({updated:state.updated,marks:state.marks,folds:state.folds}));}catch(e){}
    dirty=true;paintDirty();
  }
'''
 return script.replace('  return { ready:',restore+'\n  return { restore: restore, ready:')
# Vendored KaTeX assets are extracted from the existing self-contained source.
source=(ROOT/'papers'/'nau-2025'/'reading.html').read_text()
styles=re.findall(r'<style[^>]*>([\s\S]*?)</style>',source)
mathcss=next(s for s in styles if '@font-face' in s and 'KaTeX_AMS' in s)
math_css=store(fonts(mathcss).encode(),'css')
math_scripts={}
for script in re.findall(r'<script\b[^>]*>([\s\S]*?)</script>',source):
 if script.startswith('!function') and len(script)>100000:math_scripts['katex']=store(script.encode(),'js')
 elif script.startswith('!function') and 'renderMathInElement' in script:math_scripts['auto']=store(script.encode(),'js')
summary=[]
catalog_path=ROOT/'papers'/'library.json';catalog=json.loads(catalog_path.read_text())
for paper in catalog['papers']:
 directory=ROOT/'papers'/paper['id'];original=directory/'reading.html'
 if not original.exists():continue
 html=original.read_text();before=len(html.encode())
 def style(m):return '<link rel="stylesheet" href="../../assets/reading/'+store(fonts(m[1]).encode(),'css')+'">'
 html=re.sub(r'<style[^>]*>([\s\S]*?)</style>',style,html)
 # Scripts with per-paper figure controls remain inline; common libraries are cached.
 def script(m):
  attrs,text=m[1],m[2]
  if 'src=' in attrs:
   if 'katex.min.js' in attrs:return '<script defer src="../../assets/reading/'+math_scripts['katex']+'"></script>'
   if 'auto-render.min.js' in attrs:return '<script defer src="../../assets/reading/'+math_scripts['auto']+'"></script>'
   return m[0]
  if text.startswith('!function') and 'renderMathInElement' in text:return '<script defer src="../../assets/reading/'+math_scripts['auto']+'"></script>'
  if 'var XRAY = (function' in text:text=restore_api(text)
  elif len(text)<15000:return m[0]
  defer=' defer' if text.startswith('!function') else ''
  return '<script'+defer+' src="../../assets/reading/'+store(text.encode(),'js')+'"></script>'
 html=re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>',script,html)
 html=re.sub(r'<link\b[^>]*href=[\"\'][^\"\']*katex.min.css[^\"\']*[\"\'][^>]*>', '<link rel="stylesheet" href="../../assets/reading/'+math_css+'">',html)
 def image(m):
  attrs=m[1];src=re.search(r'\bsrc=([\"\'])(data:image/([^;,]+);base64,([A-Za-z0-9+/=\s]+))\1',attrs)
  if not src:return m[0]
  data=base64.b64decode(src[4]);ext={'jpeg':'jpg','svg+xml':'svg'}.get(src[3],src[3]);name=store(data,ext,'images')
  attrs=attrs.replace(src[2],'../../assets/reading/'+name)
  if 'loading=' not in attrs:attrs+=' loading="lazy"'
  if 'decoding=' not in attrs:attrs+=' decoding="async"'
  if data.startswith(b'\x89PNG\r\n\x1a\n') and 'width=' not in attrs and 'height=' not in attrs:
   width,height=struct.unpack('>II',data[16:24]);attrs+=f' width="{width}" height="{height}"'
  return '<img'+attrs+'>'
 html=re.sub(r'<img\b([^>]*)>',image,html)
 html=html.replace('</head>','<link rel="stylesheet" href="../../reader-notes.css?v=reader-tools-20261105">\n</head>')
 (directory/'view.html').write_text(html)
 paper['readerURL']=paper['readingURL'].rsplit('/',1)[0]+'/view.html'
 summary.append({'id':paper['id'],'original_html_bytes':before,'view_html_bytes':len(html.encode()),'reduction_percent':round((1-len(html.encode())/before)*100,1)})
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
