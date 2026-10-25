// Storage layer. The only code that reads or writes the recipe file.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// A storage failure whose message is safe to show the user (Swedish).
class StorageError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'StorageError';
  }
}

// An unreadable file is never overwritten, so the recipes in it can still be recovered.
function readRecipes(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return text.trim() === '' ? [] : JSON.parse(text);
  } catch (error) {
    throw new StorageError('Receptfilen kunde inte läsas.', error);
  }
}

// Write to a temp file first, then rename, so a crash never leaves a half-written file.
function writeRecipes(filePath, recipes) {
  const tempPath = `${filePath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(recipes, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw new StorageError('Receptet kunde inte sparas.', error);
  }
}

function matchesSearch(recipe, search) {
  const needle = search.trim().toLowerCase();
  if (needle === '') return true;
  if (recipe.title.toLowerCase().includes(needle)) return true;
  return recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(needle));
}

function matchesTag(recipe, tag) {
  if (!tag) return true;
  return recipe.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
}

// Recipes without calories never match a calorie limit.
function matchesCalories(recipe, maxCalories) {
  if (!maxCalories) return true;
  return recipe.caloriesPerServing > 0 && recipe.caloriesPerServing <= maxCalories;
}

function sortByTitle(recipes) {
  return [...recipes].sort((a, b) => a.title.localeCompare(b.title, 'sv'));
}

// filePath: where recipes are stored. random: function returning [0, 1), injectable for tests.
function createStore(filePath, random = Math.random) {
  function list({ search = '', tag = '', maxCalories = null } = {}) {
    const matching = readRecipes(filePath).filter(
      (recipe) => matchesSearch(recipe, search) && matchesTag(recipe, tag) && matchesCalories(recipe, maxCalories)
    );
    return sortByTitle(matching);
  }

  function get(id) {
    return readRecipes(filePath).find((recipe) => recipe.id === id) || null;
  }

  function create(data) {
    const recipes = readRecipes(filePath);
    const recipe = { id: crypto.randomUUID(), ...data };
    writeRecipes(filePath, [...recipes, recipe]);
    return recipe;
  }

  function update(id, data) {
    const recipes = readRecipes(filePath);
    const index = recipes.findIndex((recipe) => recipe.id === id);
    if (index === -1) return null;
    const updated = { id, ...data };
    recipes[index] = updated;
    writeRecipes(filePath, recipes);
    return updated;
  }

  function remove(id) {
    const recipes = readRecipes(filePath);
    const remaining = recipes.filter((recipe) => recipe.id !== id);
    if (remaining.length === recipes.length) return false;
    writeRecipes(filePath, remaining);
    return true;
  }

  function listTags() {
    const tags = new Map();
    for (const recipe of readRecipes(filePath)) {
      for (const tag of recipe.tags) {
        if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
      }
    }
    return [...tags.values()].sort((a, b) => a.localeCompare(b, 'sv'));
  }

  function pickRandom(filter = {}) {
    const candidates = list(filter);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(random() * candidates.length)];
  }

  return { list, get, create, update, remove, listTags, pickRandom };
}

module.exports = { createStore, StorageError };
