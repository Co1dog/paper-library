// Explicit bilingual vocabulary: no network translation or invented paper metadata.
const VOCABULARY = [
 ['眼动','eye tracking','eye-tracking','eye movement','eye movements','eyetracking','gaze'],
 ['事件记忆','event memory','event memories'],
 ['情景记忆','episodic memory','episodic memories'],
 ['记忆','memory','memories'],
 ['自然叙事','narrative','narratives','naturalistic narrative','自然故事'],
 ['神经重现','neural reinstatement','reactivation','再激活'],
 ['海马','hippocampus','hippocampal'],
 ['语言理解','language comprehension','language understanding'],
 ['LLM','语言模型','大语言模型','language model','language models','large language model','LLMs'],
 ['表示学习','representation learning','representational learning'],
 ['跨模态对齐','cross modal alignment','cross-modal alignment','multimodal alignment'],
 ['推理','reasoning','reason'],
 ['有数据集','数据集','新数据集','dataset','datasets','has dataset'],
 ['编码模型','encoding model','encoding models'],
 ['分析方法','analysis method','analysis methods'],
 ['fMRI','functional magnetic resonance imaging','功能磁共振'],
 ['ECoG','electrocorticography','皮层电图'],
 ['EEG','electroencephalography','脑电'],
 ['ISC','intersubject correlation','inter-subject correlation','被试间相关'],
 ['ISFC','intersubject functional correlation','被试间功能相关'],
 ['MEG','magnetoencephalography','脑磁'],['HMM','hidden markov model','隐马尔可夫模型'],
 ['脑引导','brain guided','brain-guided'],['NeuroAI','神经人工智能'],['JEPA','joint embedding predictive architecture'],
];
export const fold = value => String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
 .replace(/[‐‑–—_-]/g,' ').replace(/\s+/g,' ').trim();
const canonical = new Map(VOCABULARY.flatMap(group=>group.map(alias=>[fold(alias),group[0]])));
const textCache=new WeakMap();
export function normalizeKeywords(value) {
 const list=Array.isArray(value)?value:typeof value==='string'?value.split(/[,，、;；|/]+|\s+(?:and|&)\s+|[与和]/i):[];
 return [...new Set(list.filter(v=>typeof v==='string').map(v=>v.trim()).filter(Boolean)
  .map(v=>(canonical.get(fold(v))||v).slice(0,40)))].slice(0,16);
}
export function paperKeywords(paper) {
 return normalizeKeywords(paper.keywords?.length?paper.keywords:paper.tags?.length?paper.tags:paper.topic);
}
function contains(text,alias) {
 if(/[^\x00-\x7f]/.test(alias))return text.includes(alias);
 return new RegExp(`(?:^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^a-z0-9])`,'i').test(text);
}
function queryTerms(query) {
 let text=fold(query);
 // Recognize known phrases before splitting free words: "language models" is one concept.
 const phrases=VOCABULARY.flatMap(group=>group.map(alias=>({alias:fold(alias),tag:fold(group[0])})))
  .filter(item=>item.alias!==item.tag).sort((a,b)=>b.alias.length-a.alias.length);
 for(const {alias,tag} of phrases){
  if(!/[^\x00-\x7f]/.test(alias)){
   const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   text=text.replace(new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,'gi'),(_,prefix)=>prefix+tag);
  }else{text=text.split(alias).join(tag);}
 }
 return text.split(/[\s,，、;；]+/).filter(Boolean);
}
export function searchText(paper) {
 if(textCache.has(paper))return textCache.get(paper);
 const text=fold([paper.title,paper.authors,paper.venue,paper.summary,paper.notes,paper.searchTerms,paper.year,...paperKeywords(paper)].join(' '));
 const aliases=VOCABULARY.filter(group=>group.some(alias=>contains(text,fold(alias)))).flat();
 const result=text+' '+fold(aliases.join(' '));textCache.set(paper,result);return result;
}
export function matchesPaper(paper,query='',selected=[]) {
 const tags=new Set(paperKeywords(paper).map(fold));
 if(![...selected].every(tag=>tags.has(fold(canonical.get(fold(tag))||tag))))return false;
 const terms=queryTerms(query);
 if(!terms.length)return true;
 const text=searchText(paper);
 return terms.every(term=>text.includes(term));
}

// Facets describe evidence and methods; free text remains searchable separately.
export const KEYWORD_GROUPS=['信号 / 测量','数据资源','AI 模型','方法 / 重点'];
export function keywordGroup(tag){
 const key=canonical.get(fold(tag))||tag;
 if(['EEG','fMRI','ECoG','MEG','眼动'].includes(key))return KEYWORD_GROUPS[0];
 if(key==='有数据集')return KEYWORD_GROUPS[1];
 if(['JEPA','LLM','VLM','CNN','Transformer','扩散模型'].includes(key))return KEYWORD_GROUPS[2];
 return KEYWORD_GROUPS[3];
}
