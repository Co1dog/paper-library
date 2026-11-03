import {GitHubLibrary, validateFiles, validateRecord} from './upload-core.js';

export function setupUploader({onSaved}) {
  const $=id=>document.getElementById(id);
  const client=new GitHubLibrary();
  const form=$('add-form');
  const pdf=$('upload-pdf'),reading=$('upload-reading'),customCover=$('upload-cover');
  let previewURL='',generation=0,coverBytes=null,working=false;
  const showError=message=>{$('form-error').textContent=message;};
  function state() {
    $('account-status').textContent=client.connected?'已连接 Co1dog / paper-library':'尚未连接书架';
    $('account-disconnect').hidden=!client.connected;
    $('account-connect').textContent=client.connected?'重新连接':'连接书架';
    $('upload-submit').disabled=working;
    $('upload-connect-open').disabled=working;
    $('add-dialog').querySelector('.close').disabled=working;
    $('add-dialog').dataset.busy=String(working);
    $('upload-submit').textContent=working?'正在保存…':'上传并加入书架';
  }
  const setPreview=bytes=>{
    if(previewURL) URL.revokeObjectURL(previewURL);
    previewURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
    $('upload-preview').src=previewURL;$('upload-preview').hidden=false;
  };
  function progress({completed,total,label}) {
    $('upload-progress').hidden=false;
    $('upload-progress-bar').max=total;$('upload-progress-bar').value=completed;
    $('upload-status').textContent=label;
  }
  $('account-connect').addEventListener('click',async()=>{
    const input=$('github-token');
    const value=input.value;input.value='';$('account-error').textContent='';
    $('account-connect').disabled=true;
    try {await client.connect(value);$('account-status').textContent='已连接 Co1dog / paper-library';}
    catch(error){$('account-error').textContent=error.message;}
    finally{$('account-connect').disabled=false;state();}
  });
  $('account-disconnect').addEventListener('click',()=>{client.disconnect();state();});
  $('connection-open').addEventListener('click',()=>{
    $('menu-dialog').close();$('connection-dialog').showModal();
  });
  $('upload-connect-open').addEventListener('click',()=>{
    $('add-dialog').close();$('connection-dialog').showModal();
  });
  $('account-return').addEventListener('click',()=>{
    $('connection-dialog').close();$('add-dialog').showModal();
  });
  $('github-token').addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();$('account-connect').click();}
  });
  pdf.addEventListener('change',async()=>{
    const ticket=++generation;coverBytes=null;showError('');
    $('upload-result').hidden=true;
    if(!pdf.files[0]){$('upload-preview').hidden=true;return;}
    const file=pdf.files[0];
    if(!/\.pdf$/i.test(file.name)||file.size>60*1024*1024){$('upload-preview').hidden=true;showError('请选择不超过 60 MB 的 PDF。');return;}
    $('cover-status').textContent='正在读取 PDF 首页…';
    let doc;
    try {
      const pdfjs=await import('./assets/vendor/pdfjs/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
      doc=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
      const page=await doc.getPage(1);
      const initial=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(1400/initial.height,1100/initial.width)});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob) throw new Error('No cover');
      const bytes=new Uint8Array(await blob.arrayBuffer());
      const metadata=await doc.getMetadata().catch(()=>null);
      if(ticket!==generation)return;
      if(!customCover.files[0]){coverBytes=bytes;setPreview(bytes);}
      const title=metadata?.info?.Title?.trim();
      if(!form.elements.title.value&&title&&title.length<251) form.elements.title.value=title;
      if(!form.elements.authors.value&&metadata?.info?.Author) form.elements.authors.value=metadata.info.Author.slice(0,200);
      $('cover-status').textContent=`已生成第 1 页封面 · 原文共 ${doc.numPages} 页`;
    } catch {
      if(ticket===generation)$('cover-status').textContent='无法自动生成封面，可在下方选择一张 PNG 或 JPG。';
    } finally {if(doc)await doc.destroy();}
  });
  customCover.addEventListener('change',async()=>{
    showError('');const file=customCover.files[0];
    if(!file){pdf.dispatchEvent(new Event('change'));return;}
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024){coverBytes=null;showError('封面需要是 5 MB 以内的 PNG 或 JPG。');return;}
    try {
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      coverBytes=new Uint8Array(await blob.arrayBuffer());setPreview(coverBytes);$('cover-status').textContent='使用所选封面';
    }catch{coverBytes=null;showError('封面图片无法读取，请换一张。');}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(working)return;showError('');$('upload-result').hidden=true;
    if(!form.reportValidity())return;
    if(!client.connected){showError('请先点击「连接书架」完成本次授权，再上传。');return;}
    try {
      validateFiles(pdf.files[0],reading.files[0]);
      const raw=Object.fromEntries(new FormData(form));raw.favorite=form.elements.favorite.checked;
      const record=validateRecord(raw);
      if(!coverBytes)throw new Error('请等待首页封面生成，或选择一张封面图片。');
      working=true;state();$('add-dialog').querySelectorAll('input,textarea').forEach(el=>el.disabled=true);
      progress({completed:0,total:6,label:'正在检查文件'});
      let html=await reading.files[0].text();
      const parsed=new DOMParser().parseFromString(html,'text/html');
      if(!parsed.querySelector('body')||!/<(?:html|body|!doctype)/i.test(html))throw new Error('解读需要是完整的 HTML 页面。');
      const dependencies=[...parsed.querySelectorAll('img[src],script[src],link[rel="stylesheet"][href]')].map(el=>el.getAttribute(el.tagName==='LINK'?'href':'src'));
      if(dependencies.some(url=>!url.startsWith('data:')&&!/^https?:\/\//i.test(url)))throw new Error('解读引用了本地图片或脚本。请先导出内嵌资源的完整 HTML 再上传。');
      // Remove source-machine metadata from this published copy only.
      html=html.replace(/(?:file:\/\/)?\/Users\/[^"<>\n]+(?=["<>\n])/g,reading.files[0].name);
      const result=await client.publish(record,{pdf:new Uint8Array(await pdf.files[0].arrayBuffer()),reading:new TextEncoder().encode(html),cover:coverBytes},progress);
      const transientCover=URL.createObjectURL(new Blob([coverBytes],{type:'image/png'}));
      onSaved(result.record,transientCover);
      $('upload-result').hidden=false;$('upload-result').textContent='已加入书架。文件正在发布，公开阅读入口会在 GitHub Pages 更新后可用。';
      form.reset();try{localStorage.removeItem('paper-library-draft-v1');}catch{}
      form.elements.readDate.value=new Date().toLocaleDateString('en-CA');
      coverBytes=null;$('upload-preview').hidden=true;$('cover-status').textContent='选择 PDF 后自动生成首页封面。';
    }catch(error){showError(error.message);$('upload-status').textContent='保存未完成';}
    finally{working=false;$('add-dialog').querySelectorAll('input,textarea').forEach(el=>el.disabled=false);state();}
  });
  $('add-dialog').addEventListener('cancel',event=>{if(working)event.preventDefault();});
  $('add-dialog').querySelector('[data-close]').addEventListener('click',event=>{
    if(working){event.stopImmediatePropagation();showError('正在同步，请等保存结束后再关闭。');}
  });
  window.addEventListener('beforeunload',event=>{if(working){event.preventDefault();event.returnValue='';}});
  // Token stays in a private field in this module and is never written to storage or URLs.
  state();
}
