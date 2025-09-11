// Usage: node split-scaffold.mjs _scaffold.md [--force]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";

const [, , inputPath, ...args] = process.argv;
if (!inputPath) {
  console.error("Usage: node split-scaffold.mjs _scaffold.md [--force]");
  process.exit(1);
}
const FORCE = args.includes("--force");

const md = readFileSync(inputPath, "utf8").replace(/\r\n/g, "\n");

let currentPath = null;
let inCode = false;
let fence = null;
let buffer = [];
const files = [];

// Parse: headings like "## prisma/schema.prisma", followed by triple-fenced code
for (const line of md.split("\n")) {
  if (!inCode) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      currentPath = m[1].trim();
      continue;
    }
    const f = line.match(/^```(.*)$/);
    if (f && currentPath) {
      inCode = true;
      fence = "```";
      buffer = [];
      continue;
    }
  } else {
    if (line.startsWith("```")) {
      // close fence
      files.push({ path: currentPath, content: buffer.join("\n") });
      inCode = false;
      fence = null;
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
}

if (files.length === 0) {
  console.error("No files detected. Make sure your markdown has '## <path>' headings and fenced code blocks.");
  process.exit(1);
}

// Write files
for (const { path, content } of files) {
  const outPath = join(process.cwd(), path);
  mkdirSync(dirname(outPath), { recursive: true });
  if (existsSync(outPath) && !FORCE) {
    console.log(`SKIP (exists): ${path}  (use --force to overwrite)`);
    continue;
  }
  writeFileSync(outPath, content, "utf8");
  console.log(`WROTE: ${path}`);
}

console.log(`Done. Wrote ${files.length} file(s).`);
