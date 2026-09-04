import * as Doctest from "@effect/doctest/Plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [Doctest.plugin()],
  test: {
    include: ["src/**/*.test.ts"],
    includeSource: ["src/**/*.ts"],
  },
})
