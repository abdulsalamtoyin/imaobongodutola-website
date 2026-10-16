"""Fail if any local src/href/poster/data-src/data-full in built HTML is missing."""
import sys
from html.parser import HTMLParser
from pathlib import Path

ATTRS = {"src", "href", "poster", "data-src", "data-full"}
SKIP = ("http:", "https:", "mailto:", "tel:", "#", "data:", "//")


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ATTRS and v and not v.startswith(SKIP):
                self.refs.append(v.split("#")[0].split("?")[0])


def main(site):
    root = Path(site)
    missing = []
    for page in sorted(root.glob("*.html")):
        p = Refs()
        p.feed(page.read_text(encoding="utf-8"))
        for ref in p.refs:
            if ref and not (root / ref.lstrip("/")).exists():
                missing.append(f"{page.name}: {ref}")
    print("\n".join(missing) or "all local references resolve")
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main(sys.argv[1])
