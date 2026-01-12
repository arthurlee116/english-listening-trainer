import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

const appFiles = [
  "app/**/*.{js,jsx,ts,tsx}",
  "components/**/*.{js,jsx,ts,tsx}",
  "hooks/**/*.{js,jsx,ts,tsx}",
  "lib/**/*.{js,jsx,ts,tsx}",
  "scripts/**/*.{js,jsx,ts,tsx}",
  "config/**/*.{js,jsx,ts,tsx}",
];

const testFiles = ["tests/**/*.{js,jsx,ts,tsx}"];

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  history: "readonly",
  navigator: "readonly",
  location: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
};

const testGlobals = {
  ...browserGlobals,
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  vi: "readonly",
};

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
};

const nodeFiles = ["next.config.mjs", "config/**/*.mjs", "scripts/**/*.mjs"];

const ignorePatterns = [
  ".next/**",
  ".next-admin/**",
  "dist/**",
  "build/**",
  "out/**",
  "node_modules/**",
  "test-results/**",
  "data/**",
  "kokoro-local/venv/**",
  "public/audio/**",
  "*.log",
  "logs/**",
];

export default tseslint.config(
  {
    ignores: ignorePatterns,
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
    settings: {
      next: {
        rootDir: "./",
      },
    },
    ignores: ignorePatterns,
  },
  {
    files: appFiles,
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: testFiles,
    languageOptions: {
      globals: testGlobals,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
  }
);
