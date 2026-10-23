import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, usernameProblem } from './username.ts';

test('username shape', () => {
  for (const ok of ['naveen', 'nav_c', 'n.chethiya', 'abc', 'Naveen']) assert.equal(usernameProblem(ok), null, ok);
  for (const bad of ['ab', '_abc', 'abc_', 'a..b', 'na veen', 'naveen!']) assert.notEqual(usernameProblem(bad), null, bad);
  assert.equal(normalizeUsername('  NaVeen '), 'naveen');
});
