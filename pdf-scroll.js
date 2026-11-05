import {pdfLayout,pdfPageAt,pdfWindow,pdfAnchor,pdfAnchorOffset,seedPDFSizes} from './pdf-scroll-core.js?v=cloud-fast-20261105-v4';
// All pages retain their place in the scroll. Only nearby pages own canvases.
export class ContinuousPDF{
 constructor({doc,pdfjs,viewport,mount,onPage,onError}){
  Object.assign(this,{doc,pdfjs,viewport,mount,onPage,onError});
  this.started=performance.now();this.alive=true;this.zoom=1;this.layout=[];this.entries=[];this.wanted=new Set();this.running=0;this.frame=0;this.generation=0;this.width=0;
  this.queue=()=>{if(this.alive&&!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.update();});};
  viewport.addEventListener('scroll',this.queue,{passive:true});
 }
 async init(){
  const sizes=await seedPDFSizes(this.doc);
  if(!this.alive)return;this.sizes=sizes;
  this.entries=sizes.map((_,i)=>{
   const node=document.createElement('div');node.className='pdf-page-wrap';node.dataset.pageNumber=String(i+1);node.setAttribute('role','group');node.setAttribute('aria-label',`原文第 ${i+1} 页，共 ${sizes.length} 页`);
   const entry={node,index:i,task:null,text:null,busy:false,ready:false,failed:false};
   this.placeholder(entry);this.mount.append(node);return entry;
  });
  this.resize(1);this.mount.hidden=false;this.queue();
 }
 placeholder(entry){
  const hint=document.createElement('span');hint.className='pdf-placeholder';hint.textContent=`第 ${entry.index+1} 页`;entry.node.replaceChildren(hint);delete entry.node.dataset.rendered;
 }
 cancel(entry){
  entry.task?.cancel();entry.text?.cancel();entry.task=null;entry.text=null;
  for(const c of entry.node.querySelectorAll('canvas')){c.width=0;c.height=0;}
  entry.ready=false;entry.failed=false;this.placeholder(entry);
 }
 resize(zoom=this.zoom,force=false){
  if(!this.alive||!this.sizes||!this.viewport.clientWidth)return;
  const width=this.viewport.clientWidth-48;
  if(!force&&width===this.width&&zoom===this.zoom){this.queue();return;}
  const anchor=pdfAnchor(this.layout,Math.max(0,this.viewport.scrollTop-24));
  this.generation++;this.width=width;this.zoom=zoom;this.layout=pdfLayout(this.sizes,width,zoom);
  this.entries.forEach((entry,i)=>{
   this.cancel(entry);const item=this.layout[i];entry.node.style.width=item.width+'px';entry.node.style.height=item.height+'px';entry.node.style.setProperty('--scale-factor',item.scale);entry.node.style.setProperty('--total-scale-factor',item.scale);
  });
  this.viewport.scrollTop=pdfAnchorOffset(this.layout,anchor)+24;this.queue();
 }
 jump(number){
  if(!this.layout.length)return;
  const value=Number(number),index=Math.max(0,Math.min(this.layout.length-1,Number.isFinite(value)?Math.round(value)-1:0));
  this.viewport.scrollTop=this.layout[index].top+24;this.queue();
 }
 update(){
  if(!this.alive||!this.layout.length||!this.viewport.clientHeight)return;
  const top=Math.max(0,this.viewport.scrollTop-24),height=this.viewport.clientHeight;
  const current=pdfPageAt(this.layout,top+Math.min(160,height*.25));
  this.onPage(current+1);this.wanted=new Set(pdfWindow(this.layout,top,height));
  for(const entry of this.entries)if(!this.wanted.has(entry.index)&&(entry.ready||entry.busy||entry.failed))this.cancel(entry);
  this.pump(current);
 }
 pump(current=pdfPageAt(this.layout,Math.max(0,this.viewport.scrollTop-24))){
  if(!this.alive)return;
  const queue=[...this.wanted].sort((a,b)=>Math.abs(a-current)-Math.abs(b-current));
  for(const index of queue){
   if(this.running>=(this.firstPaint?2:1))break;
   const entry=this.entries[index];if(entry.ready||entry.busy||entry.failed)continue;
   entry.busy=true;this.running++;this.draw(entry,this.generation).finally(()=>{entry.busy=false;this.running--;if(this.alive)this.queue();});
  }
 }
 async draw(entry,generation){
  const current=()=>this.alive&&generation===this.generation&&this.wanted.has(entry.index);
  try{
   const pdfPage=await this.doc.getPage(entry.index+1);if(!current())return;
   const unit=pdfPage.getViewport({scale:1}),known=this.sizes[entry.index];
   if(Math.abs(unit.width-known.width)>.1||Math.abs(unit.height-known.height)>.1){this.sizes[entry.index]={width:unit.width,height:unit.height};this.resize(this.zoom,true);return;}
   const item=this.layout[entry.index],view=pdfPage.getViewport({scale:item.scale}),ratio=Math.min(devicePixelRatio||1,2),canvas=document.createElement('canvas');
   canvas.width=Math.floor(view.width*ratio);canvas.height=Math.floor(view.height*ratio);canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';canvas.setAttribute('aria-hidden','true');
   entry.node.replaceChildren(canvas);
   const task=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});entry.task=task;
   await task.promise;if(!current())return;
   const text=document.createElement('div');text.className='textLayer';entry.node.append(text);
   const layer=new this.pdfjs.TextLayer({textContentSource:pdfPage.streamTextContent(),container:text,viewport:view});entry.text=layer;
   await layer.render();if(!current())return;
   entry.ready=true;entry.node.dataset.rendered='true';this.firstPaint=true;
   if(!this.mount.dataset.firstPaintMs)this.mount.dataset.firstPaintMs=String(Math.round(performance.now()-this.started));
  }catch(error){
   if(!current()||['RenderingCancelledException','AbortException'].includes(error.name))return;
   entry.failed=true;const retry=document.createElement('button');retry.className='pdf-retry';retry.textContent=`第 ${entry.index+1} 页载入失败，点击重试`;retry.onclick=()=>{entry.failed=false;this.queue();};entry.node.replaceChildren(retry);
  }
 }
 destroy(){
  this.alive=false;this.generation++;cancelAnimationFrame(this.frame);this.viewport.removeEventListener('scroll',this.queue);this.entries.forEach(entry=>this.cancel(entry));this.mount.replaceChildren();
 }
}
