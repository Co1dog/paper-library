const warmed=new Set();
export function warmReader(paper){
 if(!paper||navigator.connection?.saveData)return;
 if(!warmed.has('pdf')){
  warmed.add('pdf');import('./assets/vendor/pdfjs/pdf.mjs').catch(()=>{});
  fetch(new URL('./assets/vendor/pdfjs/pdf.worker.mjs',import.meta.url),{cache:'force-cache',priority:'low'}).catch(()=>{});
 }
 const source=paper.readerURL;
 if(source&&!warmed.has(source)){
  warmed.add(source);
  const url=new URL(source);if(url.origin==='https://co1dog.github.io'&&url.pathname.startsWith('/paper-library/')){
   const target=new URL('./'+url.pathname.slice('/paper-library/'.length),import.meta.url);target.searchParams.set('theme','dark');fetch(target,{cache:'force-cache',priority:'low'}).catch(()=>{});
  }
 }
}
