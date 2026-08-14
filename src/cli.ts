/**
 * @useknockout/cli — command-line interface for the useknockout background removal API.
 *
 * Commands:
 *   useknockout remove <input> [options]
 *   useknockout replace <input> [options]
 *   useknockout batch <file...> [options]
 *   useknockout health
 *
 * Run `useknockout --help` for full usage.
 */
import { parseArgs } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { Knockout, KnockoutError } from "@useknockout/node";

const VERSION = "0.4.0";
const DEFAULT_TOKEN = "kno_public_beta_4d7e9f1a3c5b2e8d6a9f7c1b3e5d8a2f";

type Command =
  | "remove"
  | "remove-url"
  | "replace"
  | "batch"
  | "mask"
  | "smart-crop"
  | "shadow"
  | "sticker"
  | "outline"
  | "studio-shot"
  | "collage"
  | "video"
  | "compare"
  | "headshot"
  | "preview"
  | "upscale"
  | "face-restore"
  | "colorize"
  | "silhouette"
  | "inpaint"
  | "estimate"
  | "stats"
  | "health"
  | "help"
  | "version";

interface GlobalOpts {
  token: string;
  baseUrl: string | undefined;
  quiet: boolean;
}

function printHelp(): void {
  const help = `
useknockout — CLI for the useknockout background removal API.

USAGE
  useknockout <command> [options]

COMMANDS
  remove <input>          Remove background from one image → transparent PNG/WebP
  remove-url <url>        Remove background from a remote image URL
  replace <input>         Remove background + composite onto a new background
  batch <file1> <file2>…  Process up to 10 images in one call (--url to pass URLs)
  mask <input>            Return just the alpha mask as a B/W PNG
  smart-crop <input>      Auto-crop to the subject with padding
  shadow <input>          Cutout + drop shadow on a new background
  sticker <input>         Thick outline on transparent bg (WhatsApp / iMessage stickers)
  outline <input>         Thin outline around the subject
  studio-shot <input>     E-commerce preset: cutout + bg + shadow + aspect crop
  collage <f1> <f2>…      2-9 photos laid out around a main image (paid; billed N units)
  video <input>           Video background removal — ProRes 4444 alpha / webm / mp4 (paid; $0.05/s)
  compare <input>         Side-by-side before/after preview
  headshot <input>        LinkedIn-ready portrait (4:5, color or blurred bg)
  preview <input>         Fast low-res cutout (~80ms warm, no refinement)
  upscale <input>         Swin2SR / Real-ESRGAN x2/x4 super-resolution
  face-restore <input>    GFPGAN portrait restoration
  colorize <input>        DDColor — predict color from a B&W or grayscale photo
  silhouette <input>      Two-tone silhouette portrait (Apple Music / Spotify avatar style)
  inpaint <input>         LaMa — erase a region. Auto-subject by default, or pass --mask / --bbox
  estimate <endpoint>     Predict latency + cost (--width, --height required)
  stats                   Public usage counter (total + today + 7-day)
  health                  Check the API is reachable
  --help, -h              Show this help
  --version, -v           Show version

GLOBAL OPTIONS
  --token <token>         API bearer token (env: KNOCKOUT_TOKEN). Default: public beta token
  --base-url <url>        Override API base URL
  --quiet, -q             Suppress non-error output

REMOVE
  useknockout remove cat.jpg
  useknockout remove cat.jpg --out cutout.png --format png
  useknockout remove product.jpg --detect high_recall --decontaminate --edge hard

REPLACE
  useknockout replace cat.jpg --bg-color "#FF5733" --out out.jpg --format jpg
  useknockout replace cat.jpg --bg-url https://example.com/beach.jpg --out out.png

BATCH (up to 10 files or URLs)
  useknockout batch a.jpg b.jpg c.jpg --out-dir ./cutouts --format png
  useknockout batch --url https://ex.com/a.jpg https://ex.com/b.jpg --out-dir ./cutouts
  useknockout remove-url https://example.com/cat.jpg --out cat.png

FACE-RESTORE
  useknockout face-restore portrait.jpg --bg-enhance   # also upscale the background 2x

EXAMPLES
  # Try it in 10 seconds (no install required):
  npx @useknockout/cli remove ./photo.jpg

  # Replace with a solid color, output as compact JPG:
  npx @useknockout/cli replace ./photo.jpg --bg-color "#007BFF" --format jpg

  # Make a WhatsApp-style sticker:
  npx @useknockout/cli sticker ./photo.jpg --stroke-width 24

  # E-commerce product shot (square, white bg, shadow):
  npx @useknockout/cli studio-shot ./photo.jpg --aspect 1:1

  # Same, with a brightness + saturation lift for ecommerce-ready output:
  npx @useknockout/cli studio-shot ./photo.jpg --aspect 1:1 --enhance

  # Before/after preview for social media:
  npx @useknockout/cli compare ./photo.jpg

LINKS
  Docs:  https://github.com/useknockout/api
  npm:   https://www.npmjs.com/package/@useknockout/cli
  API:   https://useknockout--api.modal.run
`;
  process.stdout.write(help + "\n");
}

