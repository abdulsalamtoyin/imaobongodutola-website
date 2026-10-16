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
