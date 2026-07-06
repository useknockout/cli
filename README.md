---
project: projects/useknockout-cli
type: readme
---

<div align="center">

  # 🥊 @useknockout/cli

  **Zero-install CLI for [useknockout](https://github.com/useknockout/api) — state-of-the-art background removal and image processing, right from your terminal.**

  [![MIT License](https://img.shields.io/badge/license-MIT-3da639)](./LICENSE)
  [![npm version](https://img.shields.io/npm/v/@useknockout/cli?color=cb3837)](https://www.npmjs.com/package/@useknockout/cli)
  [![npm downloads](https://img.shields.io/npm/dm/@useknockout/cli?color=cb3837)](https://www.npmjs.com/package/@useknockout/cli)
  [![GitHub stars](https://img.shields.io/github/stars/useknockout/cli?style=social)](https://github.com/useknockout/cli)
  [![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
  [![Runs via npx](https://img.shields.io/badge/runs%20via-npx-ff7a00)](https://docs.npmjs.com/cli/v10/commands/npx)

  [**Try in 10 seconds**](#try-it-in-10-seconds) · [**Commands**](#commands) · [**Global options**](#global-options) · [**API repo**](https://github.com/useknockout/api)

  <br/>

  <img src="https://raw.githubusercontent.com/useknockout/api/main/docs/hero.png" alt="useknockout before/after — background removal demo" width="800"/>

  <br/>

  *`npx @useknockout/cli remove cat.jpg` — done.*

</div>

---

## What is this?

`@useknockout/cli` is the official command-line interface for **useknockout**, a hosted background-removal and image-processing API. It is a thin, dependency-light wrapper around the [`@useknockout/node`](https://www.npmjs.com/package/@useknockout/node) client: you pass it a local file path or a URL, it calls the API, and it writes the resulting image to disk.

It ships with a bundled **public beta token**, so you can run it with `npx` and get a result without signing up for anything.

### Highlights

- **Zero-setup** — `npx @useknockout/cli remove cat.jpg`, no install or account required.
- **Broad feature coverage** — 19 image operations: remove, remove-url, replace, batch, mask, smart-crop, shadow, sticker, outline, studio-shot, compare, headshot, preview, upscale, face-restore, colorize, silhouette, inpaint, plus the `estimate`, `stats`, and `health` metadata commands.
- **Pipe- and script-friendly** — meaningful exit codes, a `--quiet` flag, and JSON output for `health` / `estimate` / `stats`.
- **Two binaries** — installs both `useknockout` and `knockout` on your PATH.
- **MIT licensed.**

---

## Try it in 10 seconds

```bash
npx @useknockout/cli remove ./photo.jpg
```

Done. A transparent PNG lands in the same folder as `photo-nobg.png`.

## Install (optional)

```bash
npm install -g @useknockout/cli
```

Now `useknockout` (or the shorter alias `knockout`) is on your PATH.

**Requirements:** Node.js >= 18.

---

## Commands

Run `useknockout --help` for the built-in reference. Every command accepts the [global options](#global-options) (`--token`, `--base-url`, `--quiet`) in addition to its own.

Most image commands share two options:

| Option | Short | Description |
|---|---|---|
| `--out <file>` | `-o` | Output path. Defaults to `<input>-<suffix>.<format>` next to the input. |
| `--format <fmt>` | `-f` | Output format (`png`, `webp`, and where alpha is not required, `jpg`). |

### `remove` — remove background → transparent PNG/WebP

```bash
useknockout remove cat.jpg
useknockout remove cat.jpg --out cutout.png --format png
useknockout remove cat.jpg --format webp
```

Default output suffix: `-nobg`. Default format: `png`.

### `remove-url` — remove background from a remote image URL

```bash
useknockout remove-url https://example.com/cat.jpg --out cat.png
```

The output filename is derived from the URL path when `--out` is omitted.

### `replace` — swap background for a color or image

```bash
# solid color
useknockout replace cat.jpg --bg-color "#FF5733" --format jpg

# remote image as the new background
useknockout replace cat.jpg --bg-url https://example.com/beach.jpg --out out.png
```

You must provide either `--bg-color` or `--bg-url`. Default suffix: `-bg`.

| Option | Description |
|---|---|
| `--bg-color <hex>` | Hex color, e.g. `"#007BFF"`. |
| `--bg-url <url>` | Remote image URL to composite onto. |

### `batch` — process up to 10 images in one call

```bash
useknockout batch a.jpg b.jpg c.jpg --out-dir ./cutouts --format png
useknockout batch --url https://ex.com/a.jpg https://ex.com/b.jpg --out-dir ./cutouts
```

Shell globs work: `useknockout batch *.jpg --out-dir ./out` (capped at 10 files). Pass `--url` to treat positionals as URLs instead of local files.

| Option | Description |
|---|---|
| `--out-dir <dir>` | Output directory. Created if missing. Default: current directory. |
| `--url` | Treat the arguments as remote URLs rather than local files. |
| `--format <fmt>` | `png` (default) or `webp`. |

Per-file results are named `<original>-nobg.<format>`. The command prints a per-file ✓/✗ list and a summary; **exit code is `1` if any file failed.**

### `mask` — return just the alpha mask as a B/W PNG

```bash
useknockout mask photo.jpg
# → photo-mask.png (grayscale: 0 = bg, 255 = subject)
```

### `smart-crop` — auto-crop to the subject's bounding box

```bash
useknockout smart-crop photo.jpg --padding 32
useknockout smart-crop photo.jpg --padding 0 --opaque --format jpg
```

| Option | Description |
|---|---|
| `--padding <px>` | Padding around the subject. Default `24`. |
| `--opaque` | Keep the original background (crop only). Default is a transparent cutout. |

### `shadow` — cutout + drop shadow on a new background

```bash
useknockout shadow photo.jpg --bg-color "#F3F4F6"
useknockout shadow photo.jpg --bg-url https://example.com/backdrop.jpg --shadow-blur 20
```

| Option | Description |
|---|---|
| `--bg-color <hex>`, `--bg-url <url>` | New background (color or remote image). |
| `--shadow-color <hex>` | Shadow color. |
| `--shadow-offset-x <px>`, `--shadow-offset-y <px>` | Shadow offset. |
| `--shadow-blur <px>` | Shadow blur radius. |
| `--shadow-opacity <0–1>` | Shadow opacity. |

### `sticker` — thick outline, transparent background (WhatsApp / iMessage style)

```bash
useknockout sticker photo.jpg --stroke-width 24
useknockout sticker photo.jpg --stroke-color "#000000" --stroke-width 12
```

| Option | Description |
|---|---|
| `--stroke-color <hex>` | Outline color. |
| `--stroke-width <px>` | Outline width. |

### `outline` — thin outline around the subject

```bash
useknockout outline photo.jpg --outline-color "#000000" --outline-width 4
```

| Option | Description |
|---|---|
| `--outline-color <hex>` | Line color. |
| `--outline-width <px>` | Line width. |

### `studio-shot` — e-commerce preset (cutout + bg + shadow + aspect crop)

```bash
useknockout studio-shot photo.jpg --aspect 1:1
useknockout studio-shot photo.jpg --aspect 1:1 --enhance
useknockout studio-shot photo.jpg --transparent          # transparent bg → PNG
```

Default format: `jpg`. If `--transparent` is set with `--format jpg`, output is coerced to PNG (JPG cannot carry alpha).

| Option | Description |
|---|---|
| `--aspect <W:H>` | Output aspect ratio, e.g. `1:1` or `4:5`. |
| `--bg-color <hex>` | Canvas color. |
| `--padding <px>` | Padding around the subject. |
| `--no-shadow` | Disable the default drop shadow. |
| `--transparent` | Keep a transparent background (ignores `--bg-color`/shadow; output is PNG). |
| `--enhance` | Apply a brightness/saturation lift for ecommerce-ready output. |
| `--enhance-strength <num>` | Strength of the enhancement. |

### `compare` — side-by-side before/after

```bash
useknockout compare photo.jpg
# → photo-compare.png (original | transparent cutout)
```

Useful for marketing screenshots and social media.

### `headshot` — LinkedIn-ready portrait (4:5, color or blurred bg)

```bash
useknockout headshot photo.jpg --bg-color "#f5f5f5"
useknockout headshot photo.jpg --bg-blur --blur-radius 24 --format jpg
```

Default format: `jpg`. Default suffix: `-headshot`.

| Option | Description |
|---|---|
| `--bg-color <hex>` | Studio backdrop color. |
| `--bg-blur` | Use a blurred version of the original as the background. |
| `--blur-radius <px>` | Blur radius when `--bg-blur` is set. |
| `--aspect <W:H>` | Output aspect ratio. |
| `--padding <px>` | Padding around the subject. |
| `--head-top-ratio <0–1>` | Where the top of the head sits in the frame. |

### `preview` — fast low-res cutout (~80ms warm, no refinement)

```bash
useknockout preview photo.jpg --max-dim 512
```

| Option | Description |
|---|---|
| `--max-dim <px>` | Max edge length of the preview. Default `512`. |

Intended for thumbnail UIs before triggering a full-res request.

### `upscale` — Swin2SR / Real-ESRGAN super-resolution

```bash
useknockout upscale small.jpg --scale 4
useknockout upscale small.jpg --scale 2 --model realesrgan
useknockout upscale portrait.jpg --face-enhance
```

| Option | Description |
|---|---|
| `--scale <n>` | `2` or `4`. Default `4`. |
| `--model <name>` | `swin2sr` (default, sharp on real photos) or `realesrgan` (better on anime / illustrations). |
| `--face-enhance` | Also run face enhancement. |

Uses an extended client timeout (180s) because super-resolution is slow.

### `face-restore` — GFPGAN portrait restoration

```bash
useknockout face-restore blurry-portrait.jpg
useknockout face-restore portrait.jpg --bg-enhance      # also upscale the background
useknockout face-restore group.jpg --only-center-face
```

| Option | Description |
|---|---|
| `--only-center-face` | Restore only the central face (skip others). |
| `--bg-enhance` | Also upscale the background 2x. |

Detects faces and restores blurred/compressed/damaged ones while preserving identity. Uses a 180s timeout.

### `colorize` — DDColor colorization

```bash
useknockout colorize old-bw-photo.jpg
```

Predicts color from a black-and-white or grayscale photo. Default suffix: `-color`. Uses a 120s timeout.

### `silhouette` — two-tone silhouette portrait

```bash
useknockout silhouette photo.jpg --subject-color "#000000" --bg-color "#FFFFFF"
```

Apple Music / Spotify avatar style.

| Option | Description |
|---|---|
| `--subject-color <hex>` | Fill color of the subject. |
| `--bg-color <hex>` | Background color. |

### `inpaint` — LaMa region erase

```bash
useknockout inpaint photo.jpg                              # auto-subject erase
useknockout inpaint photo.jpg --mask mask.png
useknockout inpaint photo.jpg --bbox "100,100,300,400"
```

Erases a region using the LaMa model. With no mask/bbox it erases the detected subject. Uses a 180s timeout.

| Option | Description |
|---|---|
| `--mask <file>` | Path to a mask image marking the region to erase. |
| `--bbox <x,y,w,h>` | Bounding box of the region to erase (integers). |
| `--dilation <px>` | Dilate the mask before erasing. |

### `estimate` — predict latency + cost (no upload)

```bash
useknockout estimate remove --width 2048 --height 1536
```

`--width` and `--height` (in pixels) are required. Prints JSON. No image is uploaded.

### `stats` — public usage stats

```bash
useknockout stats
```

Prints a JSON usage counter (total + today + 7-day). No auth required.

### `health` — check the API is reachable

```bash
useknockout health
# {"status":"ok","model":"ZhengPeng7/BiRefNet"}
```

Prints JSON.

---

## Global options

Available on every command:

| Option | Short | Description |
|---|---|---|
| `--token <token>` | | Bearer token. Overrides the `KNOCKOUT_TOKEN` env var. Defaults to the bundled public beta token. |
| `--base-url <url>` | | Override the API base URL (for self-hosted deployments). |
| `--quiet` | `-q` | Suppress non-error progress output. |
| `--help` | `-h` | Show help. |
| `--version` | `-v` | Show version. |

## Authentication

The CLI resolves the token in this order of precedence:

1. `--token <token>` flag
2. `KNOCKOUT_TOKEN` environment variable
3. The bundled public beta token (for the zero-setup, try-it-now experience)

For your own usage, export a token:

```bash
export KNOCKOUT_TOKEN="kno_your_token_here"
useknockout remove ./photo.jpg
```

On Windows PowerShell:

```powershell
$env:KNOCKOUT_TOKEN="kno_your_token_here"
useknockout remove .\photo.jpg
```

The API is served from `https://useknockout--api.modal.run` by default; point `--base-url` at your own deployment if you self-host.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | An operation failed (missing/invalid input, network error, API error, or any batch item failing) |

API errors surface as `error: API <status> (<code>): <body>`.

## Use in shell scripts

```bash
#!/usr/bin/env bash
set -e

for f in ./raw/*.jpg; do
  useknockout remove "$f" --out "./clean/$(basename "$f" .jpg).png" --quiet
done
```

```bash
# Batch at max speed (up to 10 files per call)
find ./raw -maxdepth 1 -name "*.jpg" | head -10 | xargs useknockout batch --out-dir ./clean
```

---

## Project structure

```
useknockout-cli/
├── src/
│   └── cli.ts          # Entire CLI: arg parsing, command dispatch, all 22 subcommands
├── dist/               # Build output (cli.cjs) — generated by tsup, git-ignored
├── package.json        # Package metadata, bin entries, scripts, deps
├── tsconfig.json       # Strict TypeScript config (ES2022, bundler resolution)
├── tsup.config.ts      # Bundler config → single CJS file with node shebang
├── .npmignore          # Excludes source/config from the published tarball
├── LICENSE             # MIT
└── README.md
```

The CLI is a single TypeScript file. It parses a leading subcommand, extracts global options, then delegates to a per-command handler that uses `node:util`'s `parseArgs` for command-specific flags and calls the matching `@useknockout/node` method.

## Development

```bash
npm install
npm run dev -- remove ./photo.jpg   # run from source via tsx
npm run typecheck                   # tsc --noEmit
npm run build                       # bundle to dist/cli.cjs with tsup
```

`prepublishOnly` runs the build automatically before publishing. Only `dist/`, `README.md`, and `LICENSE` are included in the published package.

## Notes

- The `@useknockout/node` client is bundled into the output (`noExternal`), so the published CLI has no runtime `node_modules` dependency to resolve.
- The default base URL and bundled public-beta token are hardcoded in `src/cli.ts`; both can be overridden per-invocation.
- The README in `git` history has historically drifted from the actual flags; this version reflects the flags implemented in `src/cli.ts` at version `0.5.0`.

## License

MIT — see [LICENSE](./LICENSE).