function fail(message: string, code = 1): never {
  process.stderr.write(`\x1b[31merror:\x1b[0m ${message}\n`);
  process.exit(code);
}

function log(quiet: boolean, message: string): void {
  if (!quiet) process.stdout.write(message + "\n");
}

function bytesHuman(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function defaultOutPath(input: string, format: string, suffix = "-nobg"): string {
  const dir = dirname(input);
  const base = basename(input, extname(input));
  return join(dir, `${base}${suffix}.${format}`);
}

async function runRemove(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      edge: { type: "string" },
      detect: { type: "string" },
      decontaminate: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const input = positionals[0];
  if (!input) fail("remove: missing <input> file. Usage: useknockout remove <input>");

  const format = (values.format as "png" | "webp") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format);

  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ removing background from ${input} (format=${format})`);

  const start = Date.now();
  const buf = await client.remove({
    file: input,
    format,
    edge: values.edge as "soft" | "hard" | undefined,
    detect: values.detect as "standard" | "high_recall" | undefined,
    decontaminate: (values.decontaminate as boolean) || undefined,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${elapsed}s)`);
}

async function runRemoveUrl(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      edge: { type: "string" },
      detect: { type: "string" },
      decontaminate: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const url = positionals[0];
  if (!url) fail("remove-url: missing <url>. Usage: useknockout remove-url <url>");

  const format = (values.format as "png" | "webp") ?? "png";
  let stem = "remote-image";
  try {
    stem = basename(new URL(url).pathname) || stem;
  } catch {
    fail(`remove-url: invalid URL: ${url}`);
  }
  const outPath = (values.out as string | undefined) ?? defaultOutPath(stem, format);

  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ removing background from ${url} (format=${format})`);

  const start = Date.now();
  const buf = await client.removeUrl({
    url,
    format,
    edge: values.edge as "soft" | "hard" | undefined,
    detect: values.detect as "standard" | "high_recall" | undefined,
    decontaminate: (values.decontaminate as boolean) || undefined,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${elapsed}s)`);
}

