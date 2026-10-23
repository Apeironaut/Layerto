import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordChecks, passwordStrength, passwordValid } from './passwordPolicy.ts';

test('matches the server rules', () => {
  assert.equal(passwordValid('Abcdef1!'), true);
  assert.equal(passwordValid('Ab1!'), false); // too short
  assert.equal(passwordValid('abcdefgh!'), false); // no number
  assert.equal(passwordValid('12345678!'), false); // no letter
  assert.equal(passwordValid('abcdefg12'), false); // no symbol
  assert.equal(passwordValid('naveen#2026', { username: 'naveen' }), false);
  assert.equal(passwordValid('x!Kasun99', { email: 'kasun@shop.lk' }), false);
  assert.equal(passwordValid('ok#Pass99', { username: 'ab', email: 'ab@x.io' }), true);
});

test('lists each rule', () => {
  const failed = passwordChecks('abc').filter((c) => !c.ok).map((c) => c.id);
  assert.deepEqual(failed, ['length', 'number', 'symbol']);
});

test('strength grows with length once valid', () => {
  assert.equal(passwordStrength(''), 0);
  assert.equal(passwordStrength('Abcdef1!'), 2);
  assert.equal(passwordStrength('Abcdef1!xyzw'), 3);
  assert.equal(passwordStrength('Abcdef1!xyzwxyzw'), 4);
});
