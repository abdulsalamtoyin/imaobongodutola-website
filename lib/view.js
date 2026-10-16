const { youtubeId } = require("./youtube");
const { resize, galleryVariants } = require("./images");

const nonBlank = (s) => typeof s === "string" && s.trim() !== "";

// Prefix any failure with the item it came from, so a build log points at the right entry.
async function labelled(label, fn) {
  try { return await fn(); } catch (e) { throw new Error(`${label}: ${e.message}`); }
}

async function buildView({ messages = [], gallery = [], books = [], testimonies = [], home = {} }, opts) {
  const msgs = await Promise.all(messages.map(async (m) => {
    const label = `Message "${m.title}"`;
    return {
      youtubeId: await labelled(label, () => youtubeId(m.youtube)),
      thumbnail: await labelled(label, () => resize(m.thumbnail, 1200, opts)),
      subtitle: m.subtitle || "",
      title: m.title,
      paragraphs: (m.paragraphs || []).filter(nonBlank),
    };
  }));

  const photos = await Promise.all(gallery.map(async (g) => ({
    ...(await labelled(`Gallery photo "${g.alt}"`, () => galleryVariants(g.image, opts))), alt: g.alt, category: g.category,
  })));

  const strip = await Promise.all((home.gallery_strip || []).filter(nonBlank).map(async (src, i) => ({
    thumb: (await labelled(`Homepage strip photo ${i + 1}`, () => galleryVariants(src, opts))).thumb,
  })));

  const bookViews = await Promise.all(books.map(async (b) => ({
    ...b, cover: await labelled(`Book "${b.title}"`, () => resize(b.cover, 800, opts)),
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
