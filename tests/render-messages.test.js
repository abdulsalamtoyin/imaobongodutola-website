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
