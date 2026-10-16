# Content editing for imaobongodutola.com — design

Date: 2026-10-16
Status: approved 2026-10-16 (revised: homepage strip is an ordered picker, not a per-photo flag)

## Goal

Let Dr. Imaobong Odutola update the parts of her website that change often —
messages, gallery photos, books, testimonies, homepage text, contact details —
from a browser or phone, with no developer, in the spirit of WordPress.

## Hard constraints

1. **The visitor-facing site does not change.** No new pages, no nav changes,
   no redesign. Built output must match today's HTML (whitespace aside).
2. **New, dedicated GitHub repo.** Nothing to do with `journey-to-discovery`
   (that remote belongs to a Desktop-level repo and is left untouched).
3. Stays on the existing Netlify site `imaobongodutola`
   (id `e596e26e-bfec-44e5-a833-05244b78ba72`); domain, HTTPS, and Netlify
   Forms are unchanged.
4. $0/month.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| What "posts" mean | New entries in existing sections (a new message, photo, book, testimony). No blog. |
| Editing scope | Frequently changing parts only (table below). Layout, About/Coaching/Speaking copy, hero videos stay fixed. |
| Approach | Static generator + git-based CMS: **Eleventy + Decap CMS** |
| Login | **DecapBridge** — email + password, no GitHub account for her |

## Architecture

```
Imaobong ──► imaobongodutola.com/admin   (Decap CMS, static files in site)
                  │ email + password via DecapBridge
                  ▼
            GitHub repo (new, private)    each Publish = a commit
                  │ push → Netlify build
                  ▼
            Netlify: `npx @11ty/eleventy` → _site/   (build fails → previous version stays live)
                  ▼
            imaobongodutola.com
```

### Repo layout

```
imaobongodutola-website/
├── .eleventy.js              # config: passthrough assets, image shortcode
├── netlify.toml              # build = "npx @11ty/eleventy", publish = "_site"
├── package.json              # @11ty/eleventy, @11ty/eleventy-img
├── src/
│   ├── _includes/            # shared head, nav, footer partials (verbatim from current HTML)
│   ├── _data/                # editable content — one JSON file per section
│   │   ├── messages.json
│   │   ├── gallery.json
│   │   ├── books.json
│   │   ├── testimonies.json
│   │   ├── home.json
│   │   └── contact.json
│   ├── index.njk  about.njk  messages.njk  coaching.njk
│   ├── store.njk  speaking.njk  gallery.njk
│   ├── admin/index.html      # loads Decap CMS from CDN
│   ├── admin/config.yml      # collections below
│   ├── assets/               # existing css/js/brand/video/img, unchanged
│   ├── assets/img/uploads/   # new: where CMS uploads land
│   └── robots.txt  sitemap.xml
└── README.md
```

Source originals (raw `Video *.mp4`, WhatsApp images, `site.zip`, `.docx`)
stay outside the repo via `.gitignore`.

Templates are the current HTML files with only the editable regions replaced by
Nunjucks loops/variables. Everything else is copied byte-for-byte.

## Editable content model

| CMS section | Drives | Fields | List? |
|---|---|---|---|
| **Messages** | `.message` cards on `messages.html` | `youtube` (URL or ID → `data-yt`), `thumbnail` image, `subtitle` (eyebrow), `title`, `body` (paragraphs) | add / remove / reorder |
| **Gallery** | `.gallery__item` grid on `gallery.html` | `image`, `alt` (required), `category` (select: conferences · crusades · ministry) | add / remove / reorder |
| **Books** | `.book-card` on `store.html`; `.book-feature` on home | `cover`, `cover_alt`, `title`, `tagline` (brass line), `description`, `selar_url`, `featured` (bool; first ticked wins, else first book), `feature_lead` + `feature_blurb` (homepage wording, fall back to tagline/description) | add / remove / reorder |
| **Testimonies** | `.testimonial` cards on home | `quote`, `name`, `city`. Fewer than 3 filled → remaining slots render today's `.testimonial--empty` placeholder | add / remove / reorder |
| **Homepage text** | hero eyebrow, hero quote, section headings + intro paragraphs on `index.html`; the 6-photo gallery strip | plain strings; `gallery_strip` = ordered list of photos | single |
| **Contact & socials** | footer on all 7 pages, coaching button, speaking hint | `email`, `instagram`, `facebook`, `tiktok`, `youtube` (optional; icon only renders when set) | single |

Initial JSON is extracted from the current HTML so the first build reproduces
the live site exactly.

### Images

- The gallery uses `thumb/` and `full/` variants. An Eleventy image shortcode
  (`@11ty/eleventy-img`) generates both from one upload, at the same widths
  and quality as today's files.
- Existing images keep their current paths; only new uploads go through the
  shortcode pipeline. This avoids re-encoding — and visually altering — today's
  photos.
- Decap `media_folder: src/assets/img/uploads`, `public_folder: /assets/img/uploads`.
  Uploads over 8 MB are rejected in the CMS (`media_library.config.max_file_size`).

## Editor experience

- `/admin` — Decap CMS with the six sections above.
- `publish_mode: editorial_workflow` → Draft → Ready → Publish, with preview.
- Required fields enforced (gallery `alt`, message `youtube` + `title`,
  book `title` + `selar_url`).
- Works on mobile browsers.

## Setup steps (who does what)

| Step | Who |
|---|---|
| Create private GitHub repo `imaobongodutola-website` (via `gh`) | Claude (needs `gh auth` working) |
| Restructure project into Eleventy, extract content to JSON, add CMS | Claude |
| Parity check vs. snapshot, commit, push | Claude |
| Link Netlify site to repo (Site config → Build & deploy → Link repository) | User, in Netlify dashboard |
| Sign up at DecapBridge, connect repo, invite `doctorimaobong@gmail.com` | User (Claude guides) |
| One-page "How to update your website" guide with screenshots | Claude |

## Safety

- Every publish is a git commit → any change can be reverted.
- Failed Netlify build → last good deploy stays live.
- Netlify Forms keep working: `data-netlify` attributes are carried through the
  templates untouched, and Netlify still detects them in the built HTML.

## Testing / acceptance

1. **Parity:** snapshot current `site/*.html` before restructuring; after build,
   diff `_site/*.html` against it with whitespace ignored → zero differences.
   Screenshot all 7 pages before/after at desktop and 390px widths.
2. **Assets:** every `src`/`href`/`data-src`/`data-full` in built HTML resolves.
3. **End-to-end as editor:** log in via DecapBridge; add a message, add + reorder
   a gallery photo (check thumb/full generated), edit a book, fill a testimony,
   change the email; publish; confirm each is live on imaobongodutola.com;
   then revert the test commits.
4. **Forms:** submit one test form after the switch; confirm it appears in
   Netlify Forms.
5. **Mobile:** complete one edit from a phone-width browser.

## Out of scope

Blog/posts pages, comments, search, tags, scheduled publishing, editing
About/Coaching/Speaking copy, swapping hero videos, newsletter.

## Risks

- **DecapBridge** is a third-party free service. If it disappears, fallback is
  GitHub login (Decap `github` backend) — content and templates are unaffected.
- **Git as image store:** fine for hundreds of photos; revisit (Netlify Large
  Media / Cloudinary) only if the repo grows past ~1 GB.
