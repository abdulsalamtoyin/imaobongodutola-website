/* Preview markup for the CMS editor. Each function mirrors the matching
 * section of the real page (see the .njk named beside it) so the preview pane
 * looks like the live site. Loaded by the browser (window.PreviewRender) and
 * by tests/admin-preview.test.js (module.exports). */
(function (root) {
  "use strict";

  var BARE_ID = /^[\w-]{11}$/;
  var IN_URL = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})(?![\w-])/;

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function blank(s) { return s == null || String(s).trim() === ""; }
  function list(x) { return Array.isArray(x) ? x : []; }
  // Existing gallery photos have a ready-made thumbnail beside the full image.
  function thumb(src) { return String(src || "").replace("/gallery/full/", "/gallery/thumb/"); }
  function img(asset, src, alt, extra) {
    if (blank(src)) return '<div class="pv-missing">No photo yet</div>';
    return '<img src="' + escape(asset(src)) + '" alt="' + escape(alt || "") + '"' + (extra || "") + ">";
  }
  function note(text) { return '<div class="pv-note">' + escape(text) + "</div>"; }
  function shell(inner, cls) {
    return '<section class="section' + (cls ? " " + cls : "") + '"><div class="shell">' + inner + "</div></section>";
  }
  function youtubeOk(input) {
    var s = String(input || "").trim();
    return BARE_ID.test(s) || IN_URL.test(s);
  }

  // messages.njk
  function messageCard(m, asset, full) {
    var paras = list(m.paragraphs).filter(function (p) { return !blank(p); });
    if (!full) paras = paras.slice(0, 1);
    return '<article class="message"><div class="yt">' +
      img(asset, m.thumbnail, "Dr. Imaobong Odutola preaching") +
      '<span class="yt__play" aria-hidden="true"></span></div><div>' +
      (full && !blank(m.subtitle) ? '<span class="eyebrow">' + escape(m.subtitle) + "</span>" : "") +
      "<h3>" + escape(m.title) + "</h3>" +
      paras.map(function (p) { return "<p>" + escape(p) + "</p>"; }).join("\n") +
      (youtubeOk(m.youtube) ? "" : '<p class="pv-error">⚠ This is not a YouTube link yet — paste the link from YouTube’s Share button.</p>') +
      "</div></article>";
  }
  function messages(data, asset) {
    var items = list(data && data.items);
    return note("Messages page — the first two also appear on the homepage") +
      shell('<div class="messages">' + items.map(function (m) { return messageCard(m || {}, asset, true); }).join("") + "</div>");
  }

  // gallery.njk
  function galleryGrid(srcs, asset) {
    return '<div class="gallery">' + srcs.map(function (g) {
      return '<div class="gallery__item">' + img(asset, thumb(g.image), g.alt) + "</div>";
    }).join("") + "</div>";
  }
  function gallery(data, asset) {
    var items = list(data && data.items).map(function (g) { return g || {}; });
    return note("Gallery page — " + items.length + " photos, in this order") + shell(galleryGrid(items, asset));
  }

  // store.njk + the featured-book section of index.njk
  function books(data, asset) {
    var items = list(data && data.items).map(function (b) { return b || {}; });
    var fb = items.filter(function (b) { return b.featured; })[0] || items[0];
    var out = "";
    if (fb) {
      out += note("Homepage — featured book") + shell(
        '<div class="book-feature"><div><span class="eyebrow">Featured book</span>' +
        '<h2 style="font-size:var(--t-h2);margin-bottom:1.25rem">' + escape(fb.title) + "</h2>" +
        '<p class="lead">' + escape(blank(fb.feature_lead) ? fb.tagline : fb.feature_lead) + "</p>" +
        "<p>" + escape(blank(fb.feature_blurb) ? fb.description : fb.feature_blurb) + "</p>" +
        '<div class="btn-row"><span class="btn">Buy on Selar</span><span class="btn btn--ghost">All books</span></div></div>' +
        '<div class="book-cover book-cover--image">' + img(asset, fb.cover, fb.cover_alt, ' width="640"') + "</div></div>");
    }
    out += note("Store page") + shell('<div class="books-grid">' + items.map(function (b) {
      return '<article class="book-card"><div class="book-cover book-cover--image">' +
        img(asset, b.cover, b.cover_alt, ' width="640"') + "</div><h3>" + escape(b.title) + "</h3>" +
        (blank(b.tagline) ? "" : '<p style="color:var(--brass);font-weight:600;margin-bottom:0.6rem">' + escape(b.tagline) + "</p>") +
        "<p>" + escape(b.description) + '</p><div class="btn-row" style="margin-top:1.25rem"><span class="btn">Buy on Selar</span></div></article>';
    }).join("") + "</div>");
    return out;
  }

  // testimonies section of index.njk
  function testimonies(data, asset) {
    var filled = list(data && data.items).filter(function (t) { return t && !blank(t.quote); });
    var cards = filled.map(function (t) {
      return '<figure class="testimonial"><blockquote>' + escape(t.quote) + "</blockquote><figcaption>" +
        escape(blank(t.city) ? t.name : t.name + ", " + t.city) + "</figcaption></figure>";
    });
    for (var i = filled.length; i < 3; i++) {
      cards.push('<figure class="testimonial testimonial--empty"><blockquote>Testimony to come</blockquote>' +
        '<figcaption><span class="testimonial__note">Awaiting her words</span></figcaption></figure>');
    }
    return note("Homepage — testimonies") +
      shell('<div class="testify"><div class="testify__list">' + cards.join("") + "</div></div>", "section--band");
  }

  function rail(eyebrow, heading, lead) {
    return '<div class="rail" style="margin-bottom:2.5rem"><span class="eyebrow">' + escape(eyebrow) + "</span><div>" +
      '<h2 style="font-size:var(--t-h2)">' + escape(heading) + "</h2>" +
      (lead === undefined ? "" : '<p class="lead">' + escape(lead) + "</p>") + "</div></div>";
  }
  function band(bg, inner) {
    return '<section class="band"><img class="band__bg" src="/' + bg + '" alt=""><div class="band__inner"><div class="shell">' +
      inner + "</div></div></section>";
  }

  // index.njk, in page order
  function home(d, asset) {
    d = d || {};
    var strip = list(d.gallery_strip).filter(function (s) { return !blank(s); }).map(function (s) { return { image: s, alt: "From the gatherings" }; });
    return note("Homepage — in page order") +
      band("assets/video/hero-07.jpg",
        '<p class="hero__eyebrow">' + escape(d.hero_eyebrow) + '</p><h1 class="hero__title">Dr.&nbsp;Imaobong Odutola</h1>' +
        '<blockquote class="hero__quote">' + escape(d.hero_quote) + "</blockquote>") +
      shell('<div class="split__body"><span class="eyebrow">About</span><h2>' + escape(d.about_heading) + '</h2><p class="lead">' +
        escape(d.about_lead) + "</p></div>", "section--band") +
      shell(rail("Messages", d.messages_heading) + '<p class="pv-hint">Your two newest messages appear here.</p>') +
      band("assets/img/feature/band-cross.jpg",
        '<span class="eyebrow">Coaching</span><h2>' + escape(d.coaching_heading) + '</h2><p class="lead">' + escape(d.coaching_lead) + "</p>") +
      (strip.length ? shell(rail("Gallery", d.gallery_heading) + galleryGrid(strip, asset)) :
        note("The homepage gallery section is hidden while the strip has no photos.")) +
      shell(rail("Testimonies", d.testimonies_heading, d.testimonies_lead), "section--band");
  }

  var ICONS = {
    Instagram: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 5.68a4.16 4.16 0 100 8.32 4.16 4.16 0 000-8.32zm0 6.86a2.7 2.7 0 110-5.4 2.7 2.7 0 010 5.4zm5.3-7.02a.97.97 0 11-1.94 0 .97.97 0 011.94 0z",
    Facebook: "M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.55-.14-2.84-.14C12 2 10.5 3.66 10.5 6.7v2.8H8v4h2.5V22H14z",
    TikTok: "M16.6 5.82A4.28 4.28 0 0115.54 3h-3.09v12.4a2.59 2.59 0 01-2.59 2.5 2.59 2.59 0 110-5.18c.27 0 .52.04.76.12v-3.2a5.9 5.9 0 00-.76-.05 5.79 5.79 0 105.79 5.79V9.01a7.35 7.35 0 004.31 1.38V7.3a4.28 4.28 0 01-3.4-1.48z",
    YouTube: "M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z",
  };

  // _includes/footer.njk
  function contact(d, asset) {
    d = d || {};
    var socials = [["Instagram", d.instagram], ["Facebook", d.facebook], ["TikTok", d.tiktok], ["YouTube", d.youtube]]
      .filter(function (s) { return !blank(s[1]); })
      .map(function (s) {
        return '<a href="' + escape(s[1]) + '" target="_blank" rel="noopener" aria-label="' + s[0] +
          '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[s[0]] + '"/></svg></a>';
      }).join("");
    return note("Footer — shown at the bottom of every page") +
      '<footer class="footer"><div class="shell"><div class="footer__top"><div class="footer__logo">' +
      '<img src="/assets/brand/logo.png" alt="Imaobong Odutola"></div><div><h4>Connect</h4><ul>' +
      '<li><a href="mailto:' + escape(d.email) + '">' + escape(d.email) + "</a></li></ul></div></div>" +
      '<div class="footer__bottom"><span>&copy; 2026 Dr. Imaobong Odutola. All rights reserved.</span>' +
      '<div class="socials">' + socials + "</div></div></div></footer>";
  }

  // Decap only knows files in the uploads folder (fresh ones come back as
  // blob: URLs); every other image already lives on the site.
  function resolver(getAsset) {
    return function (path) {
      var p = String(path || "");
      var url = p.indexOf("assets/img/uploads/") === 0 ? String(getAsset(p) || p) : p;
      return /^(blob:|data:|https?:|\/)/.test(url) ? url : "/" + url;
    };
  }

  var api = { escape: escape, resolver: resolver, messages: messages, gallery: gallery, books: books, testimonies: testimonies, home: home, contact: contact };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PreviewRender = api;
})(this);
