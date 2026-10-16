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

test("an image failure names the item it belongs to", async () => {
  const missing = "assets/img/uploads/does-not-exist.jpg";
  await assert.rejects(buildView(raw({ gallery: [{ image: missing, alt: "Crusade night", category: "crusades" }] })), /Gallery photo "Crusade night"/);
  await assert.rejects(buildView(raw({ books: [{ cover: missing, title: "New Book", selar_url: "https://x" }] })), /Book "New Book"/);
  await assert.rejects(buildView(raw({ messages: [{ youtube: "2xz-IM-QyTA", thumbnail: missing, title: "Grace", paragraphs: [] }] })), /Message "Grace"/);
  await assert.rejects(buildView(raw({ home: { gallery_strip: [missing] } })), /Homepage strip photo 1/);
});
