# Content Editing (Eleventy + Decap CMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Dr. Imaobong edit messages, gallery, books, testimonies, homepage text and contact details at `imaobongodutola.com/admin`, while the public site's HTML stays identical.

**Architecture:** The 7 hand-written pages become Nunjucks templates in `src/`, byte-for-byte except the editable regions, which read from `src/_data/*.json`. Eleventy builds them to `_site/`. A JS data file (`src/_data/resolved.js` → `lib/view.js`) turns raw JSON into render-ready view data (YouTube IDs, resized uploads, featured book, testimony placeholders). Decap CMS at `/admin` edits the JSON through DecapBridge (email + password) and commits to a new private GitHub repo; Netlify builds on every push.

**Tech Stack:** Node 22+ (local is v26), `@11ty/eleventy` 3.x, `@11ty/eleventy-img` 6.x, `sharp`, `js-yaml` (tests only), Decap CMS 3.x from unpkg, DecapBridge, Netlify, Python 3 stdlib (parity + asset checks), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-16-content-editing-design.md`

## Global Constraints

- The visitor-facing site does not change: built `_site/*.html` must be token-identical to the baseline (whitespace and entity encoding aside) after the migration.
- New dedicated private GitHub repo `abdulsalamtoyin/imaobongodutola-website`. Do not touch the Desktop-level repo or its `journey-to-discovery` remote.
- Same Netlify site: `imaobongodutola`, id `e596e26e-bfec-44e5-a833-05244b78ba72`. Domain, HTTPS and Netlify Forms are unchanged.
- $0/month: no paid services.
- Project root is `/Users/toyinabdulsalam/Desktop/Imaobong_Odutola_website` (no trailing space). All paths below are relative to it.
- Asset URLs stay relative (`assets/...`, no leading slash), matching the current pages, which all sit at the site root.
- Existing images are never re-encoded. Only files under `assets/img/uploads/` go through the resize pipeline.
- Upload size limit: 8 MB (`max_file_size: 8000000`).
- Gallery sizes: thumb 700px wide, full 1600px wide (matching the current `thumb/` and `full/` files).
- Gallery categories, exactly: `conferences` ("Conferences & preaching"), `ministry` ("Ministry & impartation"), `crusades` ("Crusades & gatherings").

## Review Focus

1. **YouTube link pasted in any common form** (`watch?v=`, `youtu.be/`, `/shorts/`, with `&t=` or `?si=` tails, or a bare 11-character ID) → the right video plays. Anything else fails the build with a message naming the bad value, instead of silently embedding a wrong video. Owned by Task 3.
2. **Special characters in her text** (`&`, `<`, `"`, `’`, emoji) → shown literally, and the page markup isn't broken. Owned by Task 5.
3. **Testimony counts 0, 1, 3 and 5, and a missing city** → empty slots are padded to 3 placeholders. The "Needed from Imaobong" callout shows only when there are 0 testimonies. Captions read "Name, City", or "Name" when the city is blank. Owned by Task 8.
4. **Large or oddly named uploads** (a 4000px PNG, a filename with spaces or capitals, an image smaller than the target width) → resized to JPEG at no more than the target width, under a web-safe URL, never upscaled. Owned by Task 3.
5. **Emptied lists and blank optional fields** (zero messages, no featured book, no books, an empty `youtube` social, an empty `subtitle`) → the build succeeds and no empty element is rendered. Owned by Tasks 4, 5 and 6.

---

## File Structure

```
.gitignore                     allowlist: only project files are tracked
package.json                   deps + scripts (build, test, parity)
.eleventy.js                   input src → _site, passthrough, permalinks, autoescape
netlify.toml                   build command + publish dir + Node version
lib/youtube.js                 youtubeId(input) → 11-char ID or throws
lib/images.js                  isUpload, resize, galleryVariants
lib/view.js                    buildView(raw, opts) → render-ready data
scripts/parity.py              token-level HTML comparison: baseline vs _site
scripts/check_assets.py        every local src/href/data-* in _site resolves
scripts/extract_content.py     one-time: baseline HTML → src/_data/*.json
tests/baseline/*.html          frozen copy of today's 7 pages
tests/helpers/build-fixture.js build a temp copy of the site with overridden data
tests/*.test.js                node:test suites
src/_data/{messages,gallery,books,testimonies,home,contact}.json   editable content
src/_data/resolved.js          reads the JSON, calls buildView
src/src.11tydata.js            permalink: <name>.html
src/_includes/footer.njk       the shared footer (identical on all 7 pages today)
src/{index,about,messages,coaching,store,speaking,gallery}.njk
src/admin/index.html           Decap CMS loader
src/admin/config.yml           CMS collections
src/assets/**                  moved unchanged from site/assets
src/robots.txt src/sitemap.xml moved unchanged
docs/guide/index.html          "How to update your website" for Imaobong (+ PDF)
README.md                      rewritten for the new workflow
```

---

### Task 1: Own repo, baseline snapshot, parity tool

**Files:**
- Create: `.gitignore`, `scripts/parity.py`, `tests/baseline/*.html` (copied)
- Move: `site/*` → `src/`

**Interfaces:**
- Produces: `python3 -I scripts/parity.py <baselineDir> <builtDir>` exits 0 when every `*.html` in the baseline matches; otherwise exits 1 and prints file, token index, expected and actual.

- [ ] **Step 1: Create the repo inside the website folder**

```bash
cd /Users/toyinabdulsalam/Desktop/Imaobong_Odutola_website
git init -b main
git -C . rev-parse --show-toplevel   # must print .../Imaobong_Odutola_website, not .../Desktop
```

- [ ] **Step 2: Write `.gitignore` (allowlist, so raw videos, WhatsApp images, site.zip and .docx are never committed)**

```gitignore
/*
!/.gitignore
!/package.json
!/package-lock.json
!/.eleventy.js
!/netlify.toml
!/README.md
!/src/
!/lib/
!/scripts/
!/tests/
!/docs/
node_modules/
_site/
.DS_Store
```

- [ ] **Step 3: Snapshot the baseline and move the site into `src/`**

```bash
mkdir -p tests/baseline
cp site/*.html tests/baseline/
mv site src
ls src tests/baseline
```
Expected: `src` has the 7 html files, `assets/`, `robots.txt`, `sitemap.xml`. `tests/baseline` has the 7 html files.

- [ ] **Step 4: Write `scripts/parity.py`**

```python
"""Compare built HTML to the baseline at token level.

Whitespace runs collapse to one space, entities are decoded and attribute
order is ignored, so `&middot;` == `·` and re-indented markup still matches.
Comments are ignored. Anything else that differs is a visible change.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


class Tokens(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def handle_starttag(self, tag, attrs):
        self.out.append(("start", tag, tuple(sorted((k, norm(v or "")) for k, v in attrs))))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        self.out.append(("end", tag))

    def handle_data(self, data):
        t = norm(data)
        if t:
            self.out.append(("text", t))


def tokens(path):
    p = Tokens()
    p.feed(Path(path).read_text(encoding="utf-8"))
    return p.out


def main(baseline_dir, built_dir):
    failed = False
    for base in sorted(Path(baseline_dir).glob("*.html")):
        built = Path(built_dir) / base.name
        if not built.exists():
            print(f"MISSING {built}")
            failed = True
            continue
        a, b = tokens(base), tokens(built)
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                print(f"DIFF {base.name} token {i}\n  expected: {x}\n  actual:   {y}")
                failed = True
                break
        else:
            if len(a) != len(b):
                print(f"DIFF {base.name}: {len(a)} tokens expected, {len(b)} built")
                failed = True
            else:
                print(f"ok   {base.name}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
```

- [ ] **Step 5: Prove the tool passes on identical input and fails on a real change**

```bash
python3 -I scripts/parity.py tests/baseline src
```
Expected: seven `ok` lines, exit 0.

```bash
mkdir -p /tmp/parity-neg && cp src/*.html /tmp/parity-neg/
sed -i '' 's/Teaching that awakens/Teaching that awakes/' /tmp/parity-neg/index.html
python3 -I scripts/parity.py tests/baseline /tmp/parity-neg; echo "exit=$?"
```
Expected: `DIFF index.html token …` showing both strings, then `exit=1`.

```bash
cp src/*.html /tmp/parity-neg/ && perl -0pi -e 's/\n\s+/\n/g' /tmp/parity-neg/about.html
python3 -I scripts/parity.py tests/baseline /tmp/parity-neg; echo "exit=$?"
```
Expected: all `ok`, `exit=0`, because indentation is ignored.

- [ ] **Step 6: Commit (includes the approved spec and this plan)**

```bash
git add .gitignore scripts/parity.py tests/baseline src docs
git status --short --ignored | head   # raw videos / WhatsApp images must show as ignored (!!), never staged
git commit -m "chore: own repo for the website; baseline snapshot and parity checker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Eleventy scaffold that reproduces the site unchanged

**Files:**
- Create: `package.json`, `.eleventy.js`, `netlify.toml`, `src/src.11tydata.js`, `src/_includes/footer.njk`, `scripts/check_assets.py`
- Rename: `src/*.html` → `src/*.njk`

**Interfaces:**
- Produces: `npm run build` → `_site/` holding 7 pages at `/<name>.html` plus `assets/`, `robots.txt`, `sitemap.xml`. `{% include "footer.njk" %}` is available to every page. `npm run parity` runs both Python checks.

- [ ] **Step 1: `package.json` and install**

```json
{
  "name": "imaobongodutola-website",
  "private": true,
  "scripts": {
    "build": "eleventy",
    "serve": "eleventy --serve",
    "test": "node --test tests/",
    "parity": "npm run build && python3 -I scripts/parity.py tests/baseline _site && python3 -I scripts/check_assets.py _site"
  },
  "dependencies": {
    "@11ty/eleventy": "^3.1.0",
    "@11ty/eleventy-img": "^6.0.0",
    "sharp": "^0.34.0"
  },
  "devDependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

```bash
npm install
```

- [ ] **Step 2: `.eleventy.js`**

```js
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "src/admin": "admin",
    "src/robots.txt": "robots.txt",
    "src/sitemap.xml": "sitemap.xml",
  });
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.ignores.add("src/assets/**");
  // Her text must never be able to break the markup.
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk"],
  };
};
```

- [ ] **Step 3: `src/src.11tydata.js` so `about.njk` builds to `/about.html` and not `/about/index.html`**

```js
module.exports = {
  permalink: (data) => `${data.page.filePathStem}.html`,
};
```

- [ ] **Step 4: `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "_site"

[build.environment]
  NODE_VERSION = "22"
```

- [ ] **Step 5: Rename pages and extract the shared footer**

```bash
for f in src/*.html; do mv "$f" "${f%.html}.njk"; done
mkdir -p src/_includes
sed -n '/<footer class="footer">/,/<\/footer>/p' src/about.njk > src/_includes/footer.njk
for f in src/*.njk; do
  perl -0pi -e 's{  <footer class="footer">.*?</footer>}{  {% include "footer.njk" %}}s' "$f"
done
grep -c 'include "footer.njk"' src/*.njk   # 1 per page
```
(The footer block was verified identical across all 7 pages: the same md5 for each.)

- [ ] **Step 6: Write `scripts/check_assets.py`**

```python
"""Fail if any local src/href/poster/data-src/data-full in built HTML is missing."""
import sys
from html.parser import HTMLParser
from pathlib import Path

ATTRS = {"src", "href", "poster", "data-src", "data-full"}
SKIP = ("http:", "https:", "mailto:", "tel:", "#", "data:", "//")


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ATTRS and v and not v.startswith(SKIP):
                self.refs.append(v.split("#")[0].split("?")[0])


def main(site):
    root = Path(site)
    missing = []
    for page in sorted(root.glob("*.html")):
        p = Refs()
        p.feed(page.read_text(encoding="utf-8"))
        for ref in p.refs:
            if ref and not (root / ref.lstrip("/")).exists():
                missing.append(f"{page.name}: {ref}")
    print("\n".join(missing) or "all local references resolve")
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 7: Build and verify parity**

```bash
npm run parity
```
Expected: seven `ok` lines and `all local references resolve`. If a page fails, diff `tests/baseline/<page>` against `_site/<page>`. The usual cause is the footer `perl` replacement eating too much or too little.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .eleventy.js netlify.toml src scripts/check_assets.py
git commit -m "build: Eleventy scaffold reproducing the static site; shared footer partial

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: YouTube and image helpers (TDD)

**Files:**
- Create: `lib/youtube.js`, `lib/images.js`, `tests/youtube.test.js`, `tests/images.test.js`

**Interfaces:**
- Produces:
  - `youtubeId(input: string) → string` (11 chars). Throws `Error('Not a YouTube link: "<input>"')`.
  - `isUpload(src: string) → boolean`: true when `src` (leading `/` ignored) starts with `assets/img/uploads/`.
  - `resize(src, width, opts?) → Promise<string>`: uploads become `assets/img/generated/<hash>-<w>.jpeg` (never upscaled), anything else is returned unchanged. `opts = { inputDir = <root>/src, outputDir = <root>/_site/assets/img/generated }`.
  - `galleryVariants(src, opts?) → Promise<{ full, thumb }>`: existing `…/gallery/full/x.jpg` maps to `…/gallery/thumb/x.jpg`, and uploads are resized to 1600 and 700.

- [ ] **Step 1: Failing tests, `tests/youtube.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { youtubeId } = require("../lib/youtube");

test("accepts every common YouTube link form", () => {
  for (const input of [
    "2xz-IM-QyTA",
    "https://youtu.be/2xz-IM-QyTA",
    "https://youtu.be/2xz-IM-QyTA?si=abc123",
    "https://www.youtube.com/watch?v=2xz-IM-QyTA",
    "https://www.youtube.com/watch?feature=share&v=2xz-IM-QyTA&t=42s",
    "https://m.youtube.com/watch?v=2xz-IM-QyTA",
    "https://www.youtube.com/shorts/2xz-IM-QyTA",
    "https://www.youtube.com/embed/2xz-IM-QyTA",
    "https://www.youtube.com/live/2xz-IM-QyTA?si=x",
    "  https://youtu.be/2xz-IM-QyTA  ",
  ]) {
    assert.equal(youtubeId(input), "2xz-IM-QyTA", input);
  }
});

test("rejects anything that is not a YouTube video", () => {
  for (const input of ["", "hello", "https://vimeo.com/123456789", "https://www.youtube.com/@imaobongodutola"]) {
    assert.throws(() => youtubeId(input), /Not a YouTube link/, input);
  }
});
```

- [ ] **Step 2: Failing tests, `tests/images.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { isUpload, resize, galleryVariants } = require("../lib/images");

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "io-img-"));
  fs.mkdirSync(path.join(dir, "src/assets/img/uploads"), { recursive: true });
  return {
    dir,
    opts: { inputDir: path.join(dir, "src"), outputDir: path.join(dir, "_site/assets/img/generated") },
    put: (name, width, height) =>
      sharp({ create: { width, height, channels: 3, background: "#336699" } })
        .png()
        .toFile(path.join(dir, "src/assets/img/uploads", name)),
  };
}

test("isUpload only matches the uploads folder", () => {
  assert.equal(isUpload("assets/img/uploads/a.jpg"), true);
  assert.equal(isUpload("/assets/img/uploads/a.jpg"), true);
  assert.equal(isUpload("assets/img/gallery/full/g01.jpg"), false);
  assert.equal(isUpload(""), false);
});

test("existing images pass through untouched", async () => {
  assert.equal(await resize("assets/img/feature/worship.jpg", 1200), "assets/img/feature/worship.jpg");
});

test("a large PNG with spaces in its name becomes a web-safe JPEG at the target width", async () => {
  const s = sandbox();
  await s.put("My Photo FINAL.PNG", 4000, 3000);
  const url = await resize("assets/img/uploads/My Photo FINAL.PNG", 700, s.opts);
  assert.match(url, /^assets\/img\/generated\/[A-Za-z0-9_-]+-700\.jpeg$/);
  const meta = await sharp(path.join(s.dir, "_site", url)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 700);
});

test("small uploads are never upscaled", async () => {
  const s = sandbox();
  await s.put("small.png", 500, 400);
  const url = await resize("assets/img/uploads/small.png", 700, s.opts);
  const meta = await sharp(path.join(s.dir, "_site", url)).metadata();
  assert.ok(meta.width <= 500, `width ${meta.width}`);
});

test("galleryVariants maps existing full→thumb and resizes uploads to 1600/700", async () => {
  assert.deepEqual(await galleryVariants("assets/img/gallery/full/g03.jpg"), {
    full: "assets/img/gallery/full/g03.jpg",
    thumb: "assets/img/gallery/thumb/g03.jpg",
  });
  const s = sandbox();
  await s.put("wide.png", 3000, 2000);
  const v = await galleryVariants("assets/img/uploads/wide.png", s.opts);
  assert.match(v.full, /-1600\.jpeg$/);
  assert.match(v.thumb, /-700\.jpeg$/);
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npm test`
Expected: FAIL with `Cannot find module '../lib/youtube'` and `'../lib/images'`.

- [ ] **Step 4: Implement `lib/youtube.js`**

```js
const BARE_ID = /^[\w-]{11}$/;
const IN_URL = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})(?![\w-])/;

function youtubeId(input) {
  const s = String(input ?? "").trim();
  if (BARE_ID.test(s)) return s;
  const m = s.match(IN_URL);
  if (!m) throw new Error(`Not a YouTube link: "${s}"`);
  return m[1];
}

module.exports = { youtubeId };
```

- [ ] **Step 5: Implement `lib/images.js`**

```js
const path = require("node:path");
const Image = require("@11ty/eleventy-img");

const ROOT = path.join(__dirname, "..");
const UPLOADS = "assets/img/uploads/";
const URL_PATH = "assets/img/generated/";
const DEFAULTS = {
  inputDir: path.join(ROOT, "src"),
  outputDir: path.join(ROOT, "_site", "assets", "img", "generated"),
};

function isUpload(src) {
  return typeof src === "string" && src.replace(/^\//, "").startsWith(UPLOADS);
}

async function resize(src, width, opts = {}) {
  if (!isUpload(src)) return src;
  const { inputDir, outputDir } = { ...DEFAULTS, ...opts };
  const stats = await Image(path.join(inputDir, src.replace(/^\//, "")), {
    widths: [width],
    formats: ["jpeg"],
    outputDir,
    urlPath: URL_PATH,
    sharpJpegOptions: { quality: 80, mozjpeg: true },
  });
  return stats.jpeg[0].url.replace(/^\//, "");
}

async function galleryVariants(src, opts) {
  if (!isUpload(src)) {
    return { full: src, thumb: src.replace("/gallery/full/", "/gallery/thumb/") };
  }
  return { full: await resize(src, 1600, opts), thumb: await resize(src, 700, opts) };
}

module.exports = { isUpload, resize, galleryVariants };
```

- [ ] **Step 6: Run and confirm pass**

Run: `npm test`
Expected: all tests in `youtube.test.js` and `images.test.js` PASS.

- [ ] **Step 7: Commit**

```bash
git add lib tests/youtube.test.js tests/images.test.js
git commit -m "feat: YouTube link parsing and upload resizing helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Content extraction, view model, contact details

**Files:**
- Create: `scripts/extract_content.py`, `src/_data/{messages,gallery,books,testimonies,home,contact}.json`, `lib/view.js`, `src/_data/resolved.js`, `tests/view.test.js`, `tests/helpers/build-fixture.js`, `tests/render-contact.test.js`
- Modify: `src/_includes/footer.njk`, `src/coaching.njk` (the email button), `src/speaking.njk` (the two email mentions)

**Interfaces:**
- Consumes: `youtubeId`, `resize`, `galleryVariants` (Task 3).
- Produces:
  - Global data `contact` = `{ email, instagram, facebook, tiktok, youtube }` (strings; socials may be `""`).
  - Global data `home` = the `home.json` object (fields listed in Step 1).
  - Global data `resolved` = `buildView(...)` result:
    ```
    { messages: [{ youtubeId, thumbnail, subtitle, title, paragraphs[] }],
      homeMessages: first 2 of messages,
      gallery: [{ full, thumb, alt, category }],
      homeStrip: [{ thumb }],
      books: [{ cover, cover_alt, title, tagline, description, selar_url }],
      featuredBook: { cover, cover_alt, title, lead, blurb, selar_url } | null,
      testimonies: [{ quote, caption }],
      testimonyPlaceholders: number }
    ```
  - `buildWith(overrides: { [jsonFile]: object }) → (page: string) => html` test helper.

- [ ] **Step 1: Write `scripts/extract_content.py`**

```python
"""One-time: pull today's content out of the baseline HTML into src/_data/*.json."""
import html
import json
import re
import sys
from pathlib import Path

base, out = Path(sys.argv[1]), Path(sys.argv[2])


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


page = (base / "messages.html").read_text(encoding="utf-8")
messages = []
for art in re.findall(r'<article class="message".*?</article>', page, re.S):
    sub = re.search(r'<span class="eyebrow">(.*?)</span>', art, re.S)
    messages.append({
        "youtube": "https://youtu.be/" + re.search(r'data-yt="([^"]+)"', art).group(1),
        "thumbnail": re.search(r'<img src="([^"]+)"', art).group(1),
        "subtitle": clean(sub.group(1)) if sub else "",
        "title": clean(re.search(r"<h3>(.*?)</h3>", art, re.S).group(1)),
        "paragraphs": [clean(p) for p in re.findall(r"<p>(.*?)</p>", art, re.S)],
    })
write("messages.json", {"items": messages})

page = (base / "gallery.html").read_text(encoding="utf-8")
gallery = [
    {"image": full, "alt": html.unescape(alt), "category": cat}
    for cat, full, alt in re.findall(
        r'data-cat="([^"]+)" data-full="([^"]+)"><img src="[^"]+" alt="([^"]*)"', page)
]
write("gallery.json", {"items": gallery})

page = (base / "store.html").read_text(encoding="utf-8")
books = []
for card in re.findall(r'<article class="book-card".*?</article>', page, re.S):
    cover, alt = re.search(r'<img src="([^"]+)" alt="([^"]*)"', card).groups()
    ps = re.findall(r"<p[^>]*>(.*?)</p>", card, re.S)
    books.append({
        "cover": cover, "cover_alt": html.unescape(alt),
        "title": clean(re.search(r"<h3>(.*?)</h3>", card, re.S).group(1)),
        "tagline": clean(ps[0]), "description": clean(ps[1]),
        "selar_url": re.search(r'href="(https://selar[^"]+)"', card).group(1),
        "featured": False, "feature_lead": "", "feature_blurb": "",
    })
index = (base / "index.html").read_text(encoding="utf-8")
feat = re.search(r'<div class="book-feature".*?</section>', index, re.S).group(0)
feat_title = clean(re.search(r"<h2[^>]*>(.*?)</h2>", feat, re.S).group(1))
feat_ps = re.findall(r"<p[^>]*>(.*?)</p>", feat, re.S)
for b in books:
    if b["title"] == feat_title:
        b.update(featured=True, feature_lead=clean(feat_ps[0]), feature_blurb=clean(feat_ps[1]))
write("books.json", {"items": books})

strip = re.findall(r'gallery/thumb/(g\d+\.jpg)" alt="From the gatherings"', index)
write("home.json", {
    "hero_eyebrow": "Apostle · Medical Doctor · Purpose Coach · Author",
    "hero_quote": "Life becomes truly meaningful when you discover your purpose in Christ and fully surrender to His divine will.",
    "about_heading": "An ambassador of Jesus Christ",
    "about_lead": "A trained Medical Doctor, called to be an Apostle of Jesus Christ, who has devoted her life to raising disciples for the Kingdom of God.",
    "messages_heading": "Teaching that awakens",
    "coaching_heading": "Discover and fulfil your purpose in Christ",
    "coaching_lead": "As a certified Purpose Coach, Dr. Imaobong has guided countless individuals into discovering their God-given identity, unlocking hidden potential, and aligning their lives with Heaven’s agenda.",
    "gallery_heading": "From the gatherings",
    "gallery_strip": ["assets/img/gallery/full/" + f for f in strip],
    "testimonies_heading": "What the Lord has done",
    "testimonies_lead": "Testimonies from believers who have encountered God through these gatherings — and room for you to add yours.",
})
write("testimonies.json", {"items": []})
write("contact.json", {
    "email": "doctorimaobong@gmail.com",
    "instagram": "https://www.instagram.com/imaobongodutola/",
    "facebook": "https://www.facebook.com/imaobongodutolapage/",
    "tiktok": "https://www.tiktok.com/@pastorimaobongodutola",
    "youtube": "",
})
print(f"{len(messages)} messages, {len(gallery)} photos, {len(books)} books, strip {len(strip)}")
```

- [ ] **Step 2: Run it and sanity-check counts**

```bash
mkdir -p src/_data
python3 -I scripts/extract_content.py tests/baseline src/_data
```
Expected: `4 messages, 28 photos, 5 books, strip 6`. Open `books.json` and confirm "The Praying Grace" has `"featured": true` with `feature_lead` "When the kneeling saint becomes the standing giant."

- [ ] **Step 3: Failing tests, `tests/view.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildView } = require("../lib/view");

const raw = (over = {}) => ({
  messages: [], gallery: [], books: [], testimonies: [],
  home: { gallery_strip: [] }, ...over,
});

test("messages get YouTube IDs, keep order, drop blank paragraphs; home shows first 2", async () => {
  const m = (t) => ({ youtube: "https://youtu.be/2xz-IM-QyTA", thumbnail: "assets/img/feature/worship.jpg", subtitle: "", title: t, paragraphs: ["One", "", "Two"] });
  const v = await buildView(raw({ messages: [m("A"), m("B"), m("C")] }));
  assert.deepEqual(v.messages.map((x) => x.title), ["A", "B", "C"]);
  assert.equal(v.messages[0].youtubeId, "2xz-IM-QyTA");
  assert.deepEqual(v.messages[0].paragraphs, ["One", "Two"]);
  assert.deepEqual(v.homeMessages.map((x) => x.title), ["A", "B"]);
});

test("a bad YouTube link fails loudly, naming the message", async () => {
  await assert.rejects(
    buildView(raw({ messages: [{ youtube: "https://vimeo.com/1", title: "Grace", thumbnail: "x.jpg", paragraphs: [] }] })),
    /Grace.*Not a YouTube link/,
  );
});

test("featured book: first ticked wins, falls back to first book, null when none", async () => {
  const b = (title, featured, extra = {}) => ({ cover: "c.jpg", cover_alt: "", title, tagline: `${title} tag`, description: `${title} desc`, selar_url: "https://selar.com/x", featured, feature_lead: "", feature_blurb: "", ...extra });
  let v = await buildView(raw({ books: [b("A", false), b("B", true, { feature_lead: "Lead B" }), b("C", true)] }));
  assert.equal(v.featuredBook.title, "B");
  assert.equal(v.featuredBook.lead, "Lead B");
  assert.equal(v.featuredBook.blurb, "B desc");
  v = await buildView(raw({ books: [b("A", false)] }));
  assert.equal(v.featuredBook.title, "A");
  assert.equal(v.featuredBook.lead, "A tag");
  v = await buildView(raw());
  assert.equal(v.featuredBook, null);
});

test("testimonies pad to 3 placeholders and caption 'Name, City' or 'Name'", async () => {
  const t = (name, city) => ({ quote: "God healed me", name, city });
  for (const [list, placeholders] of [[[], 3], [[t("Ada", "Lagos")], 2], [[t("A", "x"), t("B", "y"), t("C", "z")], 0], [Array(5).fill(t("A", "x")), 0]]) {
    const v = await buildView(raw({ testimonies: list }));
    assert.equal(v.testimonyPlaceholders, placeholders);
    assert.equal(v.testimonies.length, list.length);
  }
  const v = await buildView(raw({ testimonies: [t("Ada", "Lagos"), t("Bola", "")] }));
  assert.deepEqual(v.testimonies.map((x) => x.caption), ["Ada, Lagos", "Bola"]);
});

test("gallery and home strip resolve thumbs for existing photos", async () => {
  const v = await buildView(raw({
    gallery: [{ image: "assets/img/gallery/full/g01.jpg", alt: "x", category: "ministry" }],
    home: { gallery_strip: ["assets/img/gallery/full/g03.jpg"] },
  }));
  assert.equal(v.gallery[0].thumb, "assets/img/gallery/thumb/g01.jpg");
  assert.deepEqual(v.homeStrip, [{ thumb: "assets/img/gallery/thumb/g03.jpg" }]);
});
```

- [ ] **Step 4: Run, confirm failure**

Run: `npm test`
Expected: `view.test.js` FAILS with `Cannot find module '../lib/view'`.

- [ ] **Step 5: Implement `lib/view.js`**

```js
const { youtubeId } = require("./youtube");
const { resize, galleryVariants } = require("./images");

const nonBlank = (s) => typeof s === "string" && s.trim() !== "";

async function buildView({ messages = [], gallery = [], books = [], testimonies = [], home = {} }, opts) {
  const msgs = await Promise.all(messages.map(async (m) => {
    let id;
    try { id = youtubeId(m.youtube); } catch (e) { throw new Error(`Message "${m.title}": ${e.message}`); }
    return {
      youtubeId: id,
      thumbnail: await resize(m.thumbnail, 1200, opts),
      subtitle: m.subtitle || "",
      title: m.title,
      paragraphs: (m.paragraphs || []).filter(nonBlank),
    };
  }));

  const photos = await Promise.all(gallery.map(async (g) => ({
    ...(await galleryVariants(g.image, opts)), alt: g.alt, category: g.category,
  })));

  const strip = await Promise.all((home.gallery_strip || []).filter(nonBlank).map(async (src) => ({
    thumb: (await galleryVariants(src, opts)).thumb,
  })));

  const bookViews = await Promise.all(books.map(async (b) => ({
    ...b, cover: await resize(b.cover, 800, opts),
  })));
  const feat = bookViews.find((b) => b.featured) || bookViews[0];

  const filled = testimonies.filter((t) => nonBlank(t.quote)).map((t) => ({
    quote: t.quote,
    caption: nonBlank(t.city) ? `${t.name}, ${t.city}` : t.name,
  }));

  return {
    messages: msgs,
    homeMessages: msgs.slice(0, 2),
    gallery: photos,
    homeStrip: strip,
    books: bookViews.map(({ cover, cover_alt, title, tagline, description, selar_url }) =>
      ({ cover, cover_alt, title, tagline, description, selar_url })),
    featuredBook: feat ? {
      cover: feat.cover, cover_alt: feat.cover_alt, title: feat.title, selar_url: feat.selar_url,
      lead: nonBlank(feat.feature_lead) ? feat.feature_lead : feat.tagline,
      blurb: nonBlank(feat.feature_blurb) ? feat.feature_blurb : feat.description,
    } : null,
    testimonies: filled,
    testimonyPlaceholders: Math.max(0, 3 - filled.length),
  };
}

module.exports = { buildView };
```

- [ ] **Step 6: `src/_data/resolved.js`**

```js
const fs = require("node:fs");
const path = require("node:path");
const { buildView } = require("../../lib/view");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), "utf8"));

module.exports = () => buildView({
  messages: read("messages.json").items,
  gallery: read("gallery.json").items,
  books: read("books.json").items,
  testimonies: read("testimonies.json").items,
  home: read("home.json"),
});
```

- [ ] **Step 7: Run `npm test`, confirm `view.test.js` passes**

- [ ] **Step 8: Test helper, `tests/helpers/build-fixture.js`**

```js
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
  const assets = `${path.sep}src${path.sep}assets${path.sep}`;
  fs.cpSync(path.join(ROOT, "src"), path.join(dir, "src"), {
    recursive: true,
    filter: (src) => !src.includes(assets) || src.includes(`${path.sep}uploads`),
  });
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  for (const [file, data] of Object.entries(overrides)) {
    fs.writeFileSync(path.join(dir, "src", "_data", file), JSON.stringify(data));
  }
  execFileSync(process.execPath, [ELEVENTY, "--quiet"], { cwd: dir, stdio: "pipe" });
  return (page) => fs.readFileSync(path.join(dir, "_site", page), "utf8");
}

module.exports = { buildWith };
```

- [ ] **Step 9: Failing test, `tests/render-contact.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWith } = require("./helpers/build-fixture");

const contact = (over = {}) => ({
  email: "new@example.org",
  instagram: "https://www.instagram.com/imaobongodutola/",
  facebook: "https://www.facebook.com/imaobongodutolapage/",
  tiktok: "https://www.tiktok.com/@pastorimaobongodutola",
  youtube: "", ...over,
});

test("changing the email updates every page, the coaching button and the speaking hint", () => {
  const page = buildWith({ "contact.json": contact() });
  for (const p of ["index.html", "about.html", "messages.html", "coaching.html", "store.html", "speaking.html", "gallery.html"]) {
    const html = page(p);
    assert.ok(html.includes('href="mailto:new@example.org"'), p);
    assert.ok(!html.includes("doctorimaobong@gmail.com"), p);
  }
});

test("blank socials are hidden; a YouTube link adds the icon", () => {
  let html = buildWith({ "contact.json": contact({ tiktok: "" }) })("about.html");
  assert.ok(!html.includes('aria-label="TikTok"'));
  assert.ok(!html.includes('aria-label="YouTube"'));
  html = buildWith({ "contact.json": contact({ youtube: "https://www.youtube.com/@imaobongodutola" }) })("about.html");
  assert.ok(html.includes('href="https://www.youtube.com/@imaobongodutola"'));
  assert.ok(html.includes('aria-label="YouTube"'));
});
```

- [ ] **Step 10: Run, confirm failure**

Run: `node --test tests/render-contact.test.js`
Expected: FAIL. The pages still contain `doctorimaobong@gmail.com`.

- [ ] **Step 11: Template the footer, coaching and speaking pages**

In `src/_includes/footer.njk`:
- Replace `<li><a href="mailto:doctorimaobong@gmail.com">doctorimaobong@gmail.com</a></li>` with `<li><a href="mailto:{{ contact.email }}">{{ contact.email }}</a></li>`.
- Wrap each social anchor in a conditional, leaving its `<svg>` exactly as it is. The Instagram line becomes `{% if contact.instagram %}<a href="{{ contact.instagram }}" target="_blank" rel="noopener" aria-label="Instagram"><svg …unchanged…></svg></a>{% endif %}`. Do the same for Facebook (`contact.facebook`) and TikTok (`contact.tiktok`).
- After the TikTok line, add:
  ```njk
          {% if contact.youtube %}<a href="{{ contact.youtube }}" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg></a>{% endif %}
  ```

In `src/coaching.njk` (around line 120), change `href="mailto:doctorimaobong@gmail.com"` to `href="mailto:{{ contact.email }}"`.

In `src/speaking.njk` (around lines 115 and 122), replace each literal `doctorimaobong@gmail.com` with `{{ contact.email }}`, both inside the `mailto:` href and in the visible text.

Verify that nothing hard-coded is left: `grep -n doctorimaobong src/*.njk src/_includes/*.njk` prints nothing.

- [ ] **Step 12: Run all tests and parity**

```bash
npm test && npm run parity
```
Expected: all tests pass, seven `ok`, and assets resolve. (Real contact data equals the baseline, so parity still holds.)

- [ ] **Step 13: Commit**

```bash
git add scripts/extract_content.py src lib/view.js tests
git commit -m "feat: content data files, view model, editable contact details

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Messages (Messages page + homepage)

**Files:**
- Modify: `src/messages.njk` (the `<div class="messages">` block), `src/index.njk` (messages heading and the `<div class="messages">` block)
- Create: `tests/render-messages.test.js`

**Interfaces:**
- Consumes: `resolved.messages`, `resolved.homeMessages`, `home.messages_heading` (Task 4).

- [ ] **Step 1: Failing test, `tests/render-messages.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWith } = require("./helpers/build-fixture");

const msg = (over = {}) => ({
  youtube: "https://www.youtube.com/watch?v=Henup4p2Z2M&t=3s",
  thumbnail: "assets/img/feature/worship.jpg",
  subtitle: "", title: "Faith", paragraphs: ["First para.", "Second para."], ...over,
});

test("a new message appears on the Messages page and leads the homepage", () => {
  const page = buildWith({ "messages.json": { items: [msg({ title: "Brand New" }), msg(), msg()] } });
  const m = page("messages.html");
  assert.equal((m.match(/<article class="message"/g) || []).length, 3);
  assert.ok(m.includes('data-yt="Henup4p2Z2M"'));
  const home = page("index.html");
  assert.equal((home.match(/<article class="message"/g) || []).length, 2);
  assert.ok(home.indexOf("Brand New") < home.indexOf("Faith"));
  assert.ok(!home.includes("Second para."));
});

test("special characters are shown literally and cannot break markup", () => {
  const html = buildWith({ "messages.json": { items: [msg({ title: `Grace & <Truth> "now" ’ 🙏`, paragraphs: ["a < b & c"] })] } })("messages.html");
  assert.ok(html.includes("Grace &amp; &lt;Truth&gt; &quot;now&quot; ’ 🙏"));
  assert.ok(html.includes("a &lt; b &amp; c"));
  assert.ok(!html.includes("<Truth>"));
});

test("no subtitle renders no empty eyebrow; zero messages still builds", () => {
  let html = buildWith({ "messages.json": { items: [msg({ subtitle: "" })] } })("messages.html");
  assert.ok(!/<span class="eyebrow">\s*<\/span>/.test(html));
  html = buildWith({ "messages.json": { items: [] } })("index.html");
  assert.ok(!html.includes('<article class="message"'));
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/render-messages.test.js`
Expected: FAIL. The pages still show the 4 hard-coded messages.

- [ ] **Step 3: Template `src/messages.njk`**

Replace the 4 `<article class="message">` blocks inside `<div class="messages">` with:

```njk
        {%- for m in resolved.messages %}
        <article class="message" data-reveal>
          <div class="yt" data-yt="{{ m.youtubeId }}" data-yt-title="{{ m.title }}" role="button" tabindex="0">
            <img src="{{ m.thumbnail }}" alt="Dr. Imaobong Odutola preaching" loading="lazy">
            <span class="yt__play" aria-hidden="true"></span>
          </div>
          <div>
            {%- if m.subtitle %}
            <span class="eyebrow">{{ m.subtitle }}</span>
            {%- endif %}
            <h3>{{ m.title }}</h3>
            {%- for p in m.paragraphs %}
            <p>{{ p }}</p>
            {%- endfor %}
          </div>
        </article>
        {%- endfor %}
```

- [ ] **Step 4: Template `src/index.njk`**

Change `<h2 style="font-size:var(--t-h2)">Teaching that awakens</h2>` to `<h2 style="font-size:var(--t-h2)">{{ home.messages_heading }}</h2>`.

Replace the 2 `<article class="message">` blocks inside the homepage `<div class="messages">` with:

```njk
        {%- for m in resolved.homeMessages %}
        <article class="message" data-reveal>
          <div class="yt" data-yt="{{ m.youtubeId }}" data-yt-title="{{ m.title }}" role="button" tabindex="0">
            <img src="{{ m.thumbnail }}" alt="Dr. Imaobong Odutola preaching" loading="lazy">
            <span class="yt__play" aria-hidden="true"></span>
          </div>
          <div>
            <h3>{{ m.title }}</h3>
            {%- if m.paragraphs[0] %}
            <p>{{ m.paragraphs[0] }}</p>
            {%- endif %}
            <a class="link" href="messages.html">Read the full message</a>
          </div>
        </article>
        {%- endfor %}
```

- [ ] **Step 5: Run tests and parity**

```bash
npm test && npm run parity
```
Expected: all pass; `messages.html` and `index.html` are `ok`.

- [ ] **Step 6: Commit**

```bash
git add src/messages.njk src/index.njk tests/render-messages.test.js
git commit -m "feat: messages editable on Messages page and homepage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Books (Store + homepage featured book)

**Files:**
- Modify: `src/store.njk` (inside `<div class="books-grid">`), `src/index.njk` (the `<section class="section">` holding `<div class="book-feature">`)
- Create: `tests/render-books.test.js`

**Interfaces:**
- Consumes: `resolved.books`, `resolved.featuredBook` (Task 4).

- [ ] **Step 1: Failing test, `tests/render-books.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWith } = require("./helpers/build-fixture");

const book = (title, over = {}) => ({
  cover: "assets/img/books/devotional.jpg", cover_alt: `Cover of ${title}`, title,
  tagline: `${title} tagline`, description: `${title} description`,
  selar_url: "https://selar.com/abc", featured: false, feature_lead: "", feature_blurb: "", ...over,
});

test("store lists every book in order with its Selar link", () => {
  const html = buildWith({ "books.json": { items: [book("One"), book("Two"), book("Three")] } })("store.html");
  assert.equal((html.match(/<article class="book-card"/g) || []).length, 3);
  assert.ok(html.indexOf("One tagline") < html.indexOf("Three tagline"));
  assert.ok(html.includes('href="https://selar.com/abc"'));
});

test("homepage features the ticked book with its homepage wording", () => {
  const html = buildWith({ "books.json": { items: [book("One"), book("Two", { featured: true, feature_lead: "Special lead" })] } })("index.html");
  assert.match(html, /<h2[^>]*>Two<\/h2>/);
  assert.ok(html.includes("Special lead"));
  assert.ok(html.includes("Two description"));
});

test("no books: store builds with an empty grid and the homepage has no feature block", () => {
  const page = buildWith({ "books.json": { items: [] } });
  assert.ok(!page("store.html").includes('<article class="book-card"'));
  assert.ok(!page("index.html").includes('class="book-feature"'));
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/render-books.test.js`
Expected: FAIL.

- [ ] **Step 3: Template `src/store.njk`**

Replace the 5 `<article class="book-card">` blocks inside `<div class="books-grid">` with:

```njk
          {%- for b in resolved.books %}
          <article class="book-card" data-reveal>
            <div class="book-cover book-cover--image">
              <img src="{{ b.cover }}" alt="{{ b.cover_alt }}" loading="lazy" width="640">
            </div>
            <h3>{{ b.title }}</h3>
            {%- if b.tagline %}
            <p style="color:var(--brass);font-weight:600;margin-bottom:0.6rem">{{ b.tagline }}</p>
            {%- endif %}
            <p>{{ b.description }}</p>
            <div class="btn-row" style="margin-top:1.25rem">
              <a class="btn" href="{{ b.selar_url }}" target="_blank" rel="noopener">Buy on Selar</a>
            </div>
          </article>
          {%- endfor %}
```

- [ ] **Step 4: Template `src/index.njk`**

Wrap the whole featured-book `<section class="section"> … </section>` (the one containing `book-feature`) in `{% if resolved.featuredBook %}{% set fb = resolved.featuredBook %}` … `{% endif %}`. Inside it, make these substitutions:
- `The Praying Grace</h2>` → `{{ fb.title }}</h2>`
- `<p class="lead">When the kneeling saint becomes the standing giant.</p>` → `<p class="lead">{{ fb.lead }}</p>`
- The following `<p>A guide into the kind of prayer … communion with God.</p>` → `<p>{{ fb.blurb }}</p>`
- `href="https://selar.com/cr638782m6"` → `href="{{ fb.selar_url }}"`
- `<img src="assets/img/books/praying-grace.jpg" alt="Cover of The Praying Grace by Dr. Imaobong Odutola"` → `<img src="{{ fb.cover }}" alt="{{ fb.cover_alt }}"`

- [ ] **Step 5: Run tests and parity**

```bash
npm test && npm run parity
```
Expected: all pass; `store.html` and `index.html` are `ok`.

- [ ] **Step 6: Commit**

```bash
git add src/store.njk src/index.njk tests/render-books.test.js
git commit -m "feat: books editable on Store and homepage feature

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Gallery (Gallery page + homepage strip)

**Files:**
- Modify: `src/gallery.njk` (inside `<div class="gallery">`), `src/index.njk` (gallery heading and the strip inside `<div class="gallery" data-reveal>`)
- Create: `tests/render-gallery.test.js`

**Interfaces:**
- Consumes: `resolved.gallery`, `resolved.homeStrip`, `home.gallery_heading` (Task 4); `galleryVariants` (Task 3).

- [ ] **Step 1: Failing test, `tests/render-gallery.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { buildWith } = require("./helpers/build-fixture");

const ROOT = path.join(__dirname, "..");

test("an uploaded photo gets generated thumb + full and shows in the right category", async () => {
  const up = path.join(ROOT, "src/assets/img/uploads");
  fs.mkdirSync(up, { recursive: true });
  const file = path.join(up, "test-upload.png");
  await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#884422" } }).png().toFile(file);
  try {
    const page = buildWith({
      "gallery.json": { items: [
        { image: "assets/img/uploads/test-upload.png", alt: "Crusade night", category: "crusades" },
        { image: "assets/img/gallery/full/g01.jpg", alt: "Old one", category: "conferences" },
      ] },
    });
    const html = page("gallery.html");
    assert.match(html, /data-cat="crusades" data-full="assets\/img\/generated\/[\w-]+-1600\.jpeg"><img src="assets\/img\/generated\/[\w-]+-700\.jpeg" alt="Crusade night"/);
    assert.ok(html.indexOf("Crusade night") < html.indexOf("Old one"));
  } finally {
    fs.rmSync(file);
  }
});

test("homepage strip follows the picker order", () => {
  const home = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/home.json"), "utf8"));
  const html = buildWith({ "home.json": { ...home, gallery_strip: ["assets/img/gallery/full/g09.jpg", "assets/img/gallery/full/g01.jpg"] } })("index.html");
  const strip = [...html.matchAll(/gallery\/thumb\/(g\d+)\.jpg" alt="From the gatherings"/g)].map((m) => m[1]);
  assert.deepEqual(strip, ["g09", "g01"]);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/render-gallery.test.js`
Expected: FAIL.

- [ ] **Step 3: Template `src/gallery.njk`**

Replace the 28 `<button class="gallery__item" …>` lines inside `<div class="gallery">` with:

```njk
          {%- for g in resolved.gallery %}
          <button class="gallery__item" type="button" data-cat="{{ g.category }}" data-full="{{ g.full }}"><img src="{{ g.thumb }}" alt="{{ g.alt }}" loading="lazy"></button>
          {%- endfor %}
```

- [ ] **Step 4: Template `src/index.njk`**

Change `<div><h2 style="font-size:var(--t-h2)">From the gatherings</h2></div>` to `<div><h2 style="font-size:var(--t-h2)">{{ home.gallery_heading }}</h2></div>`.

Replace the 6 `<a href="gallery.html" class="gallery__item" …>` lines with:

```njk
          {%- for s in resolved.homeStrip %}
          <a href="gallery.html" class="gallery__item" style="cursor:pointer"><img src="{{ s.thumb }}" alt="From the gatherings" loading="lazy"></a>
          {%- endfor %}
```

- [ ] **Step 5: Run tests and parity**

```bash
npm test && npm run parity
```
Expected: all pass; `gallery.html` and `index.html` are `ok`. Also confirm `ls src/assets/img/uploads` does not contain `test-upload.png`.

- [ ] **Step 6: Commit**

```bash
git add src/gallery.njk src/index.njk tests/render-gallery.test.js
git commit -m "feat: gallery and homepage strip editable; uploads auto-resized

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Testimonies and homepage text

**Files:**
- Modify: `src/index.njk` (hero eyebrow, hero quote, about heading and lead, coaching heading and lead, testimonies heading, lead, callout and cards)
- Create: `tests/render-home.test.js`

**Interfaces:**
- Consumes: `resolved.testimonies`, `resolved.testimonyPlaceholders`, `home.*` (Task 4).

- [ ] **Step 1: Failing test, `tests/render-home.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildWith } = require("./helpers/build-fixture");

const HOME = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/_data/home.json"), "utf8"));
const count = (html, re) => (html.match(re) || []).length;
const t = (name, city) => ({ quote: "The Lord restored my health.", name, city });

test("0 testimonies: callout + 3 placeholders", () => {
  const html = buildWith({ "testimonies.json": { items: [] } })("index.html");
  assert.ok(html.includes("Needed from Imaobong"));
  assert.equal(count(html, /class="testimonial testimonial--empty"/g), 3);
});

test("1 testimony: no callout, 1 real card + 2 placeholders, caption 'Name, City'", () => {
  const html = buildWith({ "testimonies.json": { items: [t("Ada", "Lagos")] } })("index.html");
  assert.ok(!html.includes("Needed from Imaobong"));
  assert.equal(count(html, /class="testimonial"/g), 1);
  assert.equal(count(html, /class="testimonial testimonial--empty"/g), 2);
  assert.ok(html.includes("<figcaption>Ada, Lagos</figcaption>"));
});

test("5 testimonies, one without a city: 5 cards, no placeholders, caption 'Name'", () => {
  const items = [t("A", "x"), t("B", "y"), t("C", "z"), t("D", "w"), t("Bola", "")];
  const html = buildWith({ "testimonies.json": { items } })("index.html");
  assert.equal(count(html, /class="testimonial"/g), 5);
  assert.equal(count(html, /testimonial--empty/g), 0);
  assert.ok(html.includes("<figcaption>Bola</figcaption>"));
});

test("homepage text fields reach the page", () => {
  const html = buildWith({ "home.json": { ...HOME, hero_quote: "A brand new quote.", coaching_heading: "New coaching heading" } })("index.html");
  assert.ok(html.includes("A brand new quote."));
  assert.ok(html.includes("New coaching heading"));
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/render-home.test.js`
Expected: FAIL.

- [ ] **Step 3: Template the homepage text in `src/index.njk`**

| Current markup | Replace with |
|---|---|
| `<p class="hero__eyebrow">Apostle &middot; Medical Doctor &middot; Purpose Coach &middot; Author</p>` | `<p class="hero__eyebrow">{{ home.hero_eyebrow }}</p>` |
| the text inside `<blockquote class="hero__quote">…</blockquote>` | `{{ home.hero_quote }}` |
| `<h2>An ambassador of Jesus Christ</h2>` | `<h2>{{ home.about_heading }}</h2>` |
| the `<p class="lead">A trained Medical Doctor … Kingdom of God.</p>` in the about split | `<p class="lead">{{ home.about_lead }}</p>` |
| `<h2>Discover and fulfil your purpose in Christ</h2>` | `<h2>{{ home.coaching_heading }}</h2>` |
| the `<p class="lead">As a certified Purpose Coach … Heaven’s agenda.</p>` | `<p class="lead">{{ home.coaching_lead }}</p>` |
| `<h2 style="font-size:var(--t-h2)">What the Lord has done</h2>` | `<h2 style="font-size:var(--t-h2)">{{ home.testimonies_heading }}</h2>` |
| the `<p class="lead">Testimonies from believers … add yours.</p>` | `<p class="lead">{{ home.testimonies_lead }}</p>` |

- [ ] **Step 4: Template the testimonies in `src/index.njk`**

Inside `<div class="testify__list" data-reveal>`, wrap the existing `<div class="todo" …> … </div>` in `{% if resolved.testimonies.length == 0 %}` … `{% endif %}`, then replace the 3 `<figure class="testimonial testimonial--empty">` blocks with:

```njk
            {%- for t in resolved.testimonies %}
            <figure class="testimonial">
              <blockquote>{{ t.quote }}</blockquote>
              <figcaption>{{ t.caption }}</figcaption>
            </figure>
            {%- endfor %}
            {%- for i in range(0, resolved.testimonyPlaceholders) %}
            <figure class="testimonial testimonial--empty">
              <blockquote>Testimony to come</blockquote>
              <figcaption><span class="testimonial__note">Awaiting her words</span></figcaption>
            </figure>
            {%- endfor %}
```

- [ ] **Step 5: Run tests and parity**

```bash
npm test && npm run parity
```
Expected: all pass, and all seven pages `ok`. **The migration is now complete: every editable region is data-driven and the output is identical.**

- [ ] **Step 6: Commit**

```bash
git add src/index.njk tests/render-home.test.js
git commit -m "feat: testimonies and homepage text editable

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Decap CMS admin

**Files:**
- Create: `src/admin/index.html`, `src/admin/config.yml`, `src/assets/img/uploads/.gitkeep`, `tests/cms-config.test.js`

**Interfaces:**
- Consumes: the JSON shapes from Task 4. The test enforces that the CMS fields match them.
- Produces: `/admin/` in `_site`. `backend` is replaced in Task 10.

- [ ] **Step 1: Failing test, `tests/cms-config.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "src/admin/config.yml"), "utf8"));

test("media goes to the uploads folder with relative public paths and an 8 MB cap", () => {
  assert.equal(config.media_folder, "src/assets/img/uploads");
  assert.equal(config.public_folder, "assets/img/uploads");
  assert.equal(config.media_library.config.max_file_size, 8000000);
  assert.equal(config.publish_mode, "editorial_workflow");
});

test("every CMS file exists and its fields match the JSON exactly", () => {
  for (const coll of config.collections) {
    for (const f of coll.files) {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, f.file), "utf8"));
      const names = f.fields.map((x) => x.name).sort();
      assert.deepEqual(Object.keys(data).sort(), names, `${f.file} top-level keys`);
      for (const field of f.fields.filter((x) => x.widget === "list" && x.fields)) {
        const sub = field.fields.map((x) => x.name);
        const required = field.fields.filter((x) => x.required !== false).map((x) => x.name);
        for (const [i, item] of data[field.name].entries()) {
          for (const k of Object.keys(item)) assert.ok(sub.includes(k), `${f.file} item ${i}: unknown key ${k}`);
          for (const k of required) assert.ok(item[k] !== undefined && item[k] !== "", `${f.file} item ${i}: missing ${k}`);
        }
      }
    }
  }
});

test("gallery categories match the filter buttons", () => {
  const gallery = config.collections.find((c) => c.name === "gallery").files[0];
  const cat = gallery.fields[0].fields.find((x) => x.name === "category");
  assert.deepEqual(cat.options.map((o) => o.value).sort(), ["conferences", "crusades", "ministry"]);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/cms-config.test.js`
Expected: FAIL with `ENOENT … src/admin/config.yml`.

- [ ] **Step 3: `src/admin/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Website editor · Imaobong Odutola</title>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@VERSION/dist/decap-cms.js"
          integrity="sha384-HASH" crossorigin="anonymous"></script>
</body>
</html>
```

Pin an exact version and add Subresource Integrity, so a compromised CDN can't swap the editor code. Fill in `VERSION` and `HASH` with:

```bash
V=$(npm view decap-cms version); echo "$V"
curl -sL "https://unpkg.com/decap-cms@$V/dist/decap-cms.js" | openssl dgst -sha384 -binary | openssl base64 -A
```
Then open `/admin/` locally (Step 6) and confirm the browser console shows no integrity error.

- [ ] **Step 4: `src/admin/config.yml`**

```yaml
# backend is replaced in Task 10 with the block DecapBridge generates.
backend:
  name: git-gateway
  branch: main
local_backend: true
publish_mode: editorial_workflow
site_url: https://imaobongodutola.com
display_url: https://imaobongodutola.com
logo_url: https://imaobongodutola.com/assets/brand/logo.png
media_folder: src/assets/img/uploads
public_folder: assets/img/uploads
media_library:
  name: default
  config:
    max_file_size: 8000000

collections:
  - name: messages
    label: Messages
    files:
      - name: messages
        label: Messages (Messages page; the first two also show on the homepage)
        file: src/_data/messages.json
        fields:
          - label: Messages
            name: items
            widget: list
            summary: "{{fields.title}}"
            fields:
              - label: YouTube link
                name: youtube
                widget: string
                hint: Paste the link from YouTube's Share button, e.g. https://youtu.be/…
                pattern: ['(youtu\.be/|youtube\.com/|^[\w-]{11}$)', "Must be a YouTube link"]
              - { label: Thumbnail image, name: thumbnail, widget: image }
              - { label: Small line above the title, name: subtitle, widget: string, required: false }
              - { label: Title, name: title, widget: string }
              - label: Paragraphs
                name: paragraphs
                widget: list
                field: { label: Paragraph, name: paragraph, widget: text }

  - name: gallery
    label: Gallery
    files:
      - name: gallery
        label: Gallery photos
        file: src/_data/gallery.json
        fields:
          - label: Photos
            name: items
            widget: list
            summary: "{{fields.alt}}"
            fields:
              - { label: Photo, name: image, widget: image }
              - { label: Describe the photo (for blind visitors and Google), name: alt, widget: string }
              - label: Category
                name: category
                widget: select
                options:
                  - { label: "Conferences & preaching", value: conferences }
                  - { label: "Ministry & impartation", value: ministry }
                  - { label: "Crusades & gatherings", value: crusades }

  - name: books
    label: Books
    files:
      - name: books
        label: Books (Store page and homepage)
        file: src/_data/books.json
        fields:
          - label: Books
            name: items
            widget: list
            summary: "{{fields.title}}"
            fields:
              - { label: Cover, name: cover, widget: image }
              - { label: Describe the cover, name: cover_alt, widget: string }
              - { label: Title, name: title, widget: string }
              - { label: Subtitle (gold line), name: tagline, widget: string, required: false }
              - { label: Description, name: description, widget: text }
              - label: Selar link
                name: selar_url
                widget: string
                pattern: ['^https?://', "Must start with https://"]
              - { label: Feature this book on the homepage, name: featured, widget: boolean, default: false, required: false }
              - { label: Homepage line (optional), name: feature_lead, widget: string, required: false }
              - { label: Homepage description (optional), name: feature_blurb, widget: text, required: false }

  - name: testimonies
    label: Testimonies
    files:
      - name: testimonies
        label: Testimonies (homepage)
        file: src/_data/testimonies.json
        fields:
          - label: Testimonies
            name: items
            widget: list
            summary: "{{fields.name}}"
            fields:
              - { label: Testimony, name: quote, widget: text }
              - { label: First name, name: name, widget: string }
              - { label: City, name: city, widget: string, required: false }

  - name: home
    label: Homepage text
    files:
      - name: home
        label: Homepage text and gallery strip
        file: src/_data/home.json
        fields:
          - { label: Line above your name, name: hero_eyebrow, widget: string }
          - { label: Quote under your name, name: hero_quote, widget: text }
          - { label: About heading, name: about_heading, widget: string }
          - { label: About intro, name: about_lead, widget: text }
          - { label: Messages heading, name: messages_heading, widget: string }
          - { label: Coaching heading, name: coaching_heading, widget: string }
          - { label: Coaching intro, name: coaching_lead, widget: text }
          - { label: Gallery heading, name: gallery_heading, widget: string }
          - label: Homepage gallery strip (6 photos look best)
            name: gallery_strip
            widget: list
            field: { label: Photo, name: image, widget: image }
          - { label: Testimonies heading, name: testimonies_heading, widget: string }
          - { label: Testimonies intro, name: testimonies_lead, widget: text }

  - name: contact
    label: Contact & socials
    files:
      - name: contact
        label: Contact details (footer of every page)
        file: src/_data/contact.json
        fields:
          - label: Email
            name: email
            widget: string
            pattern: ['^[^@\s]+@[^@\s]+\.[^@\s]+$', "Must be an email address"]
          - { label: Instagram link, name: instagram, widget: string, required: false }
          - { label: Facebook link, name: facebook, widget: string, required: false }
          - { label: TikTok link, name: tiktok, widget: string, required: false }
          - { label: YouTube channel link, name: youtube, widget: string, required: false }
```

- [ ] **Step 5: Keep the uploads folder in git, run the tests**

```bash
touch src/assets/img/uploads/.gitkeep
npm test
```
Expected: all suites pass, including `cms-config.test.js`.

- [ ] **Step 6: Try the editor locally (no login needed thanks to `local_backend`)**

```bash
npx decap-server &          # port 8081
npm run serve               # http://localhost:8080
```
Open `http://localhost:8080/admin/`, choose "Work with local repository", then:
1. Under Messages, edit the first title, save and publish.
2. Under Gallery, upload a phone photo, set a description and category, save and publish.

Confirm that `src/_data/messages.json` and `gallery.json` changed, the photo is in `src/assets/img/uploads/`, and the page at `:8080` shows both. Then revert with `git checkout src/_data && git clean -fd src/assets/img/uploads -e .gitkeep`, and stop both servers.

- [ ] **Step 7: Run parity again and commit**

```bash
npm run parity
git add src/admin src/assets/img/uploads/.gitkeep tests/cms-config.test.js
git commit -m "feat: Decap CMS admin with collections for every editable section

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: GitHub, Netlify and DecapBridge (go live)

**Files:**
- Modify: `src/admin/config.yml` (`backend:` block)

This task has steps the user does in web dashboards. Stop and hand over at each **[USER]** step, and continue when they confirm.

- [ ] **Step 1: Create the private repo and push**

```bash
gh repo create abdulsalamtoyin/imaobongodutola-website --private --source . --remote origin --push
git remote -v    # must show imaobongodutola-website, NOT journey-to-discovery
```

- [ ] **Step 2: [USER] Link the Netlify site to the repo**

Open https://app.netlify.com, go to the site **imaobongodutola**, then Site configuration → Build & deploy → Continuous deployment → **Link repository** → GitHub → authorise → pick `abdulsalamtoyin/imaobongodutola-website`, branch `main`. Leave the build settings blank, because `netlify.toml` provides them.

- [ ] **Step 3: Verify the first Git deploy matches the baseline**

```bash
netlify api listSiteDeploys --data '{"site_id":"e596e26e-bfec-44e5-a833-05244b78ba72","per_page":1}' | python3 -c "import json,sys;d=json.load(sys.stdin)[0];print(d['state'],d['branch'],d['commit_ref'])"
mkdir -p /tmp/live && for p in index about messages coaching store speaking gallery; do curl -s https://imaobongodutola.com/$p.html -o /tmp/live/$p.html; done
python3 -I scripts/parity.py tests/baseline /tmp/live
```
Expected: `ready main <sha>` and seven `ok`. Also confirm `curl -sI https://imaobongodutola.com/admin/` returns 200.

- [ ] **Step 4: [USER] DecapBridge**

1. Sign up at https://decapbridge.com (free) with your email.
2. Add a site. It asks for the GitHub repo (`abdulsalamtoyin/imaobongodutola-website`), a GitHub fine-grained token for that repo only (permissions: Contents read/write, Pull requests read/write, Metadata read), and the CMS URL `https://imaobongodutola.com/admin/`.
3. Copy the `backend:` config block it shows and paste it here.
4. Invite collaborator: `doctorimaobong@gmail.com`.

- [ ] **Step 5: Paste DecapBridge's backend into `src/admin/config.yml`**

Replace the placeholder `backend:` block (both lines under the comment) with the exact block DecapBridge provided. It will look like:

```yaml
backend:
  name: git-gateway
  repo: abdulsalamtoyin/imaobongodutola-website
  branch: main
  identity_url: https://auth.decapbridge.com/sites/<site-id-from-decapbridge>
  gateway_url: https://gateway.decapbridge.com
```
Keep `local_backend: true` for local editing. Run `npm test`, then commit and push:

```bash
git add src/admin/config.yml
git commit -m "feat: DecapBridge login for the CMS

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push
```

- [ ] **Step 6: [USER] Log in once yourself** at https://imaobongodutola.com/admin/ using the DecapBridge account, and confirm the six sections load.

---

### Task 11: End-to-end check, handover guide, README

**Files:**
- Create: `docs/guide/index.html`, `docs/guide/How-to-update-your-website.pdf`, `docs/guide/img/*.png`
- Modify: `README.md`

- [ ] **Step 1: Live end-to-end run as the editor** (logged in at `/admin/`). Do each step, Publish, wait for the Netlify deploy, then check the live page:

| Action | Check on imaobongodutola.com |
|---|---|
| Messages: add "E2E test" with `https://www.youtube.com/watch?v=Henup4p2Z2M&si=x` at the top | It's first on `messages.html` and first on the homepage, and the video plays |
| Gallery: upload a ~5 MB phone photo, category Crusades, drag it to the top | It appears first on `gallery.html`, filters under Crusades, the lightbox opens a 1600px JPEG, and the grid image is 700px |
| Books: change a tagline | The new tagline shows on `store.html` |
| Testimonies: add one with name + city | The card shows "Name, City", there are 2 placeholders, and the "Needed from Imaobong" box is gone |
| Contact: change the email to a test address | The footer on all pages and the coaching button use it |

Repeat one edit from a phone-width browser (390px). Also check that a Draft (Save without Publish) does not change the live site.

- [ ] **Step 2: Revert every test edit and confirm parity again**

```bash
git pull
git log --oneline -12            # identify the CMS test commits
git revert --no-edit <sha-of-each-test-commit>
git push
# after deploy:
for p in index about messages coaching store speaking gallery; do curl -s https://imaobongodutola.com/$p.html -o /tmp/live/$p.html; done
python3 -I scripts/parity.py tests/baseline /tmp/live
```
Expected: seven `ok`.

- [ ] **Step 3: Forms still work.** Submit the homepage testimony form once with test values, and confirm it appears in Netlify → Forms → `testimony`. Then delete it there.

- [ ] **Step 4: Write `docs/guide/index.html`**, a single page for Imaobong in plain language with a screenshot for each step (taken with Playwright at 1280px and 390px, saved in `docs/guide/img/`). Sections:
1. Logging in (`imaobongodutola.com/admin`, email + password, "Forgot password").
2. Adding a new message (paste the YouTube Share link, choose a thumbnail, title, paragraphs, Save → Publish).
3. Adding gallery photos (upload, describe, choose a category, drag to reorder, **choose "Most Compatible" on iPhone if a photo won't upload**).
4. Changing a book or featuring one on the homepage.
5. Adding a testimony.
6. Changing homepage text, the homepage photo strip, email and socials.
7. Drafts vs Publish, and the fact that changes appear in about 1 minute.
8. "Something looks wrong": contact Toyin, since every change can be undone.

Print it to `docs/guide/How-to-update-your-website.pdf` (Playwright `page.pdf`, A4).

- [ ] **Step 5: Rewrite `README.md`**

Keep the design-system, media, accessibility and "still needed" sections as they are. Replace "Viewing it locally" and "Deploying", and update "Structure", "Changing the contact email" and the trailing-space note:
- **Run locally:** `npm install`, `npm run serve`, then open http://localhost:8080. To edit with the CMS locally, also run `npx decap-server` and open `/admin/`.
- **Deploying:** push to `main`. Netlify builds with `npm run build` and publishes `_site/`. Drag-and-drop deploys are no longer used.
- **Content:** `src/_data/*.json`, edited by the CMS at `/admin/` (Decap CMS, logging in through DecapBridge). Uploads go to `src/assets/img/uploads/` and are resized at build time to `assets/img/generated/`.
- **Changing the contact email:** use CMS → Contact & socials. Still update Netlify → Forms → Notifications.
- **Tests:** `npm test` runs the unit and render tests. `npm run parity` compares against `tests/baseline/`, which only applies until real content changes. The `tests/baseline` files are a frozen record of the launch site.
- Remove the trailing-space warning, since the folder has been renamed.

- [ ] **Step 6: Commit and push**

```bash
git add README.md docs/guide
git commit -m "docs: editor guide for Imaobong; README for the CMS workflow

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push
```

- [ ] **Step 7: Hand over.** Send the PDF guide to Imaobong, and confirm she accepted the DecapBridge invite and can log in.
