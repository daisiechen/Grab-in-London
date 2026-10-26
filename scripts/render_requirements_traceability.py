"""Render the reviewed requirement ledger; never infer scope or alter sources."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def render():
    data = json.loads((ROOT / 'docs/product/requirements-traceability.json').read_text())
    out = ['# 原需求逐条旅程与版本映射（r07）', '',
           '范围说明、版本定义与未决项见[核对报告](requirements-audit.zh-CN.md)。本表每行对应一条非空原文行，包含规则、上下文、示例和合同代码；不把原文单元数量当独立需求数。完整原文、摘要哈希和有效性说明见[JSON台账](requirements-traceability.json)。原作者文档未改。', '',
           '“继承”须服从最新共同规则；“历史”不构成实施授权；“后置”仍保留范围。所有版本均为规划，PM尚未启动。', '']
    names = {'inherited': '继承', 'historical-reference': '历史参考',
             'historical-future': '历史交易/后续', 'direction-not-committed': '探索未承诺',
             'inherited-with-future-boundary': '继承当前/保留未来边界',
             'delivery-context': '交付上下文', 'platform-deferred': 'Web后置',
             'superseded-clause': '被批准规则替代', 'open-conflict': '未决冲突'}
    for source in data['sources']:
        relative = os.path.relpath(ROOT / source['path'], ROOT / 'docs/product')
        out += [f'## {source["path"]}', '', f'原文单元：{source["units"]}。', '',
                '| 原文定位 | 原文摘要 | 旅程／规划版本 | 处理 |', '| --- | --- | --- | --- |']
        for u in data['units']:
            if u['source'] != source['path']:
                continue
            # Extracted Markdown links must not acquire a different base directory.
            text = u['text'].strip().replace('|', '／').replace('[', '［').replace(']', '］').replace('`', '')
            if len(text) > 110:
                text = text[:110] + '…'
            targets = '；'.join(f'{t["journey"]}/{t["version"]}' for t in u['targets'])
            out.append(f'| [{u["id"]}]({relative}#L{u["line"]}) | {text} | {targets} | {names[u["disposition"]]} |')
        out.append('')
    out += ['## 旧切片逐项归属', '', '| 原编号 | 范围 | 旅程／规划版本 |', '| --- | --- | --- |']
    for r in data['legacySlices']:
        targets = '；'.join(f'{t["journey"]}/{t["version"]}' for t in r['targets'])
        out.append(f'| {r["id"]} | {r["title"]} | {targets} |')
    out += ['', '## 原领域验收编号逐项归属', '', '| 验收编号 | 原来源 | 旅程／规划版本 |', '| --- | --- | --- |']
    for r in data['legacyAcceptance']:
        targets = '；'.join(f'{t["journey"]}/{t["version"]}' for t in r['targets'])
        relative = os.path.relpath(ROOT / r['source'], ROOT / 'docs/product')
        out.append(f'| {r["id"]} | [原文]({relative}) | {targets} |')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    (ROOT / 'docs/product/requirements-traceability.zh-CN.md').write_text(render())
