import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".next/**",
      "out/**",
      ".turbo/**",
      "coverage/**",
      ".venv/**"
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
        ...globals.browser
      }
    },
  },
  {
    // Node-side config files (next.config.mjs, *.config.cjs, tooling scripts)
    // run outside the browser and legitimately use process/module/require.
    files: ["**/*.cjs", "**/*.mjs", "**/*.js", "**/scripts/**"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-namespace": ["error", { "allowDeclarations": true }],
      // Ports from frontend-kids use `any` for untyped API payloads.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-unused-vars": "off",
    },
  },
  {
    // Must come after tseslint.configs.recommended, which re-enables this rule.
    files: ["**/*.cjs", "**/*.mjs", "**/*.js", "**/scripts/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  prettier,
];
