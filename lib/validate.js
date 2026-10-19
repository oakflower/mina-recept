// Validation and normalization of recipe input. Used for every way a recipe
// enters the system (API and file import) so the rules live in one place.

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Amounts may arrive as numbers (0.5) or text ("1/2"); missing means empty.
function cleanAmount(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function cleanPositiveNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : NaN;
}

function normalizeIngredients(list, errors) {
  if (!Array.isArray(list)) return [];
  const ingredients = [];
  for (const item of list) {
    const name = cleanText(item && item.name);
    const amount = cleanAmount(item && item.amount);
    const unit = cleanText(item && item.unit);
    if (!name && !amount && !unit) continue;
    if (!name) {
      errors.push('Varje ingrediens måste ha ett namn.');
      continue;
    }
    ingredients.push({ amount, unit, name });
  }
  return ingredients;
}

function normalizeStrings(list) {
  if (!Array.isArray(list)) return [];
  return list.map(cleanText).filter((text) => text !== '');
}

function normalizeTags(list) {
  const tags = [];
  for (const tag of normalizeStrings(list)) {
    const alreadyThere = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (!alreadyThere) tags.push(tag);
  }
  return tags;
}

// Returns { value } with a clean recipe, or { errors } with Swedish messages.
function normalizeRecipe(input) {
  const errors = [];
  const data = input && typeof input === 'object' ? input : {};

  const title = cleanText(data.title);
  if (!title) errors.push('Titel saknas.');

  const servings = cleanPositiveNumber(data.servings);
  if (Number.isNaN(servings)) errors.push('Portioner måste vara ett tal större än 0.');

  const cookingTimeMinutes = cleanPositiveNumber(data.cookingTimeMinutes);
  if (Number.isNaN(cookingTimeMinutes)) errors.push('Tillagningstid måste vara ett tal större än 0.');

  const ingredients = normalizeIngredients(data.ingredients, errors);
  const steps = normalizeStrings(data.steps);
  if (ingredients.length === 0) errors.push('Minst en ingrediens krävs.');
  if (steps.length === 0) errors.push('Minst ett steg krävs.');

  if (errors.length > 0) return { errors };

  return {
    value: {
      title,
      description: cleanText(data.description),
      servings,
      cookingTimeMinutes,
      ingredients,
      steps,
      tags: normalizeTags(data.tags),
    },
  };
}

module.exports = { normalizeRecipe };
