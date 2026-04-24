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

const VERSION = "0.0.1";
const DEFAULT_TOKEN = "kno_public_beta_4d7e9f1a3c5b2e8d6a9f7c1b3e5d8a2f";

type Command = "remove" | "replace" | "batch" | "health" | "help" | "version";

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
