import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, push, redo, replace, undo, HISTORY_LIMIT } from './history.ts';

test('undo and redo walk the snapshots', () => {
  let h = createHistory(1);
  h = push(h, 2);
  h = push(h, 3);
  h = undo(h);
  assert.equal(h.present, 2);
  h = undo(h);
  assert.equal(h.present, 1);
  assert.equal(undo(h), h, 'nothing left to undo');
  h = redo(h);
  assert.equal(h.present, 2);
  h = push(h, 9);
  assert.deepEqual(h.future, [], 'new edits clear redo');
});

test('replace and duplicates do not add steps', () => {
  let h = createHistory('a');
  h = replace(h, 'b');
  assert.deepEqual(h.past, []);
  assert.equal(push(h, 'b'), h);
});

test('history is capped', () => {
  let h = createHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = push(h, i);
  assert.equal(h.past.length, HISTORY_LIMIT);
});
