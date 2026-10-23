import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceSourceLabel,safeEvidenceUrl,isVerifiedEvidence} from '../src/evidenceSource.js';
test('PDF evidence retains its paper and page',()=>{
 assert.equal(evidenceSourceLabel({paperId:'p1',page:4},[{id:'p1',name:'Study A'}]),'Study A · Page 4');
});
test('Web and manual evidence show source title without PDF page',()=>{
 assert.equal(evidenceSourceLabel({sourceType:'web',sourceTitle:'ACM Article'}),'ACM Article · Website');
 assert.equal(evidenceSourceLabel({sourceType:'manual',sourceTitle:'Interview P01'}),'Interview P01 · Manual');
});
test('Only HTTP(S) links are navigable',()=>{
 assert.equal(safeEvidenceUrl({sourceUrl:'javascript:alert(1)'}),null);
 assert.equal(safeEvidenceUrl({sourceUrl:'https://example.com/paper'}),'https://example.com/paper');
});
test('Unverified web evidence is excluded from verified-only synthesis',()=>{
 assert.equal(isVerifiedEvidence({sourceType:'web',verificationStatus:'unverified'}),false);
 assert.equal(isVerifiedEvidence({sourceType:'web',verificationStatus:'verified'}),true);
 assert.equal(isVerifiedEvidence({paperId:'p1'}),true);
});
