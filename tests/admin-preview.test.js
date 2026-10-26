const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../src/admin/preview-render.js");

const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/assets/css/style.css"), "utf8");
const page = (f) => fs.readFileSync(path.join(ROOT, "src", f), "utf8");
const asset = (p) => "/" + p;

// Each preview must use the same classes as the real page section, and those
// classes must still exist in the template and the stylesheet.
function assertMirrors(html, classes, template) {
  for (const c of classes) {
    assert.ok(html.includes(c), `preview lacks .${c}`);
    assert.ok(page(template).includes(c), `${template} no longer uses .${c}`);
    assert.ok(css.includes("." + c), `style.css has no .${c}`);
  }
  assert.ok(!html.includes("data-reveal"), "data-reveal would hide preview content");
}

test("messages preview mirrors the Messages page cards", () => {
  const html = R.messages({ items: [{ youtube: "https://youtu.be/abcdefghijk", thumbnail: "assets/img/uploads/t.jpg", subtitle: "Sunday", title: "Grace", paragraphs: ["One", "Two"] }] }, asset);
  assertMirrors(html, ["messages", "message", "yt", "yt__play", "eyebrow"], "messages.njk");
  assert.match(html, /src="\/assets\/img\/uploads\/t\.jpg"/);
  assert.match(html, /<p>One<\/p>\s*<p>Two<\/p>/);
});

test("messages preview flags a link the build would reject", () => {
  const html = R.messages({ items: [{ youtube: "not a link", title: "X", paragraphs: [] }] }, asset);
  assert.match(html, /not a YouTube link/i);
});

test("gallery preview mirrors the grid and maps old full photos to thumbnails", () => {
  const html = R.gallery({ items: [{ image: "assets/img/gallery/full/g03.jpg", alt: "Altar call", category: "crusades" }] }, asset);
  assertMirrors(html, ["gallery", "gallery__item"], "gallery.njk");
  assert.match(html, /src="\/assets\/img\/gallery\/thumb\/g03\.jpg"/);
  assert.match(html, /alt="Altar call"/);
});

test("books preview shows store cards and the featured book with fallbacks", () => {
  const html = R.books({ items: [
    { cover: "c1.jpg", title: "First", tagline: "Tag1", description: "D1", selar_url: "https://s/1" },
    { cover: "c2.jpg", title: "Second", tagline: "Tag2", description: "D2", selar_url: "https://s/2", featured: true },
  ] }, asset);
  assertMirrors(html, ["books-grid", "book-card", "book-cover"], "store.njk");
  assertMirrors(html, ["book-feature"], "index.njk");
  const feature = html.slice(html.indexOf("book-feature"));
  assert.match(feature, /Second/);
  assert.match(feature, /Tag2/); // feature_lead falls back to tagline
});

test("testimonies preview fills empty slots with placeholders", () => {
  const html = R.testimonies({ items: [{ quote: "Healed", name: "Ada", city: "Lagos" }, { quote: "  ", name: "Blank" }] }, asset);
  assertMirrors(html, ["testimonial", "testimonial--empty"], "index.njk");
  assert.match(html, /Ada, Lagos/);
  assert.equal((html.match(/testimonial--empty/g) || []).length, 2);
});

test("homepage preview shows every text field and the strip photos", () => {
  const home = JSON.parse(page("_data/home.json"));
  const html = R.home(home, asset);
  for (const k of Object.keys(home).filter((k) => k !== "gallery_strip")) {
    assert.ok(html.includes(R.escape(home[k])), `homepage preview lacks ${k}`);
  }
  assert.equal((html.match(/gallery\/thumb\//g) || []).length, 6);
  assertMirrors(html, ["hero__eyebrow", "rail", "band", "gallery__item"], "index.njk");
});

test("contact preview renders the footer and hides empty socials", () => {
  const html = R.contact({ email: "a@b.co", instagram: "https://i/x", facebook: "", tiktok: "", youtube: "" }, asset);
  assertMirrors(html, ["footer", "socials"], "_includes/footer.njk");
  assert.match(html, /mailto:a@b\.co/);
  assert.match(html, /aria-label="Instagram"/);
  assert.doesNotMatch(html, /aria-label="Facebook"/);
});

test("everything typed is escaped", () => {
  const html = R.testimonies({ items: [{ quote: "<script>x</script>", name: "\"A\"" }] }, asset);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("preview tolerates a brand-new empty entry", () => {
  for (const k of ["messages", "gallery", "books", "testimonies"]) assert.equal(typeof R[k]({}, asset), "string");
  assert.equal(typeof R.home({}, asset), "string");
  assert.equal(typeof R.contact({}, asset), "string");
});

test("asset resolver only asks Decap about uploads; existing site images load directly", () => {
  const asked = [];
  const resolve = R.resolver((p) => { asked.push(p); return p.includes("new.jpg") ? "blob:http://x/1" : p; });
  assert.equal(resolve("assets/img/gallery/thumb/g03.jpg"), "/assets/img/gallery/thumb/g03.jpg");
  assert.equal(resolve("assets/img/uploads/new.jpg"), "blob:http://x/1");
  assert.equal(resolve("assets/img/uploads/old.jpg"), "/assets/img/uploads/old.jpg");
  assert.deepEqual(asked, ["assets/img/uploads/new.jpg", "assets/img/uploads/old.jpg"]);
});
