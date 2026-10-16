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
