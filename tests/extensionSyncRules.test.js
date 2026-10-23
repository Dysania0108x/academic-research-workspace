import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleCaptures,captureProjectLabel} from '../extension/captureRules.mjs';
import {themeColor,themeChipStyle} from '../extension/themePalette.mjs';

test('local excerpts from another project are excluded',()=>{
 const items=[{id:'legacy'},{id:'a',projectId:'a'},{id:'b',projectId:'b'}];
 assert.deepEqual(eligibleCaptures(items,'a').map(x=>x.id),['legacy','a']);
 assert.deepEqual(eligibleCaptures(items,''),[]);
 assert.equal(captureProjectLabel(items[2],'a'),'Another project');
});
test('theme colors are deterministic across project ordering',()=>{
 assert.equal(themeColor(['zeta','alpha'],'alpha'),themeColor(['alpha','zeta'],'alpha'));
 assert.equal(themeChipStyle(['alpha'],'alpha').color,'#073b73');
});
