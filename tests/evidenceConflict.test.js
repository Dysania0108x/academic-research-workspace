import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceSaveConflict} from '../src/evidenceConflict.js';

test('new project without initialized baseline must not overwrite cloud evidence',()=>{
 assert.equal(evidenceSaveConflict(undefined,[]),'missing-baseline');
});
test('unchanged evidence allows save',()=>{
 const evidence=[{id:'one',quote:'A'}];
 assert.equal(evidenceSaveConflict(JSON.stringify(evidence),evidence),null);
});
test('other window adding evidence blocks stale save',()=>{
 const baseline=JSON.stringify([{id:'one'}]);
 assert.equal(evidenceSaveConflict(baseline,[{id:'one'},{id:'two'}]),'remote-changed');
});
test('other window editing or deleting evidence blocks stale save',()=>{
 const baseline=JSON.stringify([{id:'one',analysis:'before'}]);
 assert.equal(evidenceSaveConflict(baseline,[{id:'one',analysis:'after'}]),'remote-changed');
 assert.equal(evidenceSaveConflict(baseline,[]),'remote-changed');
});
