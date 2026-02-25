import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/**/*.test.ts"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80,
      },
    },
  },
});
