import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPdfRect} from '../src/pdfGeometry.js';

test('maps a source rectangle to percentage coordinates regardless of zoom',()=>{
 const original={width:612,height:792};
 const one=mapPdfRect([61.2,79.2,122.4,158.4],original,{width:918,height:1188});
 const two=mapPdfRect([61.2,79.2,122.4,158.4],original,{width:1224,height:1584});
 assert.deepEqual(one,two);
 assert.deepEqual(one,{left:'10%',top:'10%',width:'10%',height:'10%'});
});
test('rejects malformed, out-of-bounds and mismatched coordinates',()=>{
 const size={width:612,height:792};
 assert.equal(mapPdfRect([0,0,100,100],size,{width:500,height:500}),null);
 assert.equal(mapPdfRect([-1,0,100,100],size,size),null);
 assert.equal(mapPdfRect([0,0,700,100],size,size),null);
 assert.equal(mapPdfRect([NaN,0,100,100],size,size),null);
 assert.equal(mapPdfRect([1,2,3],size,size),null);
});
