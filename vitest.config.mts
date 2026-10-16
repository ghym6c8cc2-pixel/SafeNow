import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: { "npm:jpeg-js@0.4.4": "jpeg-js", "npm:pngjs@7.0.0": "pngjs" },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
