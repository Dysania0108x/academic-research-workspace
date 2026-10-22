import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleCaptures,captureProjectLabel} from '../extension/captureRules.mjs';

test('never sync a capture from a different project',()=>{
 const entries=[{id:'a',projectId:'p1'},{id:'b',projectId:'p2'},{id:'c'}];
 assert.deepEqual(eligibleCaptures(entries,'p1').map(e=>e.id),['a','c']);
 assert.deepEqual(eligibleCaptures(entries,''),[]);
});
test('legacy captures require explicit project selection',()=>{
 assert.equal(captureProjectLabel({},'p1'),'Legacy capture (project not assigned)');
 assert.equal(captureProjectLabel({projectId:'p2'},'p1'),'Another project');
});
