"""Enumerate original source units without silently dropping prose or table rows.

This extracts evidence only. Journey/version decisions live in the reviewed ledger;
this module deliberately does not infer product scope from keywords.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    'docs/product/PRD.zh-CN.md',
    'docs/product/mvp-patch-PRD.zh-CN.md',
    'docs/product/admin/PRD.zh-CN.md',
    'docs/product/admin/measurement-contract.zh-CN.md',
    *sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'docs/product/modules').glob('*.md')),
    'demo/UX-CONTRACT.md', 'admin/UX-CONTRACT.md',
    'docs/engineering/core-development-plan.zh-CN.md',
    'docs/engineering/ai-development-plan.zh-CN.md',
    'docs/engineering/data-and-command-contract.zh-CN.md',
    'docs/engineering/api-and-client-contract.zh-CN.md',
    'docs/engineering/validation-and-release.zh-CN.md',
    'docs/delivery/mvp-freeze-2026-10-23.zh-CN.md',
    'docs/engineering/mvp-patch/plan.zh-CN.md',
]


def inventory(path):
    """Nonempty physical lines are auditable units, including context and code.

    Headings/table separators/fences are structure. Context/code remain in the
    inventory so human scope review cannot accidentally omit an unnumbered rule.
    """
    headings = {}
    in_code = False
    result = []
    for number, line in enumerate((ROOT / path).read_text().splitlines(), 1):
        stripped = line.strip()
        heading = re.match(r'^(#{1,6}) (.+)', stripped)
        if heading:
            depth = len(heading[1])
            headings = {k: v for k, v in headings.items() if k < depth}
            headings[depth] = heading[2]
            continue
        if stripped.startswith('```'):
            in_code = not in_code
            continue
        if not stripped or re.fullmatch(r'\|?[\s:|\-]+\|?', stripped):
            continue
        result.append({
            'source': path, 'line': number, 'section': ' / '.join(headings.values()),
            'text': line,
            'sha256': hashlib.sha256(line.encode()).hexdigest(),
            'kind': 'contract-code' if in_code else 'source-unit',
        })
    return result
