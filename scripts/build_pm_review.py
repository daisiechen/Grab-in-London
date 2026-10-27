"""Package unchanged PM authored prototypes and paired PRDs into a private review site.

The hub is PJ owned. Each journey remains a separate PM artifact. No credentials,
fixture runtime, private user data or business application services are packaged.
"""
from pathlib import Path
import argparse
import html
import json
import shutil
import posixpath
import re

ROOT = Path(__file__).resolve().parents[1]



READER_SCRIPT = r"""<script>
(() => {
  const catalog = document.getElementById('catalog');
  const reader = document.getElementById('prd-reader');
  const content = document.getElementById('prd-content');
  const title = document.getElementById('prd-title');
  let previous = null;
  function render() {
    const match = /^#prd-(j\d{2})$/.exec(location.hash);
    const doc = match && document.getElementById('doc-' + match[1]);
    if (doc) {
      previous = catalog.querySelector('[data-prd="' + match[1] + '"]');
      content.replaceChildren(doc.content.cloneNode(true));
      title.textContent = match[1].toUpperCase() + ' · ' + doc.dataset.title;
      catalog.hidden = true; reader.hidden = false;
      document.title = title.textContent + ' · Fancy PM需求';
      title.focus({preventScroll: true});
    } else {
      reader.hidden = true; catalog.hidden = false; content.replaceChildren();
      document.title = 'Fancy · 首发旅程 PM 评审';
      if (previous && previous.isConnected) previous.focus({preventScroll: true});
    }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-prd], #prd-back');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    render();
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('popstate', render);
  render();
})();
</script>"""


def render_prd(markdown, slug, commit):
    """Render the subset used by these PRDs; raw HTML never becomes executable.

    Relative references resolve against the original repository document, not the
    private hosting route. The complete original Markdown remains available too.
    """
    def inline(text):
        result, cursor = [], 0
        pattern = r'\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*'
        for match in re.finditer(pattern, text):
            result.append(html.escape(text[cursor:match.start()]))
            if match[1] is not None:
                label, target = match[1], match[2]
                if target.startswith(('https://', 'http://', 'mailto:')):
                    href = target
                elif target.startswith('#'):
                    href = '#prd-' + slug
                elif ':' in target.split('/')[0]:
                    href = None
                else:
                    path = posixpath.normpath('docs/product/journeys/' + slug + '/' + target)
                    demo = re.fullmatch(r'demo/journeys/(j\d{2})/index\.html', path)
                    href = demo[1] + '/' if demo else 'https://github.com/daisiechen/Grab-in-London/blob/' + commit + '/' + path
                result.append('<a href="' + html.escape(href, quote=True) + '">' + html.escape(label) + '</a>' if href else html.escape(label))
            elif match[3] is not None:
                result.append('<code>' + html.escape(match[3]) + '</code>')
            else:
                result.append('<strong>' + html.escape(match[4]) + '</strong>')
            cursor = match.end()
        return ''.join(result) + html.escape(text[cursor:])

    out, lines, i = [], markdown.splitlines(), 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or re.fullmatch(r'<a id="[a-zA-Z0-9_-]+"></a>', line):
            i += 1
            continue
        heading = re.match(r'^(#{1,6})\s+(.+)', line)
        if heading:
            level = min(len(heading[1]) + 1, 6)
            out.append(f'<h{level}>' + inline(heading[2]) + f'</h{level}>')
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = lines[i].strip().strip('|').split('|')
                if not all(re.fullmatch(r'\s*:?-+:?\s*', cell) for cell in cells):
                    tag = 'th' if not rows else 'td'
                    rows.append('<tr>' + ''.join(f'<{tag}>' + inline(cell.strip()) + f'</{tag}>' for cell in cells) + '</tr>')
                i += 1
            out.append('<div class="doc-table"><table>' + ''.join(rows) + '</table></div>')
        elif re.match(r'^(- |\d+\. )', line):
            ordered = bool(re.match(r'^\d+\. ', line))
            tag, pattern = ('ol', r'^\d+\. (.*)') if ordered else ('ul', r'^- (.*)')
            items = []
            while i < len(lines) and (item := re.match(pattern, lines[i].strip())):
                items.append('<li>' + inline(item[1]) + '</li>')
                i += 1
            out.append(f'<{tag}>' + ''.join(items) + f'</{tag}>')
        else:
            paragraph = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||- |\d+\. |<a id=)', lines[i].strip()):
                paragraph.append(lines[i].strip())
                i += 1
            out.append('<p>' + inline(' '.join(paragraph)) + '</p>')
    return '<article class="prd-body">' + '\n'.join(out) + '</article><details class="markdown-source"><summary>查看 Markdown 原文</summary><pre>' + html.escape(markdown) + '</pre></details>'


