# @useknockout/cli

> CLI for [useknockout](https://github.com/useknockout/api) — remove backgrounds, replace backgrounds, batch process.
> **No install required** — run directly with `npx`.

- **Zero-setup** — `npx @useknockout/cli remove cat.jpg`
- **Full feature coverage** — remove, replace, batch, health
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
