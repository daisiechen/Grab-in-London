"""Package unchanged PM authored prototypes and paired PRDs into a private review site.

The hub is PJ owned. Each journey remains a separate PM artifact. No credentials,
fixture runtime, private user data or business application services are packaged.
"""
from pathlib import Path
import argparse
import html
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]


def hub(commit):
    product = json.loads((ROOT / 'docs/product/journey-modules.json').read_text())
    cards = []
    for j in product['journeys'][:11]:
        slug = j['id'].lower()
        cards.append(f'''<article><div class="meta">{j['id']} · {j['plannedVersion']} · PM-r01</div>
<h2>{html.escape(j['title'])}</h2><p>{html.escape(j['end'])}</p>
<nav><a class="primary" href="{slug}/index.html">打开交互 Demo ↗</a><a href="requirements/{slug}.html">查看需求</a></nav>
<a class="source" href="https://github.com/daisiechen/Grab-in-London/blob/{commit}/docs/product/journeys/{slug}/requirements.zh-CN.md">仓库版本与原始需求 ↗</a></article>''')
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fancy · 首发旅程 PM 评审</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f4f2eb;color:#203b30;font:16px/1.65 system-ui,sans-serif}main{max-width:1220px;margin:auto;padding:44px 24px}header{max-width:850px;margin-bottom:32px}.brand{font:italic 48px Georgia,serif}h1{font-size:32px;line-height:1.3;margin:8px 0 16px}.note{border-left:3px solid #244f3c;padding:8px 18px;background:#e7ede5}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px}article{background:#fffdf8;border:1px solid #d9ded3;border-radius:16px;padding:24px;display:flex;flex-direction:column}h2{font-size:21px;line-height:1.4;margin:10px 0}p{margin:8px 0 20px}.meta,.source{font-size:12px;color:#5c7164}nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:auto;margin-bottom:15px}a{color:#28543e;text-decoration:underline;text-underline-offset:3px}nav a{padding:10px 13px;border:1px solid #a8b8a7;border-radius:8px;text-decoration:none;font-weight:600}nav a.primary{color:white;background:#244f3c;border-color:#244f3c}a:focus-visible{outline:3px solid #a45f23;outline-offset:4px}footer{margin-top:28px;font-size:13px;color:#5c7164}@media(max-width:450px){main{padding:24px 16px}h1{font-size:26px}}</style>
<main><header><div class="brand">Fancy</div><h1>首发 11 条旅程，各自完整交付</h1><p>3 个 PM 并行制作的需求与可交互原型。先选一个旅程，查看对应需求，再体验完整操作路径。</p><div class="note">PM-r01 候选，供审阅。账号、模型、多人操作和后台数据为合成演示；未接真实服务，未启动 UX、RD、QA。独立评审控制不属于产品功能。</div></header><section>'''+''.join(cards)+f'</section><footer>范围 r07 · 派工 r08 · 仓库候选 {commit[:12]}。每个 Demo 独立运行，彼此不共享模拟账号或状态。</footer></main></html>'


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
        prd = (ROOT / 'docs/product/journeys' / slug / 'requirements.zh-CN.md').read_text()
        (requirements / f'{slug}.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fancy '+slug.upper()+' PM需求</title><style>body{max-width:1000px;margin:32px auto;padding:0 20px;color:#203b30;background:#fffdf8;font:16px/1.7 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}a{color:#28543e}</style><a href="../index.html">← 返回旅程列表</a><pre>'+html.escape(prd)+'</pre></html>')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', required=True)
    parser.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    if len(args.commit) != 40 or any(c not in '0123456789abcdef' for c in args.commit):
        parser.error('commit must be the exact 40-character reviewed repository SHA')
    package(args.destination.resolve(), args.commit)
