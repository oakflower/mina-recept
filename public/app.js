// Mina recept – frontend. No framework, no build step.
// Routes (hash based):  #/  ·  #/recept/ID  ·  #/nytt  ·  #/redigera/ID
// The list filter lives in the hash query (?q=...&tag=...) so it survives navigation.

const main = document.getElementById('main');
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PAGE_SIZE = 30; // recipes shown at a time in the list

// ---------- Small helpers ----------

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'class') element.className = value;
    else if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
    else if (value === true) element.setAttribute(name, '');
    else if (value !== false && value !== null && value !== undefined) element.setAttribute(name, value);
  }
  for (const child of children.flat()) {
    element.append(child);
  }
  return element;
}

async function api(method, path, body) {
  const options = { method, headers: {} };
  if (body instanceof Blob) {
    options.headers['Content-Type'] = body.type;
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(`/api${path}`, options);
    const data = response.status === 204 ? null : await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    // Network failure or a non-JSON response: report it like any other API error.
    return { ok: false, status: 0, data: { errors: ['Kunde inte nå servern. Försök igen.'] } };
  }
}

function queryString(filter) {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.maxKcal) params.set('maxKcal', filter.maxKcal);
  const text = params.toString();
  return text ? `?${text}` : '';
}

function parseHash() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  return { segments: path.split('/').filter(Boolean), filter: { q: params.get('q') || '', tag: params.get('tag') || '', maxKcal: params.get('maxKcal') || '' } };
}

function showErrors(container, errors) {
  container.replaceChildren();
  if (!errors || errors.length === 0) return;
  container.append(el('div', { class: 'errors' }, el('ul', {}, errors.map((message) => el('li', {}, message)))));
}

function setPage(title, ...content) {
  document.title = title ? `${title} – Mina recept` : 'Mina recept';
  main.replaceChildren(...content);
  main.focus();
}

function formatMeta(recipe) {
  const parts = [];
  if (recipe.servings) parts.push(`${recipe.servings} portioner`);
  if (recipe.cookingTimeMinutes) parts.push(`${recipe.cookingTimeMinutes} min`);
  if (recipe.caloriesPerServing) parts.push(`${recipe.caloriesPerServing} kcal/portion`);
  return parts.join(' · ');
}

// Shown instead of a page when a recipe could not be loaded.
function showLoadFailure(result) {
  if (result.status === 404) {
    setPage('Hittades inte', el('h1', {}, 'Receptet finns inte'), el('a', { href: '#/' }, 'Till alla recept'));
    return;
  }
  const errorBox = el('div', { role: 'alert' });
  showErrors(errorBox, result.data.errors);
  setPage('Något gick fel', el('h1', {}, 'Något gick fel'), errorBox, el('a', { href: '#/' }, 'Till alla recept'));
}

// Picks a random recipe and opens it, or shows why it could not.
async function openRandomRecipe(filter, errorBox) {
  const result = await api('GET', `/recipes/random${queryString(filter)}`);
  if (result.ok) {
    location.hash = `#/recept/${result.data.id}${queryString(filter)}`;
    return;
  }
  const errors = result.status === 404 ? ['Inga recept att slumpa bland.'] : result.data.errors;
  showErrors(errorBox, errors);
}

// ---------- List view ----------

