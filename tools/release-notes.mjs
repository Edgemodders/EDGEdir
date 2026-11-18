// Prints the release notes for one version from its section of CHANGELOG.md. The Release workflow
// uses it for the GitHub release, and stops when the version has no section.
//
//   node tools/release-notes.mjs [version]            markdown for GitHub
//   node tools/release-notes.mjs [version] --nexus    the version's short Nexus summary (its <!-- nexus --> block)
//   --out <file>                                      writes the notes to a file (UTF-8)
//
// The version defaults to package.json's.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const nexus = args.includes("--nexus");
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const version = args.find((a) => !a.startsWith("--")) ?? JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const lines = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").split(/\r?\n/);

// "## 0.1.0" or "## 0.1.0 (2026-10-20)"
const heading = new RegExp(`^## ${version.replace(/\./g, "\\.")}(\\s|$)`);
const start = lines.findIndex((line) => heading.test(line));
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}: rename Unreleased to "## ${version} (date)" first`);
  process.exit(1);
}
let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
if (end < 0) end = lines.length;
const section = lines.slice(start + 1, end);
if (!section.some((line) => line.trim())) {
  console.error(`CHANGELOG.md: the section for ${version} is empty`);
  process.exit(1);
}

// The Nexus summary: a hand-written block under the version's heading, in an HTML comment that
// GitHub and the docs site hide. Nexus shows each line as one entry, as plain text, and a posted
// changelog cannot be edited, so EDGErepo's Nexus tool refuses anything else (EDGEdir #1):
//   <!-- nexus
//   New: EDGE Director, an app in the game that plays EDGEdir's scenes
//   Fixed: ...
//   -->
const open = section.findIndex((line) => line.trim() === "<!-- nexus");
const close = section.findIndex((line, i) => i > open && line.trim() === "-->");
const Link = "https://github.com/Edgemodders/EDGEdir/blob/main/CHANGELOG.md";

if (nexus) {
  const stop = (why) => {
    console.error(`CHANGELOG.md, ${version}: ${why}`);
    process.exit(1);
  };
  if (open < 0 || close < 0) stop('no Nexus summary. Under the heading add "<!-- nexus", a line for each change, and "-->"');
  const summary = section.slice(open + 1, close).map((line) => line.trim()).filter(Boolean);
  if (!summary.length) stop("the Nexus summary is empty");
  if (summary.length > 13) stop(`the Nexus summary has ${summary.length} lines; at most 13`);
  for (const line of summary) {
    if (!/^(New|Changed|Fixed|Removed|Other|Needs): \S/.test(line)) stop(`a Nexus summary line starts with New:, Changed:, Fixed:, Removed:, Other: or Needs: ("${line.slice(0, 60)}")`);
    if (line.length > 120) stop(`a Nexus summary line is ${line.length} characters; at most 120 ("${line.slice(0, 60)}...")`);
    if (/[`#]|\*\*|\]\(/.test(line)) stop(`a Nexus summary line is plain text, with no markdown ("${line.slice(0, 60)}")`);
  }
  write([...summary, `Full changelog: ${Link}`].join("\n"));
} else {
  const notes = open >= 0 && close >= 0 ? [...section.slice(0, open), ...section.slice(close + 1)] : section;
  write(`${notes.join("\n").trim()}

**Install:** from the VS Code Marketplace or Open VSX (search for EDGEdir), or the \`.vsix\` below with Extensions > ... > Install from VSIX... EDGE Director, the app in the game, is the EDGE-Director zip below: install it with your mod manager. Docs: https://edgemodders.github.io/EDGEdir/ (changelog: ${Link})`);
}

function write(text) {
  if (out) fs.writeFileSync(out, text + "\n", "utf8");
  else console.log(text);
}
