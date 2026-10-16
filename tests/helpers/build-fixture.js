const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const ELEVENTY = path.join(ROOT, "node_modules", "@11ty", "eleventy", "cmd.cjs");

// Builds a throwaway copy of the site with some _data files replaced.
// Assets are skipped (they are passthrough-only) except uploads, which keeps it fast.
function buildWith(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "io-site-"));
  for (const p of ["lib", ".eleventy.js", "package.json"]) {
    fs.cpSync(path.join(ROOT, p), path.join(dir, p), { recursive: true });
  }
  const assets = path.join(ROOT, "src", "assets");
  const uploads = path.join(assets, "img", "uploads");
  fs.cpSync(path.join(ROOT, "src"), path.join(dir, "src"), {
    recursive: true,
    // Skip assets except the uploads folder and the directories leading to it.
    filter: (src) => !src.startsWith(assets + path.sep) || uploads.startsWith(src) || src.startsWith(uploads),
  });
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  for (const [file, data] of Object.entries(overrides)) {
    fs.writeFileSync(path.join(dir, "src", "_data", file), JSON.stringify(data));
  }
  execFileSync(process.execPath, [ELEVENTY, "--quiet"], { cwd: dir, stdio: "pipe" });
  return (page) => fs.readFileSync(path.join(dir, "_site", page), "utf8");
}

module.exports = { buildWith };
