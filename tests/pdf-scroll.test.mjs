import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfLayout,pdfPageAt,pdfWindow,pdfAnchor,pdfAnchorOffset,seedPDFSizes} from '../pdf-scroll-core.js';
const portrait={width:600,height:800};
test('continuous layout preserves mixed page sizes and vertical gaps',()=>{
 const layout=pdfLayout([portrait,{width:800,height:600},portrait],600);
 assert.deepEqual(layout.map(p=>[p.top,p.height]),[[0,800],[824,450],[1298,800]]);
 assert.equal(pdfPageAt(layout,-50),0);assert.equal(pdfPageAt(layout,823),0);assert.equal(pdfPageAt(layout,824),1);assert.equal(pdfPageAt(layout,10000),2);
});
test('resizing and zooming retain the same page and relative reading position',()=>{
 const before=pdfLayout(Array(63).fill(portrait),600),anchor=pdfAnchor(before,824*37+400);
 const after=pdfLayout(Array(63).fill(portrait),342,1.25),offset=pdfAnchorOffset(after,anchor);
 assert.deepEqual(anchor,{index:37,fraction:.5});
 assert.equal(pdfPageAt(after,offset),37);assert.ok(Math.abs((offset-after[37].top)/after[37].height-.5)<1e-10);
});
test('long documents render nearby pages instead of allocating all canvases',()=>{
 for(const width of [342,1000]){
  const layout=pdfLayout(Array(10000).fill(portrait),width);
  for(const index of [0,1,500,9999]){
   const window=pdfWindow(layout,layout[index].top,844);
   assert.ok(window.includes(index));assert.ok(window.length<=6);
   assert.ok(window.every(i=>i>=0&&i<layout.length));
  }
 }
 assert.deepEqual(pdfWindow([],0,800),[]);
});

test('first layout does not wait for metadata from the rest of a long PDF',async()=>{
 const calls=[];const sizes=await seedPDFSizes({numPages:63,getPage:async n=>{calls.push(n);return {getViewport:()=>({width:600,height:800})};}});
 assert.deepEqual(calls,[1]);assert.equal(sizes.length,63);assert.deepEqual(sizes[62],{width:600,height:800});
});
