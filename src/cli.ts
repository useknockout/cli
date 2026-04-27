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

const VERSION = "0.0.6";
const DEFAULT_TOKEN = "kno_public_beta_4d7e9f1a3c5b2e8d6a9f7c1b3e5d8a2f";

type Command =
  | "remove"
  | "replace"
  | "batch"
  | "mask"
  | "smart-crop"
  | "shadow"
  | "sticker"
  | "outline"
  | "studio-shot"
  | "compare"
  | "headshot"
  | "preview"
  | "upscale"
  | "face-restore"
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
  replace <input>         Remove background + composite onto a new background
  batch <file1> <file2>…  Process up to 10 images in one call
  mask <input>            Return just the alpha mask as a B/W PNG
  smart-crop <input>      Auto-crop to the subject with padding
  shadow <input>          Cutout + drop shadow on a new background
  sticker <input>         Thick outline on transparent bg (WhatsApp / iMessage stickers)
  outline <input>         Thin outline around the subject
  studio-shot <input>     E-commerce preset: cutout + bg + shadow + aspect crop
  compare <input>         Side-by-side before/after preview
  headshot <input>        LinkedIn-ready portrait (4:5, color or blurred bg)
  preview <input>         Fast low-res cutout (~80ms warm, no refinement)
  upscale <input>         Real-ESRGAN x2/x4 super-resolution
  face-restore <input>    GFPGAN portrait restoration
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

REPLACE
  useknockout replace cat.jpg --bg-color "#FF5733" --out out.jpg --format jpg
  useknockout replace cat.jpg --bg-url https://example.com/beach.jpg --out out.png

BATCH (up to 10 files)
  useknockout batch a.jpg b.jpg c.jpg --out-dir ./cutouts --format png

EXAMPLES
  # Try it in 10 seconds (no install required):
  npx @useknockout/cli remove ./photo.jpg

  # Replace with a solid color, output as compact JPG:
  npx @useknockout/cli replace ./photo.jpg --bg-color "#007BFF" --format jpg

  # Make a WhatsApp-style sticker:
  npx @useknockout/cli sticker ./photo.jpg --stroke-width 24

  # E-commerce product shot (square, white bg, shadow):
  npx @useknockout/cli studio-shot ./photo.jpg --aspect 1:1

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
  const buf = await client.remove({ file: input, format });
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
    },
    allowPositionals: true,
  });

  const files = positionals.filter(Boolean);
  if (files.length === 0) fail("batch: missing files. Usage: useknockout batch a.jpg b.jpg …");
  if (files.length > 10) fail(`batch: max 10 files per call (got ${files.length})`);

  const format = (values.format as "png" | "webp") ?? "png";
  const outDir = resolve((values["out-dir"] as string | undefined) ?? process.cwd());
  await mkdir(outDir, { recursive: true });

  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl });
  log(globals.quiet, `→ processing ${files.length} file(s) → ${outDir}`);

  const start = Date.now();
  const result = await client.removeBatch({ files, filenames: files.map((f) => basename(f)), format });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  let ok = 0;
  for (const r of result.results) {
    if (r.success && r.data_base64 && r.filename) {
      const outName = basename(r.filename, extname(r.filename)) + `-nobg.${format}`;
      const outPath = join(outDir, outName);
      await writeFile(outPath, Buffer.from(r.data_base64, "base64"));
      ok++;
      log(globals.quiet, `  ✓ ${outPath} (${bytesHuman(r.size_bytes ?? 0)})`);
    } else {
      log(globals.quiet, `  ✗ ${r.filename ?? "?"}: ${r.error ?? "failed"}`);
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
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("studio-shot: missing <input>");
  const format = (values.format as "png" | "webp" | "jpg") ?? "jpg";
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
    format,
  });
  await writeFile(outPath, buf);
  log(globals.quiet, `✓ ${outPath} (${bytesHuman(buf.length)}, ${((Date.now() - start) / 1000).toFixed(2)}s)`);
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
      "face-enhance": { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail("upscale: missing <input>");
  const scale = parseInt(String(values.scale), 10);
  if (scale !== 2 && scale !== 4) fail("upscale: --scale must be 2 or 4");
  const format = (values.format as "png" | "webp" | "jpg") ?? "png";
  const outPath =
    (values.out as string | undefined) ?? defaultOutPath(input, format, `-${scale}x`);
  const client = new Knockout({ token: globals.token, baseUrl: globals.baseUrl, timeoutMs: 180_000 });
  log(globals.quiet, `→ upscaling ${input} (scale=${scale}x, face_enhance=${values["face-enhance"]})`);
  const start = Date.now();
  const buf = await client.upscale({
    file: input,
    scale: scale as 2 | 4,
    faceEnhance: values["face-enhance"] as boolean | undefined,
    format,
  });
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
