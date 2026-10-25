const test = require('node:test');
const assert = require('node:assert');
const { scaleAmount } = require('../public/scale');

test('whole numbers and decimals are scaled', () => {
  assert.strictEqual(scaleAmount('2', 4, 8), '4');
  assert.strictEqual(scaleAmount('1,5', 2, 4), '3');
  assert.strictEqual(scaleAmount('0.5', 2, 3), '0,75');
});

test('fractions and mixed numbers are scaled', () => {
  assert.strictEqual(scaleAmount('1/2', 2, 4), '1');
  assert.strictEqual(scaleAmount('1 1/2', 2, 4), '3');
  assert.strictEqual(scaleAmount('1/3', 1, 1), '0,33');
});

test('ranges are scaled at both ends', () => {
  assert.strictEqual(scaleAmount('2-3', 2, 4), '4-6');
  assert.strictEqual(scaleAmount('2 – 3', 2, 4), '4-6');
});

test('text and empty amounts are returned unchanged', () => {
  assert.strictEqual(scaleAmount('en nypa', 2, 4), 'en nypa');
  assert.strictEqual(scaleAmount('', 2, 4), '');
  assert.strictEqual(scaleAmount('1/0', 2, 4), '1/0');
});
