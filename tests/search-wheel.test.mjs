import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeKeywords,matchesPaper,keywordGroup} from '../search-core.js';
import {validateRecord} from '../upload-core.js';
import {wheelWindow,wheelDistance,wheelPose} from '../src/components/wheel-geometry.js';
const {papers}=JSON.parse(await readFile(new URL('../papers/library.json',import.meta.url)));
const ids=(query,keywords=[])=>papers.filter(p=>matchesPaper(p,query,keywords)).map(p=>p.id);

test('legacy combined categories split; multi-word English keywords stay intact',()=>{
 assert.deepEqual(normalizeKeywords('眼动与事件记忆'),['眼动','事件记忆']);
 assert.deepEqual(normalizeKeywords('eye tracking, Event Memory、fMRI'),['眼动','事件记忆','fMRI']);
 assert.deepEqual(normalizeKeywords(['眼动','gaze','fMRI']),['眼动','fMRI']);
});
test('combined keyword checkboxes use AND, and English aliases select the same papers',()=>{
 assert.deepEqual(ids('',new Set(['fMRI','HMM'])),['nau-2025']);
 assert.deepEqual(ids('',new Set(['功能磁共振','hidden markov model'])),['nau-2025']);
 assert.deepEqual(ids('',new Set(['眼动','ECoG'])),[]);
 assert.equal(ids('',new Set(['fMRI'])).length,5);
});
test('Chinese, English and mixed-language search reach the same records',()=>{
 assert.deepEqual(ids('眼动'),ids('eye tracking'));
 assert.deepEqual(ids('神经重现'),ids('neural reinstatement'));
 assert.deepEqual(ids('语言模型'),ids('language models'));
 assert.deepEqual(ids('眼动 event memory'),['nau-2025']);
 assert.deepEqual(ids('GAZE fMRI'),['nau-2025']);
});
test('search combines author, keyword and query terms with active filters',()=>{
 assert.deepEqual(ids('Nau',new Set(['眼动'])),['nau-2025']);
 assert.deepEqual(ids('Nau',new Set(['ECoG'])),[]);
 assert.equal(ids('does-not-exist').length,0);
 assert.equal(ids('').length,7);
});
test('new uploads retain multiple keywords and old topic uploads still work',()=>{
 const base={title:'新论文',readDate:'2026-11-03'};
 const record=validateRecord({...base,keywords:'眼动, event memory'});
 assert.deepEqual(record.keywords,['眼动','事件记忆']);
 assert.equal(record.topic,'眼动、事件记忆');
 assert.deepEqual(validateRecord({...base,topic:'眼动与事件记忆'}).keywords,record.keywords);
 assert.throws(()=>validateRecord({...base,keywords:' , '}));
});
test('wheel rendering remains bounded and unique for one to ten thousand papers',()=>{
 for(const count of [1,2,3,4,7,8,100,1000,10000])for(const center of [-101,-1,0,1,1200]){
  const indices=wheelWindow(center,count);
  assert.equal(indices.length,Math.min(count,7));
  assert.equal(new Set(indices).size,indices.length);
  assert.ok(indices.every(i=>i>=0&&i<count));
 }
 assert.deepEqual(wheelWindow(0,0),[]);
});
test('cover spacing and positions do not depend on collection size',()=>{
 for(const count of [7,100,1000]){
  const d=wheelDistance(1,0,count),pose=wheelPose(d,1440,900);
  assert.equal(pose.x,Math.min(1440*.9,900*1.7)*Math.sin(.38));
  assert.equal(pose.y,Math.min(1440*.9,900*1.7)*(1-Math.cos(.38)));
 }
});
test('lower cards leave the orbit rather than accumulating below the viewport',()=>{
 assert.equal(wheelPose(0,1440,900).opacity,1);
 assert.equal(wheelPose(3,1440,900).opacity,0);
 assert.ok(wheelPose(2,1440,900).opacity<1);
 assert.equal(wheelPose(-3,390,844).opacity,0);
 assert.equal(wheelDistance(0,999,1000),1);
});

test('compact facets distinguish published datasets, actual signals and model families',()=>{
 assert.deepEqual(ids('', ['有数据集']),['nau-2025','nastase-2021-narratives','zada-2025-podcast']);
 assert.deepEqual(ids('', ['dataset','ecog']),['zada-2025-podcast']);
 assert.deepEqual(ids('', ['LLM','fMRI']),['xiao-2026-brain-guided']);
 assert.deepEqual(ids('', ['EEG']),[]);
 assert.deepEqual(ids('', ['JEPA']),['balestriero-2026-jepa']);
 assert.equal(keywordGroup('fMRI'),'信号 / 测量');
 assert.equal(keywordGroup('dataset'),'数据资源');
 assert.equal(keywordGroup('language models'),'AI 模型');
 assert.equal(keywordGroup('HMM'),'方法 / 重点');
});
