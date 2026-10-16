// Mina recept – frontend. No framework, no build step.
// Routes (hash based):  #/  ·  #/recept/ID  ·  #/nytt  ·  #/redigera/ID
// The list filter lives in the hash query (?q=...&tag=...) so it survives navigation.

const main = document.getElementById('main');

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
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`/api${path}`, options);
  const data = response.status === 204 ? null : await response.json();
  return { ok: response.ok, status: response.status, data };
}

function queryString(filter) {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.tag) params.set('tag', filter.tag);
  const text = params.toString();
  return text ? `?${text}` : '';
}

function parseHash() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  return { segments: path.split('/').filter(Boolean), filter: { q: params.get('q') || '', tag: params.get('tag') || '' } };
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
  return parts.join(' · ');
}

async function randomRecipe(filter) {
  const result = await api('GET', `/recipes/random${queryString(filter)}`);
  if (!result.ok) return null;
  return result.data;
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

  function rememberFilter() {
    history.replaceState(null, '', `#/${queryString(filter)}`);
  }

  async function refresh() {
    rememberFilter();
    const result = await api('GET', `/recipes${queryString(filter)}`);
    renderResults(result.data);
  }

  function renderResults(recipes) {
    if (recipes.length === 0) {
      resultsContainer.replaceChildren(el('p', {}, 'Inga recept hittades.'));
      return;
    }
    const items = recipes.map((recipe) => el('li', {}, el('a', { class: 'recipe-card', href: `#/recept/${recipe.id}${queryString(filter)}` },
      el('span', { class: 'title' }, recipe.title),
      el('span', { class: 'meta' }, [formatMeta(recipe), recipe.tags.join(', ')].filter(Boolean).join(' · ')))));
    resultsContainer.replaceChildren(el('ul', { class: 'recipe-list' }, items));
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

  async function onRandomClick() {
    const recipe = await randomRecipe(filter);
    if (recipe) location.hash = `#/recept/${recipe.id}${queryString(filter)}`;
    else showErrors(errorBox, ['Inga recept att slumpa bland.']);
  }

  async function onFileChosen(event) {
    const file = event.target.files[0];
    if (!file) return;
    const result = await api('POST', '/import', { text: await file.text() });
    if (result.ok) location.hash = `#/recept/${result.data.id}`;
    else showErrors(errorBox, result.data.errors);
    event.target.value = '';
  }

  setPage('',
    el('h1', {}, 'Mina recept'),
    el('div', { class: 'field' }, el('label', { for: 'search' }, 'Sök på titel eller ingrediens'), searchInput),
    tagContainer,
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'button primary', onclick: onRandomClick }, 'Slumpa recept'),
      el('a', { class: 'button', href: '#/nytt' }, 'Nytt recept')),
    errorBox,
    resultsContainer,
    el('section', { class: 'import-box' },
      el('h2', {}, 'Importera från fil'),
      el('p', {}, 'Ladda upp en .txt- eller .csv-fil (från Excel: spara som CSV UTF-8). Receptet sparas direkt.'),
      el('p', {}, el('a', { href: 'mall.txt', download: 'recept-mall.txt' }, 'Ladda ner mall')),
      el('label', { for: 'import-file' }, 'Välj fil'),
      el('input', { type: 'file', id: 'import-file', accept: '.txt,.csv,text/plain,text/csv', onchange: onFileChosen })));

  const [tags] = await Promise.all([api('GET', '/tags'), refresh()]);
  renderTags(tags.data);
}

// ---------- Recipe view ----------

