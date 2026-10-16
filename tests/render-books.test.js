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
