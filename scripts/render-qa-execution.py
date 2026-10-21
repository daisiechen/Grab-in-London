"""Render execution facts without converting test counts to case passes."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def render():
    p=json.loads((ROOT/'docs/qa/execution-2026-10-21.json').read_text())
    runs=json.loads((ROOT/'docs/qa/evidence/2026-10-21/automated-runs.json').read_text())['runs']
    lines=['# 独立QA执行报告 · 2026-10-21','',
    '**结论：部分执行，尚不能完成整体验收；不构成发布通过。** QA-F01在04cb601经定向复验关闭，QA-F02组件回归通过；完整217条仍有未执行及外部阻塞。保留原失败历史。','',
    f"原测试计划基线4659fdb；被测交接`{p['baselineCommit']}`，业务代码`{p['codeBaselineCommit']}`。Inbox分页修复在`{p['fixVerificationCommit']}`仅做定向复验；QA-F01及第二批P0探针在04cb601验证，其余证据沿用固定基线。",'',
    '## 用例状态','', '| 状态 | 数量 |','|---|---:|']
    for status in ('PASS','FAIL','BLOCKED','NOT_RUN','N/A'):lines.append(f"| {status} | {p['counts'].get(status,0)} |")
    lines+=['','共217条。PASS只授予已核对完整预期的用例；相关测试通过但缺完整步骤/断言证据的仍为NOT_RUN。BLOCKED是外部环境或原生/恢复演练能力缺失，不是待用户澄清业务规则。FAIL优先于未完成的后续步骤。','',
    '## 实际运行','', '| ID | 结果 | 范围 |','|---|---|---|']
    for r in runs:
        result=f"{r['passed']}/{r['total']}通过，{r['suiteFiles']}个测试文件" if 'total' in r else r['result']
        lines.append(f"| {r['id']} | 退出码{r['exitCode']}；{result} | `{r['testedCommit'][:7]}` |")
    lines+=['','R1/R2为QA独立复跑既有实施测试；R3是QA新增29项API/数据库/纯函数探针；R5复跑分页修复回归，R6是QA第二批6项独立P0探针；R7/R8为QA-F01修复的API/Web及iOS组件定向复跑。不能将这些数量相加当作独立业务用例数；R5与R1有重复，R2也不是原生设备验收。逐项测试名、状态、时间和命令见[机器证据](evidence/2026-10-21/automated-runs.json)。R4是质量检查而非业务用例。','',
    '曾以错误的pnpm参数调用iOS测试，得到“No tests found”且退出0；该次不计入证据。更正为Jest exec后实际169项通过。部分初始命令误命中Xcode shim并返回69；通过既有infra/dev-env.sh选择工具链后执行，未修改系统许可。','',
    '本地隔离PostgreSQL是真数据库；身份、餐厅、邮件及AI为test/fixture/mock。没有调用真实外部服务。既有研究文档未提交修改不属于测试基线，本轮不暂存。截图和快照仅包含合成测试资料；原始token、验证码、日志及本机凭据不发布。','',
    '交付验证：当前修复基线另跑core:check退出0；Python文档/配置测试69项通过（其中QA相关11项）。新增证据最初漏列文档索引，补全后通过，未放宽测试。','',
    '## 浏览器和缺陷','',
    '[B1 浏览器逐步记录](evidence/2026-10-21/browser-journey.zh-CN.md)覆盖创建、认证回流保稿、申请、审批、锁安排及群聊发送；未走完出席和后台闭环。','',
    '[缺陷登记](defects-2026-10-21.zh-CN.md)：QA-F01申请卡片缺场次信息在04cb601经B2浏览器及R7/R8定向复验关闭；QA-F02分页在071ecd7通过组件定向复验，范围不扩张到大数据浏览器负载。','',
    '## 逐条结果','',
    '完整预期、未证实断言、相关测试索引见[结构化执行记录](execution-2026-10-21.json)。下表证据ID对应机器证据中的唯一断言ID；“相关”索引只帮助继续执行，不证明整条用例通过。','',
    '| 用例 | 状态 | 结果或剩余工作 |','|---|---|---|']
    for c in p['cases']:
        text=c['actual'].replace('|','／').replace('\n',' ')
        evidence='；证据 '+', '.join(c['evidence']) if c['evidence'] else ''
        lines.append(f"| {c['id']} · {c['title']} | {c['status']} | {text}{evidence} |")
    lines+=['','## 下一批执行顺序','',
    '1. 优先补P0中尚无完整取证的锁等待跨截止、审批/申请±1ms、通知去重/重试尽头、删除屏障及导出竞争；已有组件或纯函数证据可复用但不能替代HTTP/数据库副作用断言。',
    '2. QA-F01两场pending卡片定向复验已完成；继续串联加入者及主持人后半程、支持纠错和后台同快照链路。',
    '3. 对原Demo场景决定按原目标执行还是经正式修订迁移到生产目标，保留版本关系；完成其键盘/焦点/小屏及导航状态验证。',
    '4. 真实身份/Places/收件箱、iOS原生、部署恢复和DeepSeek质量/账单/数据政策留在外部门槛环境执行；本轮本地证据不能关闭这些门槛。','',
    'Claude参与此前测试设计建议；本次独立执行及结论由Codex负责，尚无Claude对本执行报告的完整交叉复核。','']
    (ROOT/'docs/qa/execution-2026-10-21.zh-CN.md').write_text('\n'.join(lines))
if __name__=='__main__':render()
