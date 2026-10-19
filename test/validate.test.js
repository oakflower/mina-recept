const test = require('node:test');
const assert = require('node:assert');
const { normalizeRecipe } = require('../lib/validate');
const { sampleRecipe } = require('./helpers');

test('a valid recipe is accepted', () => {
  const result = normalizeRecipe(sampleRecipe());
  assert.strictEqual(result.errors, undefined);
  assert.strictEqual(result.value.title, 'Pannkakor');
});

test('text is trimmed and empty rows are dropped', () => {
  const { value } = normalizeRecipe(
    sampleRecipe({
      title: '  Soppa  ',
      ingredients: [{ amount: ' 2 ', unit: ' dl ', name: ' Vatten ' }, { amount: '', unit: '', name: '' }],
      steps: ['  Koka  ', '   '],
    })
  );
  assert.strictEqual(value.title, 'Soppa');
  assert.deepStrictEqual(value.ingredients, [{ amount: '2', unit: 'dl', name: 'Vatten' }]);
  assert.deepStrictEqual(value.steps, ['Koka']);
});

test('missing title, ingredients and steps are reported', () => {
  const { errors } = normalizeRecipe({});
  assert.ok(errors.includes('Titel saknas.'));
  assert.ok(errors.includes('Minst en ingrediens krävs.'));
  assert.ok(errors.includes('Minst ett steg krävs.'));
});

test('an ingredient without a name is rejected', () => {
  const { errors } = normalizeRecipe(sampleRecipe({ ingredients: [{ amount: '2', unit: 'dl', name: '' }] }));
  assert.ok(errors.includes('Varje ingrediens måste ha ett namn.'));
});

test('servings and time are optional but must be positive numbers', () => {
  const optional = normalizeRecipe(sampleRecipe({ servings: '', cookingTimeMinutes: undefined }));
  assert.strictEqual(optional.value.servings, null);
  assert.strictEqual(optional.value.cookingTimeMinutes, null);
  assert.ok(normalizeRecipe(sampleRecipe({ servings: 0 })).errors);
  assert.ok(normalizeRecipe(sampleRecipe({ cookingTimeMinutes: 'abc' })).errors);
  assert.strictEqual(normalizeRecipe(sampleRecipe({ servings: '4' })).value.servings, 4);
});

test('a null ingredient is treated as an empty row instead of crashing', () => {
  const { errors } = normalizeRecipe(sampleRecipe({ ingredients: [null] }));
  assert.ok(errors.includes('Minst en ingrediens krävs.'));
});

test('a null amount becomes an empty string and a numeric amount is kept', () => {
  const { value } = normalizeRecipe(
    sampleRecipe({
      ingredients: [
        { amount: null, unit: '', name: 'Salt' },
        { amount: 0.5, unit: 'dl', name: 'Mjölk' },
      ],
    })
  );
  assert.deepStrictEqual(value.ingredients, [
    { amount: '', unit: '', name: 'Salt' },
    { amount: '0.5', unit: 'dl', name: 'Mjölk' },
  ]);
});

test('duplicate tags are removed ignoring case', () => {
  const { value } = normalizeRecipe(sampleRecipe({ tags: ['Middag', 'middag', ' Snabbt ', ''] }));
  assert.deepStrictEqual(value.tags, ['Middag', 'Snabbt']);
});

test('non-object input is rejected without crashing', () => {
  assert.ok(normalizeRecipe(null).errors);
  assert.ok(normalizeRecipe('hej').errors);
});
