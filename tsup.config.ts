import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
  minify: false,
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
  treeshake: true,
  noExternal: ["@useknockout/node"],
});
