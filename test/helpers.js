const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// A fresh, empty directory per test so tests never share state or touch data/recipes.json.
function makeTempFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mina-recept-'));
  return path.join(dir, 'recipes.json');
}

function sampleRecipe(overrides = {}) {
  return {
    title: 'Pannkakor',
    description: 'Tunna pannkakor',
    servings: 4,
    cookingTimeMinutes: 30,
    ingredients: [
      { amount: '3', unit: 'dl', name: 'Vetemjöl' },
      { amount: '6', unit: 'dl', name: 'Mjölk' },
    ],
    steps: ['Vispa', 'Stek'],
    tags: ['Frukost'],
    ...overrides,
  };
}

module.exports = { makeTempFilePath, sampleRecipe };