async function runReplace(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "bg-color": { type: "string" },
      "bg-url": { type: "string" },
    },
    allowPositionals: true,
  });

  const input = positionals[0];
  if (!input) fail("replace: missing <input> file. Usage: useknockout replace <input>");

  const bgColor = values["bg-color"] as string | undefined;
  const bgUrl = values["bg-url"] as string | undefined;
  if (!bgColor && !bgUrl) {
    fail("replace: provide --bg-color <hex> or --bg-url <url>");
  }

  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-bg");

  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(
    globals.quiet,
    `→ replacing background of ${input} with ${bgColor ? `color ${bgColor}` : `image ${bgUrl}`} (format=${format})`
  );

  const start = Date.now();
  const buf = await client.replaceBackground({
    file: input,
    bgColor,
    bgUrl,
    format,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${elapsed}s)`);
}

async function runBatch(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      "out-dir": { type: "string" },
      format: { type: "string", short: "f", default: "png" },
      url: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const items = positionals.filter(Boolean);
  const isUrl = Boolean(values.url);
  const noun = isUrl ? "URLs" : "files";
  if (items.length === 0) {
    fail(`batch: missing ${noun}. Usage: useknockout batch a.jpg b.jpg …  (or --url u1 u2 …)`);
  }
  if (items.length > 10) fail(`batch: max 10 ${noun} per call (got ${items.length})`);

  const format = (values.format as "png" | "webp") ?? "png";
  const outDir = resolve((values["out-dir"] as string | undefined) ?? process.cwd());
  await mkdir(outDir, { recursive: true });

  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ processing ${items.length} ${isUrl ? "URL" : "file"}(s) → ${outDir}`);

  const start = Date.now();
  const result = isUrl
    ? await client.removeBatchUrl({ urls: items, format })
    : await client.removeBatch({ files: items, filenames: items.map((f) => basename(f)), format });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  let ok = 0;
  let i = 0;
  for (const r of result.results) {
    i++;
    if (r.success && r.data_base64) {
      const fromUrl = r.url ? basename(new URL(r.url).pathname) : "";
      const label = r.filename ?? (fromUrl || `image-${i}`);
      const outName = basename(label, extname(label)) + `-nobg.${format}`;
      const outPath = join(outDir, outName);
      await writeFile(outPath, Buffer.from(r.data_base64, "base64"));
      ok++;
      log(globals.quiet, `  ✓ ${outPath} (${bytesHuman(r.size_bytes ?? 0)})`);
    } else {
      log(globals.quiet, `  ✗ ${r.filename ?? r.url ?? `image-${i}`}: ${r.error ?? "failed"}`);
    }
  }
  log(globals.quiet, `\n${ok}/${result.count} succeeded in ${elapsed}s`);
  if (ok < result.count) process.exit(1);
}

async function runHealth(globals: GlobalOpts): Promise<void> {
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  const info = await client.health();
  process.stdout.write(JSON.stringify(info, null, 2) + "\n");
}

