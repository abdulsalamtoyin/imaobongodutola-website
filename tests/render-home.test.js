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
