// The Express app. Takes a store so tests can use a temporary file.
const path = require('node:path');
const express = require('express');
const { normalizeRecipe } = require('./validate');
const { parseRecipeText } = require('./importer');
const { StorageError } = require('./store');

function filterFromQuery(query) {
  return { search: String(query.q || ''), tag: String(query.tag || '') };
}

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/recipes', (req, res) => {
    res.json(store.list(filterFromQuery(req.query)));
  });

  // Must be declared before /api/recipes/:id.
  app.get('/api/recipes/random', (req, res) => {
    const recipe = store.pickRandom(filterFromQuery(req.query));
    if (!recipe) return res.status(404).json({ errors: ['Inga recept matchar.'] });
    res.json(recipe);
  });

  app.get('/api/recipes/:id', (req, res) => {
    const recipe = store.get(req.params.id);
    if (!recipe) return res.status(404).json({ errors: ['Receptet finns inte.'] });
    res.json(recipe);
  });

  app.post('/api/recipes', (req, res) => {
    const result = normalizeRecipe(req.body);
    if (result.errors) return res.status(400).json({ errors: result.errors });
    res.status(201).json(store.create(result.value));
  });

  app.put('/api/recipes/:id', (req, res) => {
    const result = normalizeRecipe(req.body);
    if (result.errors) return res.status(400).json({ errors: result.errors });
    const recipe = store.update(req.params.id, result.value);
    if (!recipe) return res.status(404).json({ errors: ['Receptet finns inte.'] });
    res.json(recipe);
  });

  app.delete('/api/recipes/:id', (req, res) => {
    if (!store.remove(req.params.id)) return res.status(404).json({ errors: ['Receptet finns inte.'] });
    res.status(204).end();
  });

  app.get('/api/tags', (req, res) => {
    res.json(store.listTags());
  });

  app.post('/api/import', (req, res) => {
    const text = req.body && req.body.text;
    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ errors: ['Filen är tom.'] });
    }
    const { recipe, errors: parseErrors } = parseRecipeText(text);
    const result = normalizeRecipe(recipe);
    const errors = [...parseErrors, ...(result.errors || [])];
    if (errors.length > 0) return res.status(400).json({ errors });
    res.status(201).json(store.create(result.value));
  });

  // Bad request bodies, storage failures and other unexpected errors.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ errors: ['Ogiltig JSON.'] });
    if (err.type === 'entity.too.large') return res.status(413).json({ errors: ['Filen är för stor (högst 1 MB).'] });
    if (err instanceof StorageError) {
      console.error(err);
      return res.status(500).json({ errors: [err.message] });
    }
    console.error(err);
    res.status(500).json({ errors: ['Något gick fel på servern.'] });
  });

  return app;
}

module.exports = { createApp };