def hub(commit):
    product = json.loads((ROOT / 'docs/product/journey-modules.json').read_text())
    cards = []
    documents = []
    for j in product['journeys'][:11]:
        slug = j['id'].lower()
        directory = ROOT / 'docs/product/journeys' / slug
        prd = (directory / 'requirements.zh-CN.md').read_text()
        manifest = json.loads((directory / 'artifact-manifest.json').read_text())
        prd_revision = manifest.get('requirementsRevision', 'PM-r01')
        demo_revision = manifest.get('demoRevision', manifest['revision'])
        documents.append(f'<template id="doc-{slug}" data-title="{html.escape(j["title"], quote=True)}">{render_prd(prd, slug, commit)}</template>')
        cards.append(f'''<article><div class="meta">{j['id']} · {j['plannedVersion']} · PRD {prd_revision} / Demo {demo_revision}</div>
<h2>{html.escape(j['title'])}</h2><p>{html.escape(j['end'])}</p>
<nav><a class="primary" href="{slug}/index.html">打开交互 Demo ↗</a><a href="#prd-{slug}" data-prd="{slug}">查看需求</a></nav>
<a class="source" href="https://github.com/daisiechen/Grab-in-London/blob/{commit}/docs/product/journeys/{slug}/requirements.zh-CN.md">仓库版本与原始需求 ↗</a></article>''')
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fancy · 首发旅程 PM 评审</title>
<style>[hidden]{display:none!important}.reader{display:block;max-width:1000px;margin:auto}.reader pre{white-space:pre-wrap;overflow-wrap:anywhere;font:16px/1.8 system-ui,sans-serif;background:#fffdf8;border:1px solid #d9ded3;border-radius:12px;padding:24px}.reader h1{font-size:28px}.prd-body{display:block;overflow-wrap:anywhere;padding:24px}.prd-body h2{font-size:25px;margin:0 0 20px}.prd-body h3{font-size:21px;margin:28px 0 12px}.prd-body h4{font-size:18px;margin:22px 0 10px}.prd-body li{margin:8px 0}.prd-body code{background:#edf0e9;border-radius:4px;padding:1px 4px;overflow-wrap:anywhere}.doc-table{max-width:100%;overflow-x:auto;margin:18px 0}.doc-table table{border-collapse:collapse;min-width:560px;width:100%;font-size:14px}.doc-table th,.doc-table td{padding:10px;border:1px solid #d9ded3;text-align:left;vertical-align:top}.doc-table th{background:#edf0e9}.markdown-source{margin-top:20px}.markdown-source summary{cursor:pointer}.reader .back{display:inline-block;margin-bottom:18px}*{box-sizing:border-box}body{margin:0;background:#f4f2eb;color:#203b30;font:16px/1.65 system-ui,sans-serif}main{max-width:1220px;margin:auto;padding:44px 24px}header{max-width:850px;margin-bottom:32px}.brand{font:italic 48px Georgia,serif}h1{font-size:32px;line-height:1.3;margin:8px 0 16px}.note{border-left:3px solid #244f3c;padding:8px 18px;background:#e7ede5}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px}article{background:#fffdf8;border:1px solid #d9ded3;border-radius:16px;padding:24px;display:flex;flex-direction:column}h2{font-size:21px;line-height:1.4;margin:10px 0}p{margin:8px 0 20px}.meta,.source{font-size:12px;color:#5c7164}nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:auto;margin-bottom:15px}a{color:#28543e;text-decoration:underline;text-underline-offset:3px}nav a{padding:10px 13px;border:1px solid #a8b8a7;border-radius:8px;text-decoration:none;font-weight:600}nav a.primary{color:white;background:#244f3c;border-color:#244f3c}a:focus-visible{outline:3px solid #a45f23;outline-offset:4px}footer{margin-top:28px;font-size:13px;color:#5c7164}@media(max-width:450px){main{padding:24px 16px}h1{font-size:26px}}</style>
<main><div id="catalog"><header><div class="brand">Fancy</div><h1>首发 11 条旅程，各自完整交付</h1><p>3 个 PM 并行制作的需求与可交互原型。先选一个旅程，查看对应需求，再体验完整操作路径。</p><div class="note">PM-r01 候选，供审阅。账号、模型、多人操作和后台数据为合成演示；未接真实服务，未启动 UX、RD、QA。独立评审控制不属于产品功能。</div></header><section>'''+''.join(cards)+f'</section><footer>范围 r07 · 派工 r08 · 仓库候选 {commit[:12]}。每个 Demo 独立运行，彼此不共享模拟账号或状态。</footer></div><section id="prd-reader" class="reader" hidden aria-label="需求全文"><a class="back" href="#journeys" id="prd-back">← 返回旅程列表</a><h1 id="prd-title" tabindex="-1"></h1><div id="prd-content"></div></section>'+''.join(documents)+READER_SCRIPT+'</main></html>'


def package(destination, commit):
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'index.html').write_text(hub(commit))
    requirements = destination / 'requirements'
    requirements.mkdir(exist_ok=True)
    for n in range(1, 12):
        slug = f'j{n:02}'
        source = ROOT / 'demo/journeys' / slug / 'index.html'
        target = destination / slug
        target.mkdir(exist_ok=True)
        shutil.copyfile(source, target / 'index.html')
        directory = ROOT / 'docs/product/journeys' / slug
        prd = (directory / 'requirements.zh-CN.md').read_text()
        manifest = json.loads((directory / 'artifact-manifest.json').read_text())
        prd_revision = manifest.get('requirementsRevision', 'PM-r01')
        demo_revision = manifest.get('demoRevision', manifest['revision'])
        (requirements / f'{slug}.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fancy '+slug.upper()+' PM需求</title><style>body{max-width:1000px;margin:32px auto;padding:0 20px;color:#203b30;background:#fffdf8;font:16px/1.7 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}a{color:#28543e}</style><a href="../index.html">← 返回旅程列表</a><pre>'+html.escape(prd)+'</pre></html>')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', required=True)
    parser.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    if len(args.commit) != 40 or any(c not in '0123456789abcdef' for c in args.commit):
        parser.error('commit must be the exact 40-character reviewed repository SHA')
    package(args.destination.resolve(), args.commit)
