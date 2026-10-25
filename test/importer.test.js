const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseRecipeText } = require('../lib/importer');
const { normalizeRecipe } = require('../lib/validate');

test('the downloadable template is itself a valid import', () => {
  const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'mall.txt'), 'utf8');
  const { recipe, errors } = parseRecipeText(template);
  assert.deepStrictEqual(errors, []);
  const result = normalizeRecipe(recipe);
  assert.strictEqual(result.errors, undefined);
  assert.strictEqual(result.value.title, 'Pannkakor');
  assert.strictEqual(result.value.servings, 4);
  assert.deepStrictEqual(result.value.tags, ['Frukost', 'Barnvänligt']);
  assert.deepStrictEqual(result.value.ingredients[0], { amount: '3', unit: 'dl', name: 'vetemjöl' });
  assert.strictEqual(result.value.ingredients[4].name, 'smör till stekning');
  assert.strictEqual(result.value.steps[0], 'Vispa ihop mjöl och hälften av mjölken till en slät smet.');
});

test('reads calories per serving from the Kalorier heading', () => {
  const { recipe, errors } = parseRecipeText('Titel: Soppa\nKalorier: 450\nIngredienser:\n1;dl;vatten\nSteg:\n1. Koka');
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(normalizeRecipe(recipe).value.caloriesPerServing, 450);
});

test('parses CSV exported from Excel (semicolons, padding, BOM, CRLF)', () => {
  const csv = [
    '﻿Titel;Soppa;;',
    'Portioner;2;;',
    'Taggar;Middag;Snabbt;',
    'Ingredienser;;;',
    '2;dl;vatten;',
    '1;;lök;',
    'Steg;;;',
    '1. Koka;;',
  ].join('\r\n');
  const { recipe, errors } = parseRecipeText(csv);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(recipe.title, 'Soppa');
  assert.deepStrictEqual(recipe.tags, ['Middag', 'Snabbt']);
  assert.deepStrictEqual(recipe.ingredients, [
    { amount: '2', unit: 'dl', name: 'vatten' },
    { amount: '1', unit: '', name: 'lök' },
  ]);
  assert.deepStrictEqual(recipe.steps, ['Koka']);
});

test('headings are case-insensitive', () => {
  const { recipe } = parseRecipeText('TITEL: A\ningredienser:\nsalt\nSTEG:\nBlanda');
  assert.strictEqual(recipe.title, 'A');
  assert.strictEqual(recipe.ingredients[0].name, 'salt');
});

test('lines that cannot be understood are reported', () => {
  const { errors } = parseRecipeText('Något helt annat');
  assert.deepStrictEqual(errors, ['Kunde inte tolka raden: "Något helt annat"']);
});
