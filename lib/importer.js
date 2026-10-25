// Turns the text of an uploaded .txt/.csv file into recipe input.
// The format is described by public/mall.txt. The result still has to go
// through normalizeRecipe before it is saved.

const SINGLE_VALUE_HEADINGS = {
  titel: 'title',
  beskrivning: 'description',
  portioner: 'servings',
  tid: 'cookingTimeMinutes',
  kalorier: 'caloriesPerServing',
  taggar: 'tags',
};
const LIST_HEADINGS = { ingredienser: 'ingredients', steg: 'steps' };

// "Titel: Pannkakor" or "Titel;Pannkakor" -> { heading: 'titel', value: 'Pannkakor' }
function splitHeadingLine(line) {
  const match = line.match(/^([A-Za-zÅÄÖåäö]+)\s*(?:[:;]\s*(.*))?$/);
  if (!match) return null;
  const heading = match[1].toLowerCase();
  const known = heading in SINGLE_VALUE_HEADINGS || heading in LIST_HEADINGS;
  return known ? { heading, value: (match[2] || '').trim() } : null;
}

// Excel pads rows with trailing semicolons.
function stripTrailingSemicolons(line) {
  return line.replace(/[;\s]+$/, '');
}

// "2;dl;mjölk" -> amount, unit, name. Fewer parts: "4;ägg" or just "salt".
function parseIngredientLine(line) {
  const parts = line.split(';').map((part) => part.trim());
  const name = parts[parts.length - 1];
  const amount = parts.length > 1 ? parts[0] : '';
  const unit = parts.length > 2 ? parts[1] : '';
  return { amount, unit, name };
}

function parseStepLine(line) {
  return line.replace(/^\d+\s*[.)]\s*/, '');
}

function splitTags(value) {
  return value.split(/[,;]/);
}

// Returns { recipe, errors }.
function parseRecipeText(text) {
  const recipe = { ingredients: [], steps: [] };
  const errors = [];
  let currentList = null;

  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = stripTrailingSemicolons(rawLine.trim());
    if (line === '') continue;

    const headingLine = splitHeadingLine(line);
    if (headingLine && headingLine.heading in SINGLE_VALUE_HEADINGS) {
      currentList = null;
      const field = SINGLE_VALUE_HEADINGS[headingLine.heading];
      recipe[field] = field === 'tags' ? splitTags(headingLine.value) : headingLine.value;
    } else if (headingLine) {
      currentList = LIST_HEADINGS[headingLine.heading];
      if (headingLine.value !== '') errors.push(`Skriv "${headingLine.heading}" på en egen rad, följt av en rad per post.`);
    } else if (currentList === 'ingredients') {
      recipe.ingredients.push(parseIngredientLine(line));
    } else if (currentList === 'steps') {
      recipe.steps.push(parseStepLine(line));
    } else {
      errors.push(`Kunde inte tolka raden: "${line}"`);
    }
  }
  return { recipe, errors };
}

module.exports = { parseRecipeText };
