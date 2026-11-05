// Layout is measured in CSS pixels, relative to the document's first page.
export function pdfLayout(sizes,width,zoom=1,gap=24){
 let top=0;
 return sizes.map(({width:w,height:h},index)=>{
  const scale=Math.max(.2,width/w)*zoom,height=h*scale;
  const item={number:index+1,top,width:w*scale,height,scale};top+=height+gap;return item;
 });
}
export function pdfPageAt(layout,offset){
 if(!layout.length)return 0;
 let lo=0,hi=layout.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(layout[mid].top<=offset)lo=mid;else hi=mid-1;}
 return lo;
}
export function pdfWindow(layout,top,height){
 if(!layout.length)return [];
 const first=Math.max(0,pdfPageAt(layout,top)-1),last=Math.min(layout.length-1,pdfPageAt(layout,top+height)+1);
 return Array.from({length:last-first+1},(_,i)=>first+i);
}
export function pdfAnchor(layout,offset){
 const index=pdfPageAt(layout,offset),item=layout[index];
 return item?{index,fraction:Math.max(0,Math.min(1,(offset-item.top)/item.height))}:{index:0,fraction:0};
}
export function pdfAnchorOffset(layout,anchor){const item=layout[anchor.index];return item?item.top+anchor.fraction*item.height:0;}

export async function seedPDFSizes(doc){
 const first=await doc.getPage(1),view=first.getViewport({scale:1});
 return Array.from({length:doc.numPages},()=>({width:view.width,height:view.height}));
}
