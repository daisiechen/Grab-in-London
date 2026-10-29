"""Build the public legal pages (fancyabite.uk/privacy, /terms, /guidelines, /support).

Source of truth: the English drafts in docs/policies/*.draft.en.md. This script converts them
(a small Markdown subset: headings, paragraphs, lists, tables, bold, links, one leading
blockquote banner) into static, dependency-free HTML under apps/web/public/<slug>/index.html, which
Vite copies into the web build so they are served beside the web app on the same origin.

    python3 scripts/build_legal_pages.py          # write the pages
    python3 scripts/build_legal_pages.py --check  # exit 1 if a page is out of date

While a draft still carries its "pending review" banner, the page carries the banner too and asks
search engines not to index it.
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/policies'
PUBLIC = ROOT / 'apps/web/public'
ICON_SOURCE = ROOT / 'apps/ios/assets/brand/app-icon.svg'

# slug -> (source file, navigation label)
PAGES = {
    'privacy': ('privacy-notice.draft.en.md', 'Privacy'),
    'terms': ('terms-of-use.draft.en.md', 'Terms'),
    'guidelines': ('community-guidelines.draft.en.md', 'Guidelines'),
    'support': ('support.draft.en.md', 'Support'),
}
SOURCE_TO_PATH = {source: f'/{slug}' for slug, (source, _) in PAGES.items()}
DESCRIPTIONS = {
    'privacy': 'How Fancy collects, uses and protects personal information.',
    'terms': 'The terms for using Fancy, the app for meeting new people over a meal in London.',
    'guidelines': 'How to be a great Fancy host and guest, and what is not allowed.',
    'support': 'How to contact Fancy, report a problem or manage your account.',
}

CSS = """:root {
  color-scheme: light;
  --forest: #123f35;
  --ink: #10241f;
  --muted: #55625a;
  --line: #e4e7e2;
  --surface: #f5f6f1;
  --paper: #fbf8f0;
  --citrus: #d7ee79;
  --vermilion: #e96943;
  --note: #fff4d6;
  --note-line: #e8c770;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
a { color: var(--forest); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:focus-visible, .skip:focus { outline: 3px solid var(--vermilion); outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 8px; background: #fff; padding: 8px 12px; border-radius: 8px; }
.skip:focus { left: 16px; }
.wrap { max-width: 760px; margin: 0 auto; padding: 0 16px; }
header.site { background: var(--forest); color: #fff; }
header.site .wrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; padding-top: 14px; padding-bottom: 14px; }
.brand { display: inline-flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font-weight: 900; font-size: 24px; letter-spacing: -1px; }
.brand img { width: 36px; height: 36px; border-radius: 9px; }
nav ul { display: flex; flex-wrap: wrap; gap: 4px 16px; list-style: none; margin: 0; padding: 0; }
nav a { color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 6px 0; display: inline-block; border-bottom: 2px solid transparent; }
nav a[aria-current="page"] { border-bottom-color: var(--citrus); }
main { padding: 28px 0 48px; }
h1 { font-size: 34px; line-height: 1.15; letter-spacing: -1px; margin: 8px 0 12px; color: var(--forest); }
h2 { font-size: 22px; line-height: 1.25; margin: 36px 0 10px; color: var(--forest); }
h3 { font-size: 18px; margin: 26px 0 8px; }
p, ul { margin: 0 0 14px; }
ul { padding-left: 22px; }
li { margin: 4px 0; }
.draft { background: var(--note); border: 1px solid var(--note-line); border-radius: 12px; padding: 12px 16px; margin: 12px 0 20px; font-size: 15px; }
.draft p { margin: 0; }
.placeholder { background: #ffe3d8; border-radius: 4px; padding: 0 3px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
.table { overflow-x: auto; margin: 0 0 18px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }
th { background: var(--surface); font-weight: 700; }
tr:last-child td { border-bottom: 0; }
footer.site { border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer.site .wrap { padding-top: 18px; padding-bottom: 28px; }
footer.site p { margin: 0 0 6px; }
@media (max-width: 520px) {
  h1 { font-size: 28px; }
  th, td { padding: 8px 10px; }
}
@media print {
  header.site, footer.site nav, .skip { display: none; }
  body { background: #fff; }
}
"""


def slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def inline(text: str) -> str:
    out = html.escape(text, quote=False)

    def link(match: re.Match[str]) -> str:
        label, target = match.group(1), match.group(2)
        if target.startswith(('http://', 'https://', 'mailto:')):
            return f'<a href="{html.escape(target)}" rel="noopener">{label}</a>'
        path = SOURCE_TO_PATH.get(target)
        if path is None:
            raise ValueError(f'Unsupported link target for the public site: {target}')
        return f'<a href="{path}">{label}</a>'

    out = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, out)
    out = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', out)
    out = re.sub(r'\{\{([A-Z0-9_]+)\}\}', r'<span class="placeholder">{{\1}}</span>', out)
    return out


def convert(markdown: str) -> tuple[str, str, bool]:
    """Returns (title, body html, is_draft)."""
    # The checklist link points into the repository; it means nothing on the public site.
    markdown = re.sub(r' See the \[policy review checklist\]\(README\.md\)\.', '', markdown)
    lines = markdown.splitlines()
    title = ''
    blocks: list[str] = []
    draft = False
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif line.startswith('# '):
            title = line[2:].strip()
            blocks.append(f'<h1 id="top">{inline(title)}</h1>')
            i += 1
        elif line.startswith('## ') or line.startswith('### '):
            level = 2 if line.startswith('## ') else 3
            text = line[level + 1:].strip()
            blocks.append(f'<h{level} id="{slugify(text)}">{inline(text)}</h{level}>')
            i += 1
        elif line.startswith('> '):
            quote = []
            while i < len(lines) and lines[i].startswith('> '):
                quote.append(lines[i][2:])
                i += 1
            draft = draft or 'pending owner and legal review' in ' '.join(quote).lower()
            blocks.append(f'<div class="draft" role="note"><p>{inline(" ".join(quote))}</p></div>')
        elif line.startswith('- '):
            items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append(f'<li>{inline(lines[i][2:])}</li>')
                i += 1
            blocks.append('<ul>\n' + '\n'.join(items) + '\n</ul>')
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([cell.strip() for cell in lines[i].strip().strip('|').split('|')])
                i += 1
            head, body = rows[0], [r for r in rows[2:]]
            thead = ''.join(f'<th scope="col">{inline(c)}</th>' for c in head)
            tbody = '\n'.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body)
            blocks.append(f'<div class="table"><table>\n<thead><tr>{thead}</tr></thead>\n<tbody>\n{tbody}\n</tbody>\n</table></div>')
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#', '>', '- ', '|')):
                para.append(lines[i].strip())
                i += 1
            blocks.append(f'<p>{inline(" ".join(para))}</p>')
    return title, '\n'.join(blocks), draft


def page(slug: str) -> str:
    source, _ = PAGES[slug]
    title, body, draft = convert((SOURCE / source).read_text())
    nav = '\n'.join(
        f'<li><a href="/{s}"{" aria-current=\"page\"" if s == slug else ""}>{label}</a></li>'
        for s, (_, label) in PAGES.items()
    )
    robots = '\n<meta name="robots" content="noindex">' if draft else ''
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title.removeprefix('Fancy ').strip())} · Fancy</title>
<meta name="description" content="{html.escape(DESCRIPTIONS[slug])}">{robots}
<meta name="theme-color" content="#123f35">
<link rel="icon" href="/legal/fancy-icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/legal/legal.css">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="site">
<div class="wrap">
<a class="brand" href="/support" aria-label="Fancy support home"><img src="/legal/fancy-icon.svg" alt="" width="36" height="36">Fancy</a>
<nav aria-label="Fancy policies">
<ul>
{nav}
</ul>
</nav>
</div>
</header>
<main id="content" class="wrap">
{body}
</main>
<footer class="site">
<div class="wrap">
<p>Fancy a bite? Meet new people over a meal in London.</p>
<p><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/guidelines">Community Guidelines</a> · <a href="/support">Support</a></p>
</div>
</footer>
</body>
</html>
"""


def outputs() -> dict[Path, str]:
    files = {PUBLIC / slug / 'index.html': page(slug) for slug in PAGES}
    files[PUBLIC / 'legal/legal.css'] = CSS
    files[PUBLIC / 'legal/fancy-icon.svg'] = ICON_SOURCE.read_text()
    return files


def main(argv: list[str]) -> int:
    files = outputs()
    if '--check' in argv:
        stale = [p for p, text in files.items() if not p.exists() or p.read_text() != text]
        for p in stale:
            print(f'out of date: {p.relative_to(ROOT)}')
        return 1 if stale else 0
    for path, text in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        print(f'wrote {path.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
