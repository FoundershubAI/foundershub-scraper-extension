module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "script",
  },
  globals: {
    chrome: "readonly",
    self: "readonly",
  },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