async function showList(initialFilter) {
  const filter = { ...initialFilter };
  const errorBox = el('div', { role: 'alert' });
  const tagContainer = el('ul', { class: 'tag-list', 'aria-label': 'Filtrera på tagg' });
  const resultsContainer = el('div', { 'aria-live': 'polite' });

  const searchInput = el('input', {
    type: 'search', id: 'search', value: filter.q, autocomplete: 'off',
    oninput: () => { filter.q = searchInput.value; refresh(); },
  });

  const caloriesInput = el('input', {
    type: 'number', min: '1', id: 'max-kcal', value: filter.maxKcal, autocomplete: 'off',
    oninput: () => { filter.maxKcal = caloriesInput.value; refresh(); },
  });

  function rememberFilter() {
    history.replaceState(null, '', `#/${queryString(filter)}`);
  }

  async function refresh() {
    rememberFilter();
    const result = await api('GET', `/recipes${queryString(filter)}`);
    if (!result.ok) {
      showErrors(errorBox, result.data.errors);
      return;
    }
    showErrors(errorBox, []);
    renderResults(result.data);
  }

  function renderResults(recipes) {
    if (recipes.length === 0) {
      resultsContainer.replaceChildren(el('p', {}, 'Inga recept hittades.'));
      return;
    }
    const list = el('ul', { class: 'recipe-list' });
    resultsContainer.replaceChildren(list);
    showMoreRecipes(recipes, list, 0);
  }

  // Adds the next page of recipes to the list, with a button for the rest.
  function showMoreRecipes(recipes, list, start) {
    const end = Math.min(start + PAGE_SIZE, recipes.length);
    const items = recipes.slice(start, end).map((recipe) => el('li', {}, el('a', { class: 'recipe-card', href: `#/recept/${recipe.id}${queryString(filter)}` },
      el('span', { class: 'title' }, recipe.title),
      el('span', { class: 'meta' }, [formatMeta(recipe), recipe.tags.join(', ')].filter(Boolean).join(' · ')))));
    list.append(...items);
    resultsContainer.querySelector('.show-more')?.remove();
    if (end >= recipes.length) return;
    const onShowMoreClick = () => {
      showMoreRecipes(recipes, list, end);
      list.children[end].querySelector('a').focus();
    };
    resultsContainer.append(el('p', { class: 'show-more' },
      el('span', {}, `Visar ${end} av ${recipes.length} recept. `),
      el('button', { type: 'button', class: 'button', onclick: onShowMoreClick }, 'Visa fler')));
  }

  function renderTags(tags) {
    const buttons = tags.map((tag) => {
      const selected = tag.toLowerCase() === filter.tag.toLowerCase();
      const button = el('button', {
        type: 'button', class: 'tag', 'aria-pressed': String(selected),
        onclick: () => { filter.tag = selected ? '' : tag; renderTags(tags); refresh(); },
      }, tag);
      return el('li', {}, button);
    });
    tagContainer.replaceChildren(...buttons);
  }

  function onRandomClick() {
    return openRandomRecipe(filter, errorBox);
  }

  const importErrorBox = el('div', { role: 'alert' });

  async function onFileChosen(event) {
    const file = event.target.files[0];
    if (!file) return;
    const isWord = file.name.toLowerCase().endsWith('.docx');
    const result = await api('POST', '/import', isWord ? file.slice(0, file.size, DOCX_TYPE) : { text: await file.text() });
    showErrors(importErrorBox, []);
    if (result.ok) location.hash = `#/recept/${result.data.id}`;
    else showErrors(importErrorBox, result.data.errors);
    event.target.value = '';
  }

  setPage('',
    el('h1', {}, 'Mina recept'),
    el('div', { class: 'field' }, el('label', { for: 'search' }, 'Sök på titel eller ingrediens'), searchInput),
    el('div', { class: 'field' }, el('label', { for: 'max-kcal' }, 'Högst kcal per portion'), caloriesInput),
    tagContainer,
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'button primary', onclick: onRandomClick }, 'Slumpa recept'),
      el('a', { class: 'button', href: '#/nytt' }, 'Nytt recept')),
    errorBox,
    resultsContainer,
    el('section', { class: 'import-box' },
      el('h2', {}, 'Importera från fil'),
      el('p', {}, 'Ladda upp en .txt-, .csv- eller Word-fil (.docx). Från Excel: spara som CSV UTF-8. I Word skriver du rubrikerna som i mallen, en post per stycke. Receptet sparas direkt.'),
      el('p', {}, el('a', { href: 'mall.txt', download: 'recept-mall.txt' }, 'Ladda ner mall')),
      el('label', { for: 'import-file' }, 'Välj fil'),
      el('input', { type: 'file', id: 'import-file', accept: `.txt,.csv,.docx,text/plain,text/csv,${DOCX_TYPE}`, onchange: onFileChosen }),
      importErrorBox));

  const [tags] = await Promise.all([api('GET', '/tags'), refresh()]);
  if (tags.ok) renderTags(tags.data);
}

// ---------- Recipe view ----------

