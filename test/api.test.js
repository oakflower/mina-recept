const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { createApp } = require('../lib/app');
const { createStore } = require('../lib/store');
const { makeTempFilePath, sampleRecipe } = require('./helpers');

// Starts the app on a random port with its own temp file; returns a small client.
async function startServer(random = () => 0, filePath = makeTempFilePath()) {
  const store = createStore(filePath, random);
  const server = createApp(store).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://localhost:${server.address().port}`;

  async function call(method, path, body) {
    const options = { method, headers: {} };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const response = await fetch(baseUrl + path, options);
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  function close() {
    server.close();
    server.closeAllConnections();
  }

  return { call, close };
}

async function withServer(testBody, random, filePath) {
  const server = await startServer(random, filePath);
  try {
    await testBody(server.call);
  } finally {
    server.close();
  }
}

test('POST /api/recipes creates a recipe and GET returns it', () =>
  withServer(async (call) => {
    const created = await call('POST', '/api/recipes', sampleRecipe());
    assert.strictEqual(created.status, 201);
    assert.ok(created.body.id);

    const fetched = await call('GET', `/api/recipes/${created.body.id}`);
    assert.strictEqual(fetched.status, 200);
    assert.strictEqual(fetched.body.title, 'Pannkakor');
  }));

test('POST /api/recipes returns 400 with Swedish messages for invalid input', () =>
  withServer(async (call) => {
    const response = await call('POST', '/api/recipes', { title: '' });
    assert.strictEqual(response.status, 400);
    assert.ok(response.body.errors.includes('Titel saknas.'));
  }));

test('POST /api/recipes returns 400 for malformed JSON', () =>
  withServer(async (call) => {
    const response = await call('POST', '/api/recipes', '{not json');
    assert.strictEqual(response.status, 400);
    assert.deepStrictEqual(response.body.errors, ['Ogiltig JSON.']);
  }));

test('GET /api/recipes lists, searches and filters by tag', () =>
  withServer(async (call) => {
    await call('POST', '/api/recipes', sampleRecipe({ title: 'Soppa', tags: ['Middag'] }));
    await call('POST', '/api/recipes', sampleRecipe({ title: 'Gröt', tags: ['Frukost'] }));

    const all = await call('GET', '/api/recipes');
    assert.deepStrictEqual(all.body.map((r) => r.title), ['Gröt', 'Soppa']);

    const bySearch = await call('GET', '/api/recipes?q=sop');
    assert.deepStrictEqual(bySearch.body.map((r) => r.title), ['Soppa']);

    const byTag = await call('GET', '/api/recipes?tag=Frukost');
    assert.deepStrictEqual(byTag.body.map((r) => r.title), ['Gröt']);
  }));

test('GET /api/recipes/:id returns 404 for unknown id', () =>
  withServer(async (call) => {
    const response = await call('GET', '/api/recipes/nope');
    assert.strictEqual(response.status, 404);
  }));

test('PUT /api/recipes/:id updates, validates and 404s', () =>
  withServer(async (call) => {
    const created = await call('POST', '/api/recipes', sampleRecipe());
    const id = created.body.id;

    const updated = await call('PUT', `/api/recipes/${id}`, sampleRecipe({ title: 'Ändrad' }));
    assert.strictEqual(updated.status, 200);
    assert.strictEqual(updated.body.title, 'Ändrad');

    const invalid = await call('PUT', `/api/recipes/${id}`, { title: '' });
    assert.strictEqual(invalid.status, 400);

    const missing = await call('PUT', '/api/recipes/nope', sampleRecipe());
    assert.strictEqual(missing.status, 404);
  }));

test('DELETE /api/recipes/:id deletes and 404s', () =>
  withServer(async (call) => {
    const created = await call('POST', '/api/recipes', sampleRecipe());
    const id = created.body.id;

    const deleted = await call('DELETE', `/api/recipes/${id}`);
    assert.strictEqual(deleted.status, 204);

    const gone = await call('GET', `/api/recipes/${id}`);
    assert.strictEqual(gone.status, 404);

    const again = await call('DELETE', `/api/recipes/${id}`);
    assert.strictEqual(again.status, 404);
  }));

test('GET /api/tags lists the tags in use', () =>
  withServer(async (call) => {
    await call('POST', '/api/recipes', sampleRecipe({ tags: ['Middag', 'Snabbt'] }));
    const response = await call('GET', '/api/tags');
    assert.deepStrictEqual(response.body, ['Middag', 'Snabbt']);
  }));

test('GET /api/recipes/random picks within the filter and 404s when nothing matches', () =>
  withServer(async (call) => {
    await call('POST', '/api/recipes', sampleRecipe({ title: 'Fisksoppa', tags: ['Fisk'] }));
    await call('POST', '/api/recipes', sampleRecipe({ title: 'Köttbullar', tags: ['Kött'] }));

    const picked = await call('GET', '/api/recipes/random?tag=Kött');
    assert.strictEqual(picked.status, 200);
    assert.strictEqual(picked.body.title, 'Köttbullar');

    const none = await call('GET', '/api/recipes/random?tag=Vegan');
    assert.strictEqual(none.status, 404);
  }));

test('POST /api/import saves a recipe from template text', () =>
  withServer(async (call) => {
    const text = 'Titel: Gröt\nPortioner: 2\nIngredienser:\n1;dl;havregryn\n2;dl;vatten\nSteg:\n1. Koka';
    const response = await call('POST', '/api/import', { text });
    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.title, 'Gröt');

    const list = await call('GET', '/api/recipes');
    assert.strictEqual(list.body.length, 1);
  }));

test('POST /api/import returns 400 and saves nothing for an unusable file', () =>
  withServer(async (call) => {
    const empty = await call('POST', '/api/import', { text: '   ' });
    assert.strictEqual(empty.status, 400);

    const garbage = await call('POST', '/api/import', { text: 'bara lite text' });
    assert.strictEqual(garbage.status, 400);
    assert.ok(garbage.body.errors.includes('Titel saknas.'));

    const list = await call('GET', '/api/recipes');
    assert.deepStrictEqual(list.body, []);
  }));

test('API returns 500 with a Swedish message when the recipe file is corrupt, and leaves it untouched', () => {
  const filePath = makeTempFilePath();
  fs.writeFileSync(filePath, '{ not json', 'utf8');
  return withServer(async (call) => {
    const list = await call('GET', '/api/recipes');
    assert.strictEqual(list.status, 500);
    assert.deepStrictEqual(list.body.errors, ['Receptfilen kunde inte läsas.']);

    const create = await call('POST', '/api/recipes', sampleRecipe());
    assert.strictEqual(create.status, 500);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), '{ not json');
  }, undefined, filePath);
});

test('POST /api/import returns 413 for a body over the size limit', () =>
  withServer(async (call) => {
    const response = await call('POST', '/api/import', { text: 'x'.repeat(1024 * 1024 + 1) });
    assert.strictEqual(response.status, 413);
    assert.deepStrictEqual(response.body.errors, ['Filen är för stor (högst 1 MB).']);
  }));
