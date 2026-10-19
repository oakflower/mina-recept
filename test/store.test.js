const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { createStore, StorageError } = require('../lib/store');
const { makeTempFilePath, sampleRecipe } = require('./helpers');

test('create assigns an id and the recipe can be read back', () => {
  const store = createStore(makeTempFilePath());
  const created = store.create(sampleRecipe());
  assert.ok(created.id);
  assert.deepStrictEqual(store.get(created.id), created);
});

test('list on a missing file returns an empty list', () => {
  const store = createStore(makeTempFilePath());
  assert.deepStrictEqual(store.list(), []);
});

test('get returns null for unknown id', () => {
  const store = createStore(makeTempFilePath());
  assert.strictEqual(store.get('nope'), null);
});

test('list is sorted by title', () => {
  const store = createStore(makeTempFilePath());
  store.create(sampleRecipe({ title: 'Ärtsoppa' }));
  store.create(sampleRecipe({ title: 'Bullar' }));
  store.create(sampleRecipe({ title: 'Allt' }));
  assert.deepStrictEqual(store.list().map((r) => r.title), ['Allt', 'Bullar', 'Ärtsoppa']);
});

test('update replaces the recipe and keeps the id', () => {
  const store = createStore(makeTempFilePath());
  const created = store.create(sampleRecipe());
  const updated = store.update(created.id, sampleRecipe({ title: 'Nytt namn' }));
  assert.strictEqual(updated.id, created.id);
  assert.strictEqual(store.get(created.id).title, 'Nytt namn');
});

test('update returns null for unknown id', () => {
  const store = createStore(makeTempFilePath());
  assert.strictEqual(store.update('nope', sampleRecipe()), null);
});

test('remove deletes the recipe', () => {
  const store = createStore(makeTempFilePath());
  const created = store.create(sampleRecipe());
  assert.strictEqual(store.remove(created.id), true);
  assert.strictEqual(store.get(created.id), null);
});

test('remove returns false for unknown id', () => {
  const store = createStore(makeTempFilePath());
  assert.strictEqual(store.remove('nope'), false);
});

test('search matches title, case-insensitive', () => {
  const store = createStore(makeTempFilePath());
  store.create(sampleRecipe({ title: 'Lasagne' }));
  store.create(sampleRecipe({ title: 'Soppa', ingredients: [{ amount: '', unit: '', name: 'Vatten' }] }));
  assert.deepStrictEqual(store.list({ search: 'LASAG' }).map((r) => r.title), ['Lasagne']);
});

test('search matches ingredient names', () => {
  const store = createStore(makeTempFilePath());
  store.create(sampleRecipe({ title: 'A', ingredients: [{ amount: '1', unit: 'burk', name: 'Kikärtor' }] }));
  store.create(sampleRecipe({ title: 'B', ingredients: [{ amount: '1', unit: 'dl', name: 'Ris' }] }));
  assert.deepStrictEqual(store.list({ search: 'kikärt' }).map((r) => r.title), ['A']);
});

test('tag filter matches case-insensitively and can combine with search', () => {
  const store = createStore(makeTempFilePath());
  store.create(sampleRecipe({ title: 'Soppa', tags: ['Middag'] }));
  store.create(sampleRecipe({ title: 'Sallad', tags: ['Lunch'] }));
  store.create(sampleRecipe({ title: 'Stek', tags: ['Middag'] }));
  assert.deepStrictEqual(store.list({ tag: 'middag' }).map((r) => r.title), ['Soppa', 'Stek']);
  assert.deepStrictEqual(store.list({ tag: 'Middag', search: 'ste' }).map((r) => r.title), ['Stek']);
});

test('listTags returns unique tags sorted, ignoring case differences', () => {
  const store = createStore(makeTempFilePath());
  store.create(sampleRecipe({ tags: ['Middag', 'Snabbt'] }));
  store.create(sampleRecipe({ tags: ['middag', 'Frukost'] }));
  assert.deepStrictEqual(store.listTags(), ['Frukost', 'Middag', 'Snabbt']);
});

test('pickRandom uses the injected random source', () => {
  const filePath = makeTempFilePath();
  const first = createStore(filePath, () => 0);
  first.create(sampleRecipe({ title: 'A' }));
  first.create(sampleRecipe({ title: 'B' }));
  first.create(sampleRecipe({ title: 'C' }));
  assert.strictEqual(createStore(filePath, () => 0).pickRandom().title, 'A');
  assert.strictEqual(createStore(filePath, () => 0.5).pickRandom().title, 'B');
  assert.strictEqual(createStore(filePath, () => 0.999).pickRandom().title, 'C');
});

test('pickRandom respects the filter and returns null when nothing matches', () => {
  const store = createStore(makeTempFilePath(), () => 0);
  store.create(sampleRecipe({ title: 'A', tags: ['Fisk'] }));
  store.create(sampleRecipe({ title: 'B', tags: ['Kött'] }));
  assert.strictEqual(store.pickRandom({ tag: 'Kött' }).title, 'B');
  assert.strictEqual(store.pickRandom({ tag: 'Vegan' }), null);
});

test('writing leaves no temp file behind', () => {
  const filePath = makeTempFilePath();
  createStore(filePath).create(sampleRecipe());
  assert.ok(fs.existsSync(filePath));
  assert.ok(!fs.existsSync(`${filePath}.tmp`));
});

test('a corrupt file throws a StorageError and is left untouched', () => {
  const filePath = makeTempFilePath();
  fs.writeFileSync(filePath, '{ not json', 'utf8');
  const store = createStore(filePath);
  assert.throws(() => store.list(), StorageError);
  assert.throws(() => store.create(sampleRecipe()), StorageError);
  assert.strictEqual(fs.readFileSync(filePath, 'utf8'), '{ not json');
});

test('a failed write throws a StorageError and leaves no temp file', () => {
  const blockingFile = makeTempFilePath();
  fs.writeFileSync(blockingFile, 'i am a file, not a directory', 'utf8');
  const filePath = `${blockingFile}${require('node:path').sep}recipes.json`;
  const store = createStore(filePath);
  assert.throws(() => store.create(sampleRecipe()), StorageError);
  assert.ok(!fs.existsSync(`${filePath}.tmp`));
});