async function showRecipe(id, filter) {
  const result = await api('GET', `/recipes/${id}`);
  if (!result.ok) {
    showLoadFailure(result);
    return;
  }
  const recipe = result.data;
  const errorBox = el('div', { role: 'alert' });

  function onRandomClick() {
    return openRandomRecipe(filter, errorBox);
  }

  async function onDeleteClick() {
    if (!confirm(`Ta bort "${recipe.title}"? Det går inte att ångra.`)) return;
    const deleted = await api('DELETE', `/recipes/${id}`);
    if (deleted.ok) location.hash = `#/${queryString(filter)}`;
    else showErrors(errorBox, deleted.data.errors);
  }

  const ingredientList = el('ul', { class: 'ingredients' });
  const servingsInput = el('input', {
    type: 'number', min: '1', id: 'servings', value: recipe.servings,
    oninput: renderIngredients,
  });

  function currentServings() {
    const servings = Number(servingsInput.value);
    return servings > 0 ? servings : recipe.servings;
  }

  function renderIngredients() {
    const servings = currentServings();
    const items = recipe.ingredients.map((ingredient) => {
      const amount = recipe.servings ? scaleAmount(ingredient.amount, recipe.servings, servings) : ingredient.amount;
      return el('li', {}, [amount, ingredient.unit, ingredient.name].filter(Boolean).join(' '));
    });
    ingredientList.replaceChildren(...items);
  }

  function changeServings(change) {
    servingsInput.value = Math.max(1, currentServings() + change);
    renderIngredients();
  }

  // Hidden when the recipe has no servings, since there is nothing to scale from.
  const servingsControl = recipe.servings
    ? el('div', { class: 'servings-control' },
      el('label', { for: 'servings' }, 'Portioner'),
      el('button', { type: 'button', class: 'button', 'aria-label': 'Färre portioner', onclick: () => changeServings(-1) }, '−'),
      servingsInput,
      el('button', { type: 'button', class: 'button', 'aria-label': 'Fler portioner', onclick: () => changeServings(1) }, '+'))
    : '';
  const stepItems = recipe.steps.map((step) => el('li', {}, step));

  setPage(recipe.title,
    el('a', { href: `#/${queryString(filter)}` }, '← Alla recept'),
    el('h1', {}, recipe.title),
    el('p', { class: 'meta' }, [
      recipe.cookingTimeMinutes ? `${recipe.cookingTimeMinutes} min` : '',
      recipe.caloriesPerServing ? `${recipe.caloriesPerServing} kcal/portion` : '',
    ].filter(Boolean).join(' · ')),
    recipe.description ? el('p', {}, recipe.description) : '',
    recipe.tags.length ? el('p', {}, recipe.tags.map((tag) => el('span', { class: 'tag-chip' }, tag))) : '',
    el('h2', {}, 'Ingredienser'),
    servingsControl,
    ingredientList,
    el('h2', {}, 'Gör så här'),
    el('ol', { class: 'steps' }, stepItems),
    errorBox,
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'button primary', onclick: onRandomClick }, 'Slumpa ett nytt'),
      el('a', { class: 'button', href: `#/redigera/${id}` }, 'Redigera'),
      el('button', { type: 'button', class: 'button danger', onclick: onDeleteClick }, 'Ta bort')));
  renderIngredients();
}

// ---------- Create / edit form ----------

// A label that wraps its field, so the field gets an accessible name without needing an id.
function labeledField(labelText, field) {
  return el('label', {}, el('span', { class: 'label-text' }, labelText), field);
}

function ingredientRow(ingredient = { amount: '', unit: '', name: '' }, onRemove) {
  return el('div', { class: 'ingredient-row', 'data-row': 'ingredient' },
    el('div', {}, labeledField('Mängd', el('input', { type: 'text', 'data-field': 'amount', value: ingredient.amount, inputmode: 'decimal' }))),
    el('div', {}, labeledField('Enhet', el('input', { type: 'text', 'data-field': 'unit', value: ingredient.unit }))),
    el('div', { class: 'name-field' }, labeledField('Ingrediens', el('input', { type: 'text', 'data-field': 'name', value: ingredient.name }))),
    el('div', {}, el('button', { type: 'button', class: 'button danger row-remove', onclick: onRemove }, 'Ta bort ingrediens')));
}

function stepRow(text = '', onRemove) {
  return el('div', { class: 'step-row', 'data-row': 'step' },
    labeledField('Steg', el('textarea', { 'data-field': 'text' }, text)),
    el('button', { type: 'button', class: 'button danger row-remove', onclick: onRemove }, 'Ta bort steg'));
}

// A list of rows the user can add to and remove from. Returns [rowsContainer, addButton].
// The remove buttons are numbered ("Ta bort ingrediens 2") so they can be told apart.
function editableList({ noun, addLabel, makeRow, items }) {
  const rows = el('div');
  const addButton = el('button', { type: 'button', class: 'button', onclick: onAddClick }, addLabel);

  function numberRemoveButtons() {
    [...rows.children].forEach((row, index) => {
      row.querySelector('.row-remove').setAttribute('aria-label', `Ta bort ${noun} ${index + 1}`);
    });
  }

  function addRow(item) {
    const row = makeRow(item, () => {
      row.remove();
      numberRemoveButtons();
      addButton.focus();
    });
    rows.append(row);
    numberRemoveButtons();
    return row;
  }

  function onAddClick() {
    addRow().querySelector('input, textarea').focus();
  }

  items.forEach((item) => addRow(item));
  return [rows, addButton];
}

