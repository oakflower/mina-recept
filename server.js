const path = require('node:path');
const { createApp } = require('./lib/app');
const { createStore } = require('./lib/store');

const port = process.env.PORT || 3000;
const store = createStore(path.join(__dirname, 'data', 'recipes.json'));

createApp(store).listen(port, () => {
  console.log(`Mina recept körs på http://localhost:${port}`);
});
