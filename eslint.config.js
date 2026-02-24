// eslint.config.js
// @ai-rules:
// 1. [Constraint]: ESLint 9+ flat config. Scope: gnome-extension/**/*.js only.
// 2. [Pattern]: GJS ESM globals (GNOME 45+). No legacy `imports` global.
// 3. [Gotcha]: gi:// and resource:/// specifiers are valid ESM strings.

import js from "@eslint/js";

export default [
  {
    files: ["gnome-extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        global: "readonly",
        log: "readonly",
        logError: "readonly",
        print: "readonly",
        _: "readonly",
        ngettext: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
