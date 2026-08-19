import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["node_modules/**", "dist/**", "build/**", "**/node_modules/**"] },
  { languageOptions: { globals: { ...globals.node, ...globals.es2021 } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  prettier
];
