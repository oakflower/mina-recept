const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['server.js', 'lib/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // Frontend scripts are plain scripts loaded in the browser; scale.js also uses require() in tests.
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, module: 'writable' },
    },
  },
  {
    files: ['public/app.js'],
    languageOptions: { globals: { scaleAmount: 'readonly' } },
  },
];