function fieldValue(root, name) {
  return root.querySelector(`[data-field="${name}"]`).value;
}

function readForm(form) {
  const ingredients = [...form.querySelectorAll('[data-row="ingredient"]')].map((row) => ({
    amount: fieldValue(row, 'amount'), unit: fieldValue(row, 'unit'), name: fieldValue(row, 'name'),
  }));
  const steps = [...form.querySelectorAll('[data-row="step"]')].map((row) => fieldValue(row, 'text'));
  return {
    title: fieldValue(form, 'title'),
    description: fieldValue(form, 'description'),
    servings: fieldValue(form, 'servings'),
    cookingTimeMinutes: fieldValue(form, 'cookingTimeMinutes'),
    caloriesPerServing: fieldValue(form, 'caloriesPerServing'),
    tags: fieldValue(form, 'tags').split(','),
    ingredients,
    steps,
  };
}

async function showForm(id) {
  let recipe = { title: '', description: '', servings: '', cookingTimeMinutes: '', caloriesPerServing: '', ingredients: [], steps: [], tags: [] };
  if (id) {
    const result = await api('GET', `/recipes/${id}`);
    if (!result.ok) {
      showLoadFailure(result);
      return;
    }
    recipe = result.data;
  }

  const errorBox = el('div', { role: 'alert' });
  const ingredientList = editableList({
    noun: 'ingrediens', addLabel: 'Lägg till ingrediens', makeRow: ingredientRow,
    items: recipe.ingredients.length ? recipe.ingredients : [undefined],
  });
  const stepList = editableList({
    noun: 'steg', addLabel: 'Lägg till steg', makeRow: stepRow,
    items: recipe.steps.length ? recipe.steps : [''],
  });

  async function onSubmit(event) {
    event.preventDefault();
    const body = readForm(form);
    const result = id ? await api('PUT', `/recipes/${id}`, body) : await api('POST', '/recipes', body);
    if (result.ok) location.hash = `#/recept/${result.data.id}`;
    else {
      showErrors(errorBox, result.data.errors);
      errorBox.scrollIntoView({ block: 'center' });
    }
  }

  const form = el('form', { novalidate: true, onsubmit: onSubmit },
    el('div', { class: 'field' }, el('label', { for: 'title' }, 'Titel'), el('input', { type: 'text', id: 'title', 'data-field': 'title', value: recipe.title })),
    el('div', { class: 'field' }, el('label', { for: 'description' }, 'Beskrivning'), el('textarea', { id: 'description', 'data-field': 'description' }, recipe.description)),
    el('div', { class: 'field-row' },
      el('div', { class: 'field' }, el('label', { for: 'servings' }, 'Portioner'), el('input', { type: 'number', min: '1', id: 'servings', 'data-field': 'servings', value: recipe.servings ?? '' })),
      el('div', { class: 'field' }, el('label', { for: 'time' }, 'Tid (minuter)'), el('input', { type: 'number', min: '1', id: 'time', 'data-field': 'cookingTimeMinutes', value: recipe.cookingTimeMinutes ?? '' })),
      el('div', { class: 'field' }, el('label', { for: 'calories' }, 'Kalorier per portion (kcal)'), el('input', { type: 'number', min: '1', id: 'calories', 'data-field': 'caloriesPerServing', value: recipe.caloriesPerServing ?? '' }))),
    el('div', { class: 'field' }, el('label', { for: 'tags' }, 'Taggar (separera med komma)'), el('input', { type: 'text', id: 'tags', 'data-field': 'tags', value: recipe.tags.join(', ') })),
    el('fieldset', {}, el('legend', {}, 'Ingredienser'), ingredientList),
    el('fieldset', {}, el('legend', {}, 'Steg'), stepList),
    errorBox,
    el('div', { class: 'actions' },
      el('button', { type: 'submit', class: 'button primary' }, 'Spara'),
      el('a', { class: 'button', href: id ? `#/recept/${id}` : '#/' }, 'Avbryt')));

  setPage(id ? 'Redigera recept' : 'Nytt recept', el('h1', {}, id ? 'Redigera recept' : 'Nytt recept'), form);
}

// ---------- Routing ----------

function route() {
  const { segments, filter } = parseHash();
  const [first, id] = segments;
  if (first === 'recept' && id) return showRecipe(id, filter);
  if (first === 'nytt') return showForm(null);
  if (first === 'redigera' && id) return showForm(id);
  return showList(filter);
}

window.addEventListener('hashchange', route);
route();
