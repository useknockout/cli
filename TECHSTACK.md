---
project: projects/useknockout-cli
type: techstack
---

# Tech Stack — @useknockout/cli

## Languages

- **TypeScript** (`^5.6.0`) — the entire CLI is written in a single TypeScript file (`src/cli.ts`).
- **JavaScript (CommonJS)** — the build output is a single bundled `.cjs` file with a `#!/usr/bin/env node` shebang.

## Runtime

- **Node.js** `>= 18` (`engines.node`). Build target is `node18` / `ES2022`.
- Uses only Node built-ins for I/O and arg parsing — no third-party CLI framework:
  - `node:util` → `parseArgs` for command-line flag parsing.
  - `node:fs/promises` → `writeFile`, `mkdir`.
  - `node:path` → `basename`, `dirname`, `extname`, `join`, `resolve`.

## Dependencies

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `@useknockout/node` | `^0.5.0` | Official TypeScript/Node client for the useknockout API. Provides the `Knockout` class and `KnockoutError`. Every CLI command is a thin wrapper over one of its methods (`remove`, `removeUrl`, `replaceBackground`, `removeBatch`, `removeBatchUrl`, `mask`, `smartCrop`, `shadow`, `sticker`, `outline`, `studioShot`, `compare`, `headshot`, `preview`, `upscale`, `faceRestore`, `colorize`, `silhouette`, `inpaint`, `estimate`, `stats`, `health`). It is **bundled** into the output (see `noExternal` below), so the published package has no resolvable runtime dependency. The client itself ships with zero runtime dependencies and uses `fetch`/`FormData`. |

### Development

| Package | Version | Purpose |
|---|---|---|
| `typescript` | `^5.6.0` | Type checking (`tsc --noEmit`) and language tooling. |
| `tsup` | `^8.3.0` | Bundler/build tool. Bundles `src/cli.ts` (and the inlined `@useknockout/node`) into a single CJS file. |
| `@types/node` | `^22.7.0` | Type definitions for Node built-ins. |
| `tsx` | (invoked via `npm run dev`) | Runs the TypeScript entry directly during development (`node --loader tsx src/cli.ts`). Not declared in `devDependencies`; expected via `npx`/global. |

## Build & Publish

- **Bundler:** `tsup` (config in `tsup.config.ts`):
  - Entry: `src/cli.ts` → `dist/cli.cjs`.
  - Format: CJS only. `target: node18`. `treeshake: true`, `clean: true`, no minify, no sourcemaps, no `.d.ts`.
  - `banner.js` injects the `#!/usr/bin/env node` shebang.
  - `noExternal: ["@useknockout/node"]` inlines the client into the bundle.
- **TypeScript config** (`tsconfig.json`): `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `moduleResolution: Bundler`, `target ES2022`, output to `./dist`.
- **npm scripts:**
  - `build` → `tsup`
  - `typecheck` → `tsc --noEmit`
  - `dev` → `node --loader tsx src/cli.ts`
  - `prepublishOnly` → `npm run build` (auto-build before publish)
- **Binaries:** `useknockout` and `knockout`, both pointing at `./dist/cli.cjs`.
- **Published files:** `dist`, `README.md`, `LICENSE` (`publishConfig.access: public`). Source and config are excluded via `.npmignore`.

## External APIs

- **useknockout API** — hosted background-removal / image-processing service.
  - Default base URL: `https://useknockout--api.modal.run` (deployed on [Modal](https://modal.com)). Overridable via `--base-url` or the client's `baseUrl` option.
  - Auth: Bearer token via `--token`, the `KNOCKOUT_TOKEN` env var, or a bundled public beta token.
  - Underlying model: `ZhengPeng7/BiRefNet` for background removal, plus Swin2SR / Real-ESRGAN (upscale), GFPGAN (face restore), DDColor (colorize), and LaMa (inpaint).
  - All HTTP communication is handled inside `@useknockout/node`; the CLI never makes raw HTTP calls.

## LLM / AI prompts

None. This is an image-processing API client and contains no LLM prompts.
