"""Render the QA case catalog from its JSON source without running product tests."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'docs/qa'
payload = json.loads((out / 'test-cases.json').read_text())
cases = sorted(payload['cases'], key=lambda c: (c['group'], c['id']))
lines=['# 测试用例目录（待执行）','','唯一结构化真源：[test-cases.json](test-cases.json)。本文件由同份数据渲染；用例均为计划，状态见各条；现有测试通过不自动改变状态。','',f'基线：`{payload["baselineCommit"]}`。共{len(cases)}条。夹具、源文件SHA256和证据字段见JSON。','']
last=None
for c in cases:
 if last!=c['group']:lines += ['## '+c['group'],''];last=c['group']
 lines += [f'### {c["id"]} {c["title"]}', '', f'- 优先级/阶段/方法：{c["priority"]} / {c["stage"]} / {c["method"]}；状态：{c["status"]}',f'- 需求：{"、".join(c["requirements"])}；场景：{"、".join(c["scenarioIds"]) or "基础检查"}；任务：{"、".join(c["taskIds"])}',f'- 前置：{"；".join(c["preconditions"])}', '- 步骤：'+' → '.join(c['steps']),'- 预期：'+'；'.join(c['expected']),'- 依据：'+'、'.join(f'[{Path(s["path"]).name}](../../{s["path"]}) {s["section"]}' for s in c['sources']), '']
(out/'test-cases.zh-CN.md').write_text('\n'.join(lines))
