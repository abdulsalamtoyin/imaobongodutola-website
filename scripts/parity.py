"""Compare built HTML to the baseline at token level.

Whitespace runs collapse to one space, entities are decoded and attribute
order is ignored, so `&middot;` == `·` and re-indented markup still matches.
Comments are ignored. Anything else that differs is a visible change.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


class Tokens(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def handle_starttag(self, tag, attrs):
        self.out.append(("start", tag, tuple(sorted((k, norm(v or "")) for k, v in attrs))))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        self.out.append(("end", tag))

    def handle_data(self, data):
        t = norm(data)
        if t:
            self.out.append(("text", t))


def tokens(path):
    p = Tokens()
    p.feed(Path(path).read_text(encoding="utf-8"))
    return p.out


def main(baseline_dir, built_dir):
    failed = False
    for base in sorted(Path(baseline_dir).glob("*.html")):
        built = Path(built_dir) / base.name
        if not built.exists():
            print(f"MISSING {built}")
            failed = True
            continue
        a, b = tokens(base), tokens(built)
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                print(f"DIFF {base.name} token {i}\n  expected: {x}\n  actual:   {y}")
                failed = True
                break
        else:
            if len(a) != len(b):
                print(f"DIFF {base.name}: {len(a)} tokens expected, {len(b)} built")
                failed = True
            else:
                print(f"ok   {base.name}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
