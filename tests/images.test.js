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

test("transparent PNGs get a white background, not black", async () => {
  const s = sandbox();
  await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(path.join(s.dir, "src/assets/img/uploads/cutout.png"));
  const url = await resize("assets/img/uploads/cutout.png", 700, s.opts);
  const { data } = await sharp(path.join(s.dir, "_site", url)).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 245 && data[1] > 245 && data[2] > 245, `first pixel ${data[0]},${data[1]},${data[2]}`);
});

test("an image that can't be processed names the file", async () => {
  const s = sandbox();
  fs.writeFileSync(path.join(s.dir, "src/assets/img/uploads/broken.jpg"), "not an image");
  await assert.rejects(resize("assets/img/uploads/broken.jpg", 700, s.opts), /Image "assets\/img\/uploads\/broken\.jpg" could not be processed/);
});
