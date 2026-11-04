// GitHub stores files and their catalog record in one commit. No server or stored secret.
import {normalizeKeywords} from './search-core.js?v=reading-room-20261104-v2';
export const OWNER = 'Co1dog';
export const REPO = 'paper-library';
export const BRANCH = 'main';
export const CATALOG = 'papers/library.json';
export const DRAFT_KEY = 'paper-library-upload-draft-v2';
export const SITE = 'https://co1dog.github.io/paper-library/';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const LIMIT = 60 * 1024 * 1024;

export function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export function fromBase64(value) {
  return Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0));
}
export async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
export function validateFiles(pdf, reading) {
  if (!pdf || !reading) throw new Error('请选择原文 PDF 和中文解读 HTML。');
  if (!/\.pdf$/i.test(pdf.name)) throw new Error('原文需要是 PDF 文件。');
  if (!/\.html?$/i.test(reading.name)) throw new Error('解读需要是完整 HTML 文件。');
  for (const file of [pdf, reading]) {
    if (!file.size) throw new Error(`${file.name} 是空文件。`);
    if (file.size > LIMIT) throw new Error('每个文件最多 60 MB，请选择较小的版本。');
  }
}
export function validateRecord(raw) {
  const text = (key, max) => typeof raw[key] === 'string' ? raw[key].trim().slice(0, max) : '';
  const keywords=normalizeKeywords(raw.keywords?.length?raw.keywords:raw.topic);
  const result = {title:text('title',250),authors:text('authors',200),keywords,topic:keywords.join('、'),venue:text('venue',120),
    summary:text('summary',400),notes:text('notes',5000),readDate:text('readDate',10),favorite:raw.favorite===true,
    year:raw.year ? Number(raw.year) : null,url:text('url',2000)};
  if (!result.title || !keywords.length) throw new Error('请填写论文标题与关键词。');
  if (result.year !== null && (!Number.isInteger(result.year) || result.year < 1600 || result.year > 2100)) throw new Error('请检查发表年份。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.readDate) || !Number.isFinite(Date.parse(result.readDate))) throw new Error('请选择阅读日期。');
  if (result.url) {
    let url; try { url = new URL(result.url); } catch { throw new Error('原文链接需要是完整的 http:// 或 https:// 地址。'); }
    if (!['http:','https:'].includes(url.protocol)) throw new Error('原文链接需要使用 http:// 或 https://。');
    result.url = url.href;
  }
  return result;
}

export class GitHubLibrary {
  #token = '';
  #fetch;
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.#fetch = fetcher; }
  get connected() { return Boolean(this.#token); }
  disconnect() { this.#token = ''; }
  async #request(path, {method='GET', body, missing=false} = {}) {
    if (!this.#token) throw new Error('请先连接书架账号。');
    let response;
    try {
      response = await this.#fetch(API + path, {method, cache:'no-store', redirect:'error',
        headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.#token}`,
          'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(240000)});
    } catch { throw new Error('网络连接中断。若在最后一步中断，请刷新书架确认是否已保存后再重试。'); }
    if (missing && response.status === 404) return null;
    if (!response.ok) {
      const error = new Error(response.status===401?'授权已失效，请重新连接。':
        response.status===403?'GitHub 拒绝写入。请检查授权是否包含本仓库的 Contents: Read and write，或稍后重试。':
        response.status===404?'未找到仓库或授权未包含 paper-library。':
        response.status===409||response.status===422?'书架同时有新的修改，正在重新核对。':`GitHub 暂时无法保存（${response.status}）。`);
      error.status=response.status;
      if(response.status===401) this.disconnect();
      throw error;
    }
    return response.json();
  }
  async connect(token) {
    this.disconnect();
    if (typeof token !== 'string' || !/^github_pat_[A-Za-z0-9_]+$/.test(token.trim())) throw new Error('请输入 GitHub fine-grained personal access token。');
    this.#token=token.trim();
    try {
      const repo=await this.#request('');
      if(repo.owner?.login?.toLowerCase()!==OWNER.toLowerCase()||repo.name!==REPO||!repo.permissions?.push) throw new Error('这个授权没有 Co1dog/paper-library 的写入权限。');
      return {owner:OWNER,repository:REPO};
    } catch(error) { this.disconnect(); throw error; }
  }
  async #snapshot() {
    const ref=await this.#request(`/git/ref/heads/${BRANCH}`);
    const commit=await this.#request(`/git/commits/${ref.object.sha}`);
    const file=await this.#request(`/contents/${CATALOG}?ref=${ref.object.sha}`,{missing:true});
    let catalog={version:1,papers:[]};
    if(file) {
      try { catalog=JSON.parse(new TextDecoder().decode(fromBase64(file.content))); } catch { throw new Error('云端书架目录无法解析，已停止保存以保护现有记录。'); }
      if(catalog.version!==1||!Array.isArray(catalog.papers)) throw new Error('云端书架目录格式不兼容，已停止保存。');
    }
    return {head:ref.object.sha,tree:commit.tree.sha,catalog};
  }
  async publish(raw, files, onProgress=()=>{}) {
    if(!this.connected) throw new Error('请先连接书架账号。');
    const record=validateRecord(raw);
    if(!files?.pdf?.length||new TextDecoder().decode(files.pdf.subarray(0,5))!=='%PDF-') throw new Error('所选原文不是有效的 PDF 文件。');
    if(!files.reading?.length||!files.cover?.length) throw new Error('请先完成解读和封面的准备。');
    if(files.pdf.length>LIMIT||files.reading.length>LIMIT||files.cover.length>5*1024*1024) throw new Error('文件超过大小限制。');
    const pdfSHA256=await sha256(files.pdf);
    let snapshot=await this.#snapshot();
    const duplicate=()=>snapshot.catalog.papers.find(p=>p.pdfSHA256===pdfSHA256||p.title?.trim().toLowerCase()===record.title.toLowerCase());
    if(duplicate()) throw new Error(`书架中已有这篇论文：${duplicate().title}。没有重复上传。`);
    const id=`paper-${crypto.randomUUID()}`;
    const directory=`papers/${id}`;
    const published={...record,id,pdfSHA256,pdfURL:`${SITE}${directory}/original.pdf`,readingURL:`${SITE}${directory}/reading.html`,coverURL:`${SITE}${directory}/cover.png`};
    const blobs=[];
    const entries=[['original.pdf',files.pdf],['reading.html',files.reading],['cover.png',files.cover]];
    for(let i=0;i<entries.length;i++) {
      onProgress({completed:i,total:6,label:`正在上传${['原文 PDF','中文解读','首页封面'][i]}`});
      const [name,bytes]=entries[i];
      const blob=await this.#request('/git/blobs',{method:'POST',body:{encoding:'base64',content:toBase64(bytes)}});
      blobs.push({path:`${directory}/${name}`,mode:'100644',type:'blob',sha:blob.sha});
    }
    for(let attempt=0;attempt<2;attempt++) {
      if(attempt) {
        snapshot=await this.#snapshot();
        if(duplicate()) throw new Error('另一个窗口已保存同一篇论文，请刷新书架。');
      }
      onProgress({completed:3,total:6,label:'正在保存书架目录'});
      const catalog={...snapshot.catalog,papers:[...snapshot.catalog.papers,published]};
      const tree=await this.#request('/git/trees',{method:'POST',body:{base_tree:snapshot.tree,tree:[...blobs,
        {path:CATALOG,mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)+'\n'}]}});
      onProgress({completed:4,total:6,label:'正在建立完整阅读记录'});
      const commit=await this.#request('/git/commits',{method:'POST',body:{message:`Add paper: ${record.title}`,tree:tree.sha,parents:[snapshot.head]}});
      onProgress({completed:5,total:6,label:'正在同步到线上书架'});
      try {
        await this.#request(`/git/refs/heads/${BRANCH}`,{method:'PATCH',body:{sha:commit.sha,force:false}});
      } catch(error) {
        // A timed-out final write can already have succeeded. Check before retrying.
        const ref=await this.#request(`/git/ref/heads/${BRANCH}`);
        if(ref.object.sha!==commit.sha) {
          if((error.status===409||error.status===422)&&attempt===0) continue;
          throw error;
        }
      }
      onProgress({completed:6,total:6,label:'已保存到书架'});
      return {record:published,commit:commit.sha};
    }
    throw new Error('书架仍有并行修改，请刷新后重新保存。');
  }
}

export function mergePapers(...groups) {
  const seen=new Set();
  return groups.flat().filter(p=>{
    const key=(p.url||p.title||p.id).trim().toLowerCase().replace(/\/$/,'');
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
}
