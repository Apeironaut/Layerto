import test from 'node:test';
import assert from 'node:assert';
import { calculateScaledBox } from './bbox.ts';

test('calculateScaledBox preserves exact coordinates at 1:1 scale', () => {
  const bbox: [number, number, number, number] = [100, 80, 250, 180];
  const scaled = calculateScaledBox(bbox, 800, 600, 800, 600);

  assert.strictEqual(scaled.x, 100);
  assert.strictEqual(scaled.y, 80);
  assert.strictEqual(scaled.width, 250);
  assert.strictEqual(scaled.height, 180);
});

test('calculateScaledBox scales correctly when display dimensions are halved (50% scale)', () => {
  const bbox: [number, number, number, number] = [100, 80, 250, 180];
  const scaled = calculateScaledBox(bbox, 800, 600, 400, 300);

  assert.strictEqual(scaled.x, 50);
  assert.strictEqual(scaled.y, 40);
  assert.strictEqual(scaled.width, 125);
  assert.strictEqual(scaled.height, 90);
});

test('calculateScaledBox scales correctly when display dimensions are doubled (200% scale)', () => {
  const bbox: [number, number, number, number] = [50, 40, 120, 90];
  const scaled = calculateScaledBox(bbox, 400, 300, 800, 600);

  assert.strictEqual(scaled.x, 100);
  assert.strictEqual(scaled.y, 80);
  assert.strictEqual(scaled.width, 240);
  assert.strictEqual(scaled.height, 180);
});

test('calculateScaledBox clamps boxes that extend past canvas boundaries', () => {
  const bbox: [number, number, number, number] = [700, 500, 300, 300]; // extends beyond 800x600
  const scaled = calculateScaledBox(bbox, 800, 600, 800, 600);

  assert.strictEqual(scaled.x, 700);
  assert.strictEqual(scaled.y, 500);
  assert.strictEqual(scaled.width, 100); // 800 - 700 = 100
  assert.strictEqual(scaled.height, 100); // 600 - 500 = 100
});

test('calculateScaledBox handles zero image dimensions gracefully', () => {
  const bbox: [number, number, number, number] = [100, 100, 50, 50];
  const scaled = calculateScaledBox(bbox, 0, 0, 400, 300);

  assert.deepStrictEqual(scaled, { x: 0, y: 0, width: 0, height: 0 });
});
