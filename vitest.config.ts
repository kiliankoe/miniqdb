import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `@/` resolves to src/, matching the Vite app config.
const srcAlias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: srcAlias },
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["test/integration/**/*.test.ts"],
          // Booting PocketBase and exercising it over HTTP is slow; give the
          // suite room and run its files serially against one shared instance.
          testTimeout: 20000,
          hookTimeout: 60000,
          fileParallelism: false,
        },
      },
    ],
  },
});
