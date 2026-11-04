import test from 'node:test';
import assert from 'node:assert/strict';
import {readerAssetURL} from '../reader.js';
test('published assets resolve inside the live site and local previews',()=>{
 const paper='https://co1dog.github.io/paper-library/papers/nau-2025/original.pdf';
 assert.equal(readerAssetURL(paper,'http://127.0.0.1:8784/reader.js'),'http://127.0.0.1:8784/papers/nau-2025/original.pdf');
 assert.equal(readerAssetURL(paper,'https://co1dog.github.io/paper-library/reader.js'),paper);
 assert.equal(readerAssetURL('https://example.com/paper.pdf','http://localhost/reader.js'),'https://example.com/paper.pdf');
 assert.equal(readerAssetURL('javascript:alert(1)'), '');
 assert.equal(readerAssetURL(''), '');
});
