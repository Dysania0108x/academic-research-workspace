import test from 'node:test';
import assert from 'node:assert/strict';
import {themeColor,THEME_PALETTE} from '../extension/themePalette.mjs';
test('theme colors are stable regardless of project theme order',()=>{
 const a=['Zeta','Alpha','Beta'];
 assert.equal(themeColor(a,'Alpha'),THEME_PALETTE[0]);
 assert.equal(themeColor(a,'Beta'),THEME_PALETTE[1]);
 assert.equal(themeColor([...a].reverse(),'Zeta'),THEME_PALETTE[2]);
});
