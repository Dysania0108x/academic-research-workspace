import test from 'node:test';
import assert from 'node:assert/strict';
import {locateQuote} from '../extension/quoteMatch.mjs';
test('matches whitespace-normalized quotes with correct source offsets',()=>{
 const text='An AI\n  assistant supports research.';
 assert.deepEqual(locateQuote(text,'AI assistant supports'),{start:3,end:26});
});
test('never invents positions for missing quotes',()=>{
 assert.equal(locateQuote('Original PDF passage','Different content'),null);
 assert.equal(locateQuote('Original PDF passage',''),null);
});
test('matches mixed case without changing source offsets',()=>{
 assert.deepEqual(locateQuote('Research Workflow','research workflow'),{start:0,end:17});
});
