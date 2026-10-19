// Validation and normalization of recipe input. Used for every way a recipe
// enters the system (API and file import) so the rules live in one place.

// Upper bounds so a single request cannot bloat the storage file.
const MAX_LENGTH = {
  title: 200,
  description: 5000,
  step: 2000,
  ingredientName: 200,
  ingredientAmount: 50,
  ingredientUnit: 50,
  tag: 50,
};
const MAX_COUNT = { ingredients: 100, steps: 100, tags: 20 };

// Adds the message once, even if many values break the same limit.
function requireMaxLength(texts, maxLength, message, errors) {
  const tooLong = texts.some((text) => text.length > maxLength);
  if (tooLong && !errors.includes(message)) errors.push(message);
}

function requireMaxCount(list, maxCount, message, errors) {
  if (list.length > maxCount) errors.push(message);
}

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

  const description = cleanText(data.description);
  const tags = normalizeTags(data.tags);

  requireMaxLength([title], MAX_LENGTH.title, `Titeln får vara högst ${MAX_LENGTH.title} tecken.`, errors);
  requireMaxLength([description], MAX_LENGTH.description, `Beskrivningen får vara högst ${MAX_LENGTH.description} tecken.`, errors);
  requireMaxLength(steps, MAX_LENGTH.step, `Varje steg får vara högst ${MAX_LENGTH.step} tecken.`, errors);
  requireMaxLength(tags, MAX_LENGTH.tag, `Varje tagg får vara högst ${MAX_LENGTH.tag} tecken.`, errors);
  requireMaxLength(ingredients.map((i) => i.name), MAX_LENGTH.ingredientName, `Ingrediensnamn får vara högst ${MAX_LENGTH.ingredientName} tecken.`, errors);
  requireMaxLength(ingredients.map((i) => i.amount), MAX_LENGTH.ingredientAmount, `Mängd får vara högst ${MAX_LENGTH.ingredientAmount} tecken.`, errors);
  requireMaxLength(ingredients.map((i) => i.unit), MAX_LENGTH.ingredientUnit, `Enhet får vara högst ${MAX_LENGTH.ingredientUnit} tecken.`, errors);

  requireMaxCount(ingredients, MAX_COUNT.ingredients, `Ett recept får ha högst ${MAX_COUNT.ingredients} ingredienser.`, errors);
  requireMaxCount(steps, MAX_COUNT.steps, `Ett recept får ha högst ${MAX_COUNT.steps} steg.`, errors);
  requireMaxCount(tags, MAX_COUNT.tags, `Ett recept får ha högst ${MAX_COUNT.tags} taggar.`, errors);

  if (errors.length > 0) return { errors };

  return {
    value: { title, description, servings, cookingTimeMinutes, ingredients, steps, tags },
  };
}

module.exports = { normalizeRecipe };