async function showRecipe(id, filter) {
  const result = await api('GET', `/recipes/${id}`);
  if (!result.ok) {
    setPage('Hittades inte', el('h1', {}, 'Receptet finns inte'), el('a', { href: '#/' }, 'Till alla recept'));
    return;
  }
  const recipe = result.data;
  const errorBox = el('div', { role: 'alert' });

  async function onRandomClick() {
    const next = await randomRecipe(filter);
    if (next) location.hash = `#/recept/${next.id}${queryString(filter)}`;
    else showErrors(errorBox, ['Inga recept att slumpa bland.']);
  }

  async function onDeleteClick() {
    if (!confirm(`Ta bort "${recipe.title}"? Det går inte att ångra.`)) return;
    const deleted = await api('DELETE', `/recipes/${id}`);
    if (deleted.ok) location.hash = `#/${queryString(filter)}`;
    else showErrors(errorBox, deleted.data.errors);
  }

  const ingredientItems = recipe.ingredients.map((ingredient) =>
    el('li', {}, [ingredient.amount, ingredient.unit, ingredient.name].filter(Boolean).join(' ')));
  const stepItems = recipe.steps.map((step) => el('li', {}, step));

  setPage(recipe.title,
    el('a', { href: `#/${queryString(filter)}` }, '← Alla recept'),
    el('h1', {}, recipe.title),
    el('p', { class: 'meta' }, formatMeta(recipe)),
    recipe.description ? el('p', {}, recipe.description) : '',
    recipe.tags.length ? el('p', {}, recipe.tags.map((tag) => el('span', { class: 'tag-chip' }, tag))) : '',
    el('h2', {}, 'Ingredienser'),
    el('ul', { class: 'ingredients' }, ingredientItems),
    el('h2', {}, 'Gör så här'),
    el('ol', { class: 'steps' }, stepItems),
    errorBox,
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'button primary', onclick: onRandomClick }, 'Slumpa ett nytt'),
      el('a', { class: 'button', href: `#/redigera/${id}` }, 'Redigera'),
      el('button', { type: 'button', class: 'button danger', onclick: onDeleteClick }, 'Ta bort')));
}

// ---------- Create / edit form ----------

function ingredientRow(ingredient = { amount: '', unit: '', name: '' }) {
  const row = el('div', { class: 'ingredient-row', 'data-row': 'ingredient' },
    el('div', {}, el('label', {}, 'Mängd'), el('input', { type: 'text', 'data-field': 'amount', value: ingredient.amount, inputmode: 'decimal' })),
    el('div', {}, el('label', {}, 'Enhet'), el('input', { type: 'text', 'data-field': 'unit', value: ingredient.unit })),
    el('div', { class: 'name-field' }, el('label', {}, 'Ingrediens'), el('input', { type: 'text', 'data-field': 'name', value: ingredient.name })),
    el('div', {}, el('button', { type: 'button', class: 'button danger row-remove', onclick: () => row.remove() }, 'Ta bort ingrediens')));
  return row;
}

function stepRow(text = '') {
  const row = el('div', { class: 'step-row', 'data-row': 'step' },
    el('label', {}, 'Steg'),
    el('textarea', { 'data-field': 'text' }, text),
    el('button', { type: 'button', class: 'button danger row-remove', onclick: () => row.remove() }, 'Ta bort steg'));
  return row;
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
    tags: fieldValue(form, 'tags').split(','),
    ingredients,
    steps,
  };
}

async function showForm(id) {
  let recipe = { title: '', description: '', servings: '', cookingTimeMinutes: '', ingredients: [], steps: [], tags: [] };
  if (id) {
    const result = await api('GET', `/recipes/${id}`);
    if (!result.ok) {
      setPage('Hittades inte', el('h1', {}, 'Receptet finns inte'), el('a', { href: '#/' }, 'Till alla recept'));
      return;
    }
    recipe = result.data;
  }

  const errorBox = el('div', { role: 'alert' });
  const ingredientRows = el('div', {}, (recipe.ingredients.length ? recipe.ingredients : [undefined]).map(ingredientRow));
  const stepRows = el('div', {}, (recipe.steps.length ? recipe.steps : ['']).map(stepRow));

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
      el('div', { class: 'field' }, el('label', { for: 'time' }, 'Tid (minuter)'), el('input', { type: 'number', min: '1', id: 'time', 'data-field': 'cookingTimeMinutes', value: recipe.cookingTimeMinutes ?? '' }))),
    el('div', { class: 'field' }, el('label', { for: 'tags' }, 'Taggar (separera med komma)'), el('input', { type: 'text', id: 'tags', 'data-field': 'tags', value: recipe.tags.join(', ') })),
    el('fieldset', {}, el('legend', {}, 'Ingredienser'), ingredientRows,
      el('button', { type: 'button', class: 'button', onclick: () => ingredientRows.append(ingredientRow()) }, 'Lägg till ingrediens')),
    el('fieldset', {}, el('legend', {}, 'Steg'), stepRows,
      el('button', { type: 'button', class: 'button', onclick: () => stepRows.append(stepRow()) }, 'Lägg till steg')),
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
