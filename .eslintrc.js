module.exports = {
  env: {
    node: true,
    es6: true,
    mocha: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'import/named': 'off',
  },
  settings: {
    'import/resolver': {
      'babel-module': {},
    },
  },
};