async function runMask(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("mask: missing <input>. Usage: useknockout mask <input>");
  const format = (values.format as "png" | "webp") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-mask");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ generating mask for ${input}`);
  const start = Date.now();
  const buf = await client.mask({ file: input, format });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runSmartCrop(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      padding: { type: "string", default: "24" },
      opaque: { type: "boolean", default: false },
      detect: { type: "string" },
      decontaminate: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("smart-crop: missing <input>");
  const transparent = !values.opaque;
  const format = (values.format as "png" | "webp" | "jpg") ?? (transparent ? "png" : "jpg");
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-crop");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ smart-cropping ${input} (padding=${values.padding}, transparent=${transparent})`);
  const start = Date.now();
  const buf = await client.smartCrop({
    file: input,
    padding: parseInt(String(values.padding), 10),
    transparent,
    detect: values.detect as "standard" | "high_recall" | undefined,
    decontaminate: (values.decontaminate as boolean) || undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runShadow(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "bg-color": { type: "string" },
      "bg-url": { type: "string" },
      "shadow-color": { type: "string" },
      "shadow-offset-x": { type: "string" },
      "shadow-offset-y": { type: "string" },
      "shadow-blur": { type: "string" },
      "shadow-opacity": { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("shadow: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-shadow");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ shadow ${input}`);
  const start = Date.now();
  const buf = await client.shadow({
    file: input,
    bgColor: values["bg-color"] as string | undefined,
    bgUrl: values["bg-url"] as string | undefined,
    shadowColor: values["shadow-color"] as string | undefined,
    shadowOffsetX: values["shadow-offset-x"] ? parseInt(String(values["shadow-offset-x"]), 10) : undefined,
    shadowOffsetY: values["shadow-offset-y"] ? parseInt(String(values["shadow-offset-y"]), 10) : undefined,
    shadowBlur: values["shadow-blur"] ? parseInt(String(values["shadow-blur"]), 10) : undefined,
    shadowOpacity: values["shadow-opacity"] ? parseFloat(String(values["shadow-opacity"])) : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runSticker(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "stroke-color": { type: "string" },
      "stroke-width": { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("sticker: missing <input>");
  const format = (values.format as "png" | "webp") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-sticker");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ sticker ${input}`);
  const start = Date.now();
  const buf = await client.sticker({
    file: input,
    strokeColor: values["stroke-color"] as string | undefined,
    strokeWidth: values["stroke-width"] ? parseInt(String(values["stroke-width"]), 10) : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runOutline(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "outline-color": { type: "string" },
      "outline-width": { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("outline: missing <input>");
  const format = (values.format as "png" | "webp") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-outline");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ outline ${input}`);
  const start = Date.now();
  const buf = await client.outline({
    file: input,
    outlineColor: values["outline-color"] as string | undefined,
    outlineWidth: values["outline-width"] ? parseInt(String(values["outline-width"]), 10) : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runStudioShot(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "jpg" },
      "bg-color": { type: "string" },
      aspect: { type: "string" },
      padding: { type: "string" },
      "no-shadow": { type: "boolean", default: false },
      transparent: { type: "boolean", default: false },
      enhance: { type: "boolean", default: false },
      "enhance-strength": { type: "string" },
      detect: { type: "string" },
      decontaminate: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("studio-shot: missing <input>");
  const transparent = Boolean(values.transparent);
  const requested = (values.format as "png" | "webp" | "jpg") ?? "jpg";
  // jpg can't carry alpha — the API coerces to png; mirror that for the output filename
  const format = transparent && requested === "jpg" ? "png" : requested;
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-studio");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ studio-shot ${input}`);
  const start = Date.now();
  const buf = await client.studioShot({
    file: input,
    bgColor: values["bg-color"] as string | undefined,
    aspect: values.aspect as string | undefined,
    padding: values.padding ? parseInt(String(values.padding), 10) : undefined,
    shadow: !values["no-shadow"],
    transparent,
    detect: values.detect as "standard" | "high_recall" | undefined,
    decontaminate: (values.decontaminate as boolean) || undefined,
    enhance: values.enhance ? true : undefined,
    enhanceStrength: values["enhance-strength"]
      ? parseFloat(String(values["enhance-strength"]))
      : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runCollage(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "jpg" },
      "main-index": { type: "string" },
      "main-position": { type: "string", default: "BR" },
      "bg-color": { type: "string" },
      aspect: { type: "string" },
      padding: { type: "string" },
    },
    allowPositionals: true,
  });
  const items = positionals.filter(Boolean);
  if (items.length < 2 || items.length > 9) {
    fail(`collage: needs 2-9 images (got ${items.length}). Usage: useknockout collage main.jpg a.jpg b.jpg`);
  }
  const format = (values.format as "png" | "webp" | "jpg") ?? "jpg";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(items[0]!, format, "-collage");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ collage ${items.length} images (main=${values["main-index"] ?? 0} @ ${values["main-position"]})`);
  const start = Date.now();
  const buf = await client.collage({
    files: items,
    filenames: items.map((f) => basename(f)),
    mainIndex: values["main-index"] ? parseInt(String(values["main-index"]), 10) : undefined,
    mainPosition: values["main-position"] as
      | "TL" | "T" | "TR" | "L" | "C" | "R" | "BL" | "B" | "BR"
      | undefined,
    bgColor: values["bg-color"] as string | undefined,
    aspect: values.aspect as string | undefined,
    padding: values.padding ? parseInt(String(values.padding), 10) : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runVideo(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "prores4444" },
      "bg-color": { type: "string" },
      smoothing: { type: "string" },
      "poll-interval": { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("video: missing <input>. Usage: useknockout video clip.mp4 [-f prores4444|webm|mp4]");
  const format = (values.format as "prores4444" | "webm" | "mp4") ?? "prores4444";
  const ext = format === "prores4444" ? "mov" : format === "webm" ? "webm" : "mp4";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, ext, "-nobg");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ video ${input} (${format}) — submitting…`);
  const start = Date.now();
  const job = await client.videoRemoveAndWait(
    {
      file: input!,
      format,
      bgColor: values["bg-color"] as string | undefined,
      smoothing: values.smoothing ? parseInt(String(values.smoothing), 10) : undefined,
    },
    {
      pollIntervalMs: values["poll-interval"] ? parseInt(String(values["poll-interval"]), 10) * 1000 : undefined,
      onProgress: (j) => log(globals.quiet, `  … ${j.status} ${j.progress}%`),
    }
  );
  if (!job.result_url) fail(`video: job ${job.job_id} finished without a result URL`);
  const res = await fetch(job.result_url!);
  if (!res.ok) fail(`video: could not download result (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(1)}s)`);
}

async function runCompare(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("compare: missing <input>");
  const format = (values.format as "png" | "webp") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-compare");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ compare ${input}`);
  const start = Date.now();
  const buf = await client.compare({ file: input, format });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
}

async function runHeadshot(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "jpg" },
      "bg-color": { type: "string" },
      "bg-blur": { type: "boolean", default: false },
      "blur-radius": { type: "string" },
      aspect: { type: "string" },
      padding: { type: "string" },
      "head-top-ratio": { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("headshot: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "jpg";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-headshot");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ headshot ${input}`);
  const start = Date.now();
  const buf = await client.headshot({
    file: input,
    bgColor: values["bg-color"] as string | undefined,
    bgBlur: values["bg-blur"] as boolean | undefined,
    blurRadius: values["blur-radius"] ? parseInt(String(values["blur-radius"]), 10) : undefined,
    aspect: values.aspect as string | undefined,
    padding: values.padding ? parseInt(String(values.padding), 10) : undefined,
    headTopRatio: values["head-top-ratio"]
      ? parseFloat(String(values["head-top-ratio"]))
      : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

async function runPreview(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "max-dim": { type: "string", default: "512" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("preview: missing <input>");
  const format = (values.format as "png" | "webp") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-preview");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ preview ${input} (max_dim=${values["max-dim"]})`);
  const start = Date.now();
  const buf = await client.preview({
    file: input,
    maxDim: parseInt(String(values["max-dim"]), 10),
    format,
  });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

async function runEstimate(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      width: { type: "string" },
      height: { type: "string" },
    },
    allowPositionals: true,
  });
  const endpoint = positionals[0];
  if (!endpoint) {
    fail("estimate: missing <endpoint>. Usage: useknockout estimate remove --width 1024 --height 1024");
  }
  const w = values.width ? parseInt(String(values.width), 10) : NaN;
  const h = values.height ? parseInt(String(values.height), 10) : NaN;
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    fail("estimate: --width and --height are required (in pixels)");
  }
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  const result = await client.estimate({ endpoint, width: w, height: h });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

async function runStats(globals: GlobalOpts): Promise<void> {
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  const result = await client.stats();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

async function runUpscale(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      scale: { type: "string", default: "4" },
      model: { type: "string", default: "swin2sr" },
      "face-enhance": { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("upscale: missing <input>");
  const scale = parseInt(String(values.scale), 10);
  if (scale !== 2 && scale !== 4) fail("upscale: --scale must be 2 or 4");
  const model = String(values.model);
  if (model !== "swin2sr" && model !== "realesrgan") {
    fail("upscale: --model must be 'swin2sr' or 'realesrgan'");
  }
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath =
    (values.out as string | undefined) ?? defaultOutPath(input, format, `-${scale}x`);
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl, timeoutMs: 180_000 });
  log(globals.quiet, `→ upscaling ${input} (model=${model}, scale=${scale}x, face_enhance=${values["face-enhance"]})`);
  const start = Date.now();
  const buf = await client.upscale({
    file: input,
    scale: scale as 2 | 4,
    model: model as "swin2sr" | "realesrgan",
    faceEnhance: values["face-enhance"] as boolean | undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

async function runInpaint(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      mask: { type: "string" },
      bbox: { type: "string" }, // "x,y,w,h"
      dilation: { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("inpaint: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-inpaint");

  let bbox: { x: number; y: number; w: number; h: number } | undefined;
  if (values.bbox) {
    const parts = String(values.bbox).split(",").map((s) => parseInt(s.trim(), 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      fail("inpaint: --bbox must be 'x,y,w,h' integers (e.g. '100,100,300,400')");
    }
    bbox = { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
  }

  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl, timeoutMs: 180_000 });
  const mode = values.mask ? "mask" : bbox ? "bbox" : "auto-subject";
  log(globals.quiet, `→ inpaint ${input} (mode=${mode})`);
  const start = Date.now();
  const buf = await client.inpaint({
    file: input,
    mask: values.mask ? String(values.mask) : undefined,
    bbox,
    dilation: values.dilation ? parseInt(String(values.dilation), 10) : undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

async function runSilhouette(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "subject-color": { type: "string" },
      "bg-color": { type: "string" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("silhouette: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-silhouette");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ silhouette ${input}`);
  const start = Date.now();
  const buf = await client.silhouette({
    file: input,
    subjectColor: values["subject-color"] as string | undefined,
    bgColor: values["bg-color"] as string | undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

async function runColorize(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("colorize: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-color");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl, timeoutMs: 120_000 });
  log(globals.quiet, `→ colorize ${input}`);
  const start = Date.now();
  const buf = await client.colorize({ file: input, format });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

async function runFaceRestore(args: string[], globals: GlobalOpts): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "png" },
      "only-center-face": { type: "boolean", default: false },
      "bg-enhance": { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("face-restore: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath = (values.out as string | undefined) ?? defaultOutPath(input, format, "-restored");
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl, timeoutMs: 180_000 });
  log(globals.quiet, `→ face-restore ${input}`);
  const start = Date.now();
  const buf = await client.faceRestore({
    file: input,
    onlyCenterFace: values["only-center-face"] as boolean | undefined,
    bgEnhance: values["bg-enhance"] as boolean | undefined,
    format,
  });
  await writeFile(outPath, buf);
  log(
    globals.quiet,
    `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`
  );
}

function parseGlobals(args: string[]): { globals: GlobalOpts; remaining: string[] } {
  const remaining: string[] = [];
  let token: string | undefined;
  let baseUrl: string | undefined;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--token") {
      token = args[++i];
    } else if (a === "--base-url") {
      baseUrl = args[++i];
    } else if (a === "--quiet" || a === "-q") {
      quiet = true;
    } else {
      remaining.push(a as string);
    }
  }

  const finalToken = token ?? process.env.KNOCKOUT_TOKEN ?? DEFAULT_TOKEN;
  return { globals: { token: finalToken, baseUrl, quiet }, remaining };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    printHelp();
    return;
  }
  if (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "version") {
    process.stdout.write(`@useknockout/cli ${VERSION}\n`);
    return;
  }

  const command = argv[0] as Command;
  const { globals, remaining } = parseGlobals(argv.slice(1));

  try {
    switch (command) {
      case "remove":
        await runRemove(remaining, globals);
        break;
      case "remove-url":
        await runRemoveUrl(remaining, globals);
        break;
      case "replace":
        await runReplace(remaining, globals);
        break;
      case "batch":
        await runBatch(remaining, globals);
        break;
      case "mask":
        await runMask(remaining, globals);
        break;
      case "smart-crop":
        await runSmartCrop(remaining, globals);
        break;
      case "shadow":
        await runShadow(remaining, globals);
        break;
      case "sticker":
        await runSticker(remaining, globals);
        break;
      case "outline":
        await runOutline(remaining, globals);
        break;
      case "studio-shot":
        await runStudioShot(remaining, globals);
        break;
      case "collage":
        await runCollage(remaining, globals);
        break;
      case "video":
        await runVideo(remaining, globals);
        break;
      case "compare":
        await runCompare(remaining, globals);
        break;
      case "headshot":
        await runHeadshot(remaining, globals);
        break;
      case "preview":
        await runPreview(remaining, globals);
        break;
      case "upscale":
        await runUpscale(remaining, globals);
        break;
      case "face-restore":
        await runFaceRestore(remaining, globals);
        break;
      case "colorize":
        await runColorize(remaining, globals);
        break;
      case "silhouette":
        await runSilhouette(remaining, globals);
        break;
      case "inpaint":
        await runInpaint(remaining, globals);
        break;
      case "estimate":
        await runEstimate(remaining, globals);
        break;
      case "stats":
        await runStats(globals);
        break;
      case "health":
        await runHealth(globals);
        break;
      default:
        fail(`unknown command: ${command}. Run 'useknockout --help' for usage.`);
    }
  } catch (e) {
    if (e instanceof KnockoutError) {
      fail(`API ${e.status} (${e.code}): ${e.body || e.message}`);
    }
    if (e instanceof Error) fail(e.message);
    fail(String(e));
  }
}

void main();
