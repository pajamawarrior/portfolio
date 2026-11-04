// ESLint rules for the site's JavaScript, with a focus on security.
// Any warning fails the pipeline (--max-warnings=0 in package.json).
import js from '@eslint/js';
import globals from 'globals';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import security from 'eslint-plugin-security';

export default [
  { ignores: ['node_modules/**', '_site/**'] },

  js.configs.recommended,
  security.configs.recommended,

  // Flags innerHTML, outerHTML, insertAdjacentHTML and document.write.
  noUnsanitized.configs.recommended,

  {
    rules: {
      // Running strings as code.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Off on purpose. This rule flags every obj[x], including array indexes,
      // and every hit in this code was a false positive. CodeQL covers the real
      // risk (prototype pollution, unsafe dynamic calls) with data-flow analysis.
      'security/detect-object-injection': 'off',
    },
  },

  // The browser script is a classic script, not a module.
  {
    files: ['script.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },

  // Tooling that runs in Node during the pipeline, never in a visitor's browser.
  {
    files: ['eslint.config.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
