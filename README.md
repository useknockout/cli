<div align="center">

  # 🥊 @useknockout/cli

  **Zero-install CLI for [useknockout](https://github.com/useknockout/api) — state-of-the-art background removal, right from your terminal.**

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

- **Zero-setup** — `npx @useknockout/cli remove cat.jpg`
- **Full feature coverage** — remove, replace, batch, mask, smart-crop, shadow, sticker, outline, studio-shot, compare, headshot, preview, estimate, stats, upscale, face-restore
- **Pipe-friendly** — exit codes, `--quiet`, JSON for health
- **MIT licensed**

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

Now `useknockout` (or `knockout`) is on your PATH.

## Commands

### `remove` — remove background → transparent PNG/WebP

```bash
useknockout remove cat.jpg
useknockout remove cat.jpg --out cutout.png
useknockout remove cat.jpg --format webp --out cutout.webp
```

| Option | Short | Description |
|---|---|---|
| `--out <file>` | `-o` | Output path. Default: `<input>-nobg.<format>` |
| `--format <fmt>` | `-f` | `png` (default) or `webp`. Both include alpha. |

### `replace` — swap background for a color or image

```bash
# solid color
useknockout replace cat.jpg --bg-color "#FF5733" --format jpg

# remote image as the new background
useknockout replace cat.jpg --bg-url https://example.com/beach.jpg --out out.png
```

| Option | Short | Description |
|---|---|---|
| `--bg-color <hex>` | | Hex color. Example: `"#007BFF"`. |
| `--bg-url <url>` | | Remote image URL (takes precedence over `--bg-color`). |
| `--out <file>` | `-o` | Output path. Default: `<input>-bg.<format>` |
| `--format <fmt>` | `-f` | `png` (default), `webp`, or `jpg`. |

### `batch` — process up to 10 images in one call

```bash
useknockout batch a.jpg b.jpg c.jpg --out-dir ./cutouts --format png
```

Shell globs work: `useknockout batch *.jpg --out-dir ./out` (up to 10 files).

| Option | Short | Description |
|---|---|---|
| `--out-dir <dir>` | | Output directory. Created if missing. Default: cwd. |
| `--format <fmt>` | `-f` | `png` (default) or `webp`. |

Per-file results named `<original>-nobg.<format>`. Exit code `1` if any file failed.

### `mask` — return just the alpha mask as a B/W PNG

```bash
useknockout mask photo.jpg
# → photo-mask.png (grayscale: 0 = bg, 255 = subject)
```

### `smart-crop` — auto-crop to subject's bounding box

```bash
useknockout smart-crop photo.jpg --padding 32
useknockout smart-crop photo.jpg --padding 0 --opaque --format jpg
```

| Option | Description |
|---|---|
| `--padding <px>` | Padding around the subject. Default `24`. |
| `--opaque` | Keep the original background (crop only). Default is transparent cutout. |
| `--out`, `--format` | Same as other commands. |

### `shadow` — drop shadow on a new background

```bash
useknockout shadow photo.jpg --bg-color "#F3F4F6"
useknockout shadow photo.jpg --bg-url https://example.com/backdrop.jpg --shadow-blur 20
```

| Option | Description |
|---|---|
| `--bg-color <hex>`, `--bg-url <url>` | New background (color or remote image). |
| `--shadow-color`, `--shadow-offset-x`, `--shadow-offset-y`, `--shadow-blur`, `--shadow-opacity` | Configure the shadow. |

### `sticker` — WhatsApp / iMessage sticker style

```bash
useknockout sticker photo.jpg --stroke-width 24
useknockout sticker photo.jpg --stroke-color "#000000" --stroke-width 12
```

| Option | Description |
|---|---|
| `--stroke-color <hex>` | Outline color. Default `#FFFFFF`. |
| `--stroke-width <px>` | Outline width. Default `20`. |

### `outline` — thin outline on transparent background

```bash
useknockout outline photo.jpg --outline-color "#000000" --outline-width 4
```

| Option | Description |
|---|---|
| `--outline-color <hex>` | Line color. Default `#000000`. |
| `--outline-width <px>` | Line width. Default `4`. |

### `studio-shot` — e-commerce preset (cutout + bg + shadow + aspect)

```bash
useknockout studio-shot photo.jpg --aspect 1:1
useknockout studio-shot photo.jpg --aspect 4:5 --bg-color "#ffffff" --no-shadow --format jpg
```

| Option | Description |
|---|---|
| `--aspect <W:H>` | Output aspect ratio. Default `1:1`. |
| `--bg-color <hex>` | Canvas color. Default `#FFFFFF`. |
| `--padding <px>` | Padding around subject. Default `48`. |
| `--no-shadow` | Disable the default drop shadow. |

### `compare` — side-by-side before/after

```bash
useknockout compare photo.jpg
# → photo-compare.png (original | transparent cutout on checkerboard)
```

Useful for marketing screenshots and social media.

### `headshot` — studio-quality professional headshot (v0.4.0)

```bash
useknockout headshot photo.jpg --bg-color "#f5f5f5" --crop bust
useknockout headshot photo.jpg --crop head --no-shadow --format jpg
```

| Option | Description |
|---|---|
| `--bg-color <hex>` | Studio backdrop. Default `#f5f5f5`. |
| `--crop <mode>` | `bust`, `head`, or `full`. Default `bust`. |
| `--no-shadow` | Disable soft drop shadow. |

### `preview` — fast low-res preview (v0.4.0)

```bash
useknockout preview photo.jpg --max-size 512
useknockout preview photo.jpg --watermark
```

| Option | Description |
|---|---|
| `--max-size <px>` | Max edge length. Default `512`. |
| `--watermark` | Add `useknockout` watermark. |

Returns ~1.5s for thumbnail UIs before triggering full-res requests.

### `estimate` — estimate processing time + size (v0.4.0)

```bash
useknockout estimate --width 2048 --height 1536 --endpoint remove
# {"estimated_seconds": 2.4, "estimated_output_kb": 1180, "warm": true}
```

No image upload — pure JSON metadata call.

### `stats` — public API usage stats (v0.4.0)

```bash
useknockout stats
# {"total": 12340, "last_24h": 312, "last_7d": [...]}
```

No auth required.

### `upscale` — Swin2SR / Real-ESRGAN super-resolution (v0.6.0)

```bash
useknockout upscale small.jpg --scale 4
useknockout upscale small.jpg --scale 2 --model realesrgan
```

| Option | Description |
|---|---|
| `--scale <n>` | `2` or `4`. Default `4`. |
| `--model <name>` | `swin2sr` (default, sharp on real photos) or `realesrgan` (legacy, better on anime / illustrations). |
| `--out`, `--format` | Same as other commands. |

**v0.6.0** — default switched to **Swin2SR** (SwinV2 Transformer): sharper detail and natural texture on real photos. Pass `--model realesrgan` for the legacy backend.

### `face-restore` — GFPGAN face restoration (v0.5.0)

```bash
useknockout face-restore blurry-portrait.jpg
useknockout face-restore old-photo.jpg --out restored.png
```

Detects faces, restores blurred/compressed/damaged ones while preserving identity. Background also upscaled. Multi-face safe.

### `health` — check the API

```bash
useknockout health
# {"status":"ok","model":"ZhengPeng7/BiRefNet"}
```

---

## Global options

Available on every command:

| Option | Short | Description |
|---|---|---|
| `--token <token>` | | Bearer token. Overrides `KNOCKOUT_TOKEN` env var. Defaults to the public beta token. |
| `--base-url <url>` | | Override API base URL (self-hosted deployments). |
| `--quiet` | `-q` | Suppress non-error output. |
| `--help` | `-h` | Show help. |
| `--version` | `-v` | Show version. |

## Authentication

The CLI uses, in order of precedence:

1. `--token <token>` flag
2. `KNOCKOUT_TOKEN` environment variable
3. The public beta token (for zero-setup try-it-now experience)

For production use, export your own token:

```bash
export KNOCKOUT_TOKEN="kno_your_token_here"
useknockout remove ./photo.jpg
```

Or on Windows PowerShell:

```powershell
$env:KNOCKOUT_TOKEN="kno_your_token_here"
useknockout remove .\photo.jpg
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | At least one operation failed (bad input, network error, API error) |

## Use in shell scripts

```bash
#!/usr/bin/env bash
set -e

for f in ./raw/*.jpg; do
  useknockout remove "$f" --out "./clean/$(basename "$f" .jpg).png" --quiet
done
```

```bash
# Batch at max speed
find ./raw -maxdepth 1 -name "*.jpg" | head -10 | xargs useknockout batch --out-dir ./clean
```

## License

MIT — see [LICENSE](./LICENSE).
