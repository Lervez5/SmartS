export default {
  "*": ["prettier --ignore-unknown --cache"],
  "*.{js,jsx,ts,tsx}": ["eslint --fix --cache"],
  "*.{json,yaml,yml}": ["prettier --write"],
  "*.md": ["prettier --write"]
};
