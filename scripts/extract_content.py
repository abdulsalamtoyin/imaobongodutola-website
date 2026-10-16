"""One-time: pull today's content out of the baseline HTML into src/_data/*.json."""
import html
import json
import re
import sys
from pathlib import Path

base, out = Path(sys.argv[1]), Path(sys.argv[2])


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


page = (base / "messages.html").read_text(encoding="utf-8")
messages = []
for art in re.findall(r'<article class="message".*?</article>', page, re.S):
    sub = re.search(r'<span class="eyebrow">(.*?)</span>', art, re.S)
    messages.append({
        "youtube": "https://youtu.be/" + re.search(r'data-yt="([^"]+)"', art).group(1),
        "thumbnail": re.search(r'<img src="([^"]+)"', art).group(1),
        "subtitle": clean(sub.group(1)) if sub else "",
        "title": clean(re.search(r"<h3>(.*?)</h3>", art, re.S).group(1)),
        "paragraphs": [clean(p) for p in re.findall(r"<p>(.*?)</p>", art, re.S)],
    })
write("messages.json", {"items": messages})

page = (base / "gallery.html").read_text(encoding="utf-8")
gallery = [
    {"image": full, "alt": html.unescape(alt), "category": cat}
    for cat, full, alt in re.findall(
        r'data-cat="([^"]+)" data-full="([^"]+)"><img src="[^"]+" alt="([^"]*)"', page)
]
write("gallery.json", {"items": gallery})

page = (base / "store.html").read_text(encoding="utf-8")
books = []
for card in re.findall(r'<article class="book-card".*?</article>', page, re.S):
    cover, alt = re.search(r'<img src="([^"]+)" alt="([^"]*)"', card).groups()
    ps = re.findall(r"<p[^>]*>(.*?)</p>", card, re.S)
    books.append({
        "cover": cover, "cover_alt": html.unescape(alt),
        "title": clean(re.search(r"<h3>(.*?)</h3>", card, re.S).group(1)),
        "tagline": clean(ps[0]), "description": clean(ps[1]),
        "selar_url": re.search(r'href="(https://selar[^"]+)"', card).group(1),
        "featured": False, "feature_lead": "", "feature_blurb": "",
    })
index = (base / "index.html").read_text(encoding="utf-8")
feat = re.search(r'<div class="book-feature".*?</section>', index, re.S).group(0)
feat_title = clean(re.search(r"<h2[^>]*>(.*?)</h2>", feat, re.S).group(1))
feat_ps = re.findall(r"<p[^>]*>(.*?)</p>", feat, re.S)
for b in books:
    if b["title"] == feat_title:
        b.update(featured=True, feature_lead=clean(feat_ps[0]), feature_blurb=clean(feat_ps[1]))
write("books.json", {"items": books})

strip = re.findall(r'gallery/thumb/(g\d+\.jpg)" alt="From the gatherings"', index)
write("home.json", {
    "hero_eyebrow": "Apostle · Medical Doctor · Purpose Coach · Author",
    "hero_quote": "Life becomes truly meaningful when you discover your purpose in Christ and fully surrender to His divine will.",
    "about_heading": "An ambassador of Jesus Christ",
    "about_lead": "A trained Medical Doctor, called to be an Apostle of Jesus Christ, who has devoted her life to raising disciples for the Kingdom of God.",
    "messages_heading": "Teaching that awakens",
    "coaching_heading": "Discover and fulfil your purpose in Christ",
    "coaching_lead": "As a certified Purpose Coach, Dr. Imaobong has guided countless individuals into discovering their God-given identity, unlocking hidden potential, and aligning their lives with Heaven’s agenda.",
    "gallery_heading": "From the gatherings",
    "gallery_strip": ["assets/img/gallery/full/" + f for f in strip],
    "testimonies_heading": "What the Lord has done",
    "testimonies_lead": "Testimonies from believers who have encountered God through these gatherings — and room for you to add yours.",
})
write("testimonies.json", {"items": []})
write("contact.json", {
    "email": "doctorimaobong@gmail.com",
    "instagram": "https://www.instagram.com/imaobongodutola/",
    "facebook": "https://www.facebook.com/imaobongodutolapage/",
    "tiktok": "https://www.tiktok.com/@pastorimaobongodutola",
    "youtube": "",
})
print(f"{len(messages)} messages, {len(gallery)} photos, {len(books)} books, strip {len(strip)}")
