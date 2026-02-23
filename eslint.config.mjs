import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js", "**/*.mjs", "**/*.cjs"],
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Forbid explicit `any` — use `unknown` or proper types instead
      "@typescript-eslint/no-explicit-any": "error",
      // Forbid non-null assertions (!) — use proper narrowing
      "@typescript-eslint/no-non-null-assertion": "error",
      // Forbid empty object types — use `Record<string, never>` or `object`
      "@typescript-eslint/no-empty-object-type": "error",
      // Forbid require-style imports
      "@typescript-eslint/no-require-imports": "error",
    },
  },
  // Relax non-null assertions in test files — result[0]!.prop is standard test practice
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
