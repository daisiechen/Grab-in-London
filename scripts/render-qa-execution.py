# -*- coding: utf-8 -*-
"""Render execution facts without converting test counts to case passes."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def render():
    p=json.loads((ROOT/'docs/qa/execution-2026-10-21.json').read_text())
    runs=json.loads((ROOT/'docs/qa/evidence/2026-10-21/automated-runs.json').read_text())['runs']
    lines=['# 独立QA执行报告 · 2026-10-21','',
    ('**结论：本轮不通过，存在未闭环缺陷：'+', '.join(k for k,v in p.get('defectStatus',{}).items() if v=='OPEN')+'。**' if any(v=='OPEN' for v in p.get('defectStatus',{}).values()) else '**结论：部分执行，尚不能完成整体验收；不构成发布通过。**')+' 已定向关闭：'+', '.join(k for k,v in p.get('defectStatus',{}).items() if v=='CLOSED_TARGETED_QA')+'；组件修复验证：'+', '.join(k for k,v in p.get('defectStatus',{}).items() if v=='FIX_VERIFIED_COMPONENT')+'。保留修前失败历史和未执行断言。','',
    f"原测试计划基线4659fdb；被测交接`{p['baselineCommit']}`，业务代码`{p['codeBaselineCommit']}`。Inbox分页修复在`{p['fixVerificationCommit']}`仅做定向复验；QA-F01及第二批P0探针在04cb601验证，第三批边界、删除/恢复和适配在d4582f7及后续仅CI增量版本定向验证，具体版本见运行表；更早证据沿用对应固定基线。",'',
    '## 阻塞澄清与跟进','',p.get('blockerTriage',''),'',
    '15分钟仅为兜底唤醒，无项目规定；发现问题直接交开发、有修复即复验，不等待定时周期。原14条已逐条交原开发会话处理，两条本地删除/恢复用例已通过，其余本地准备继续推进。','',
    '## 用例状态','', '| 状态 | 数量 |','|---|---:|']
    for status in ('PASS','FAIL','BLOCKED','NOT_RUN','N/A'):lines.append(f"| {status} | {p['counts'].get(status,0)} |")
    lines+=['','共217条。PASS只授予已核对完整预期的用例；相关测试通过但缺完整步骤/断言证据的仍为NOT_RUN。BLOCKED仍缺真实供应商、真实设备发行、部署或政策批准证据；本地已有可运行模拟器和正常签名原生UI，不能再用旧许可/runtime缺失概括。本地恢复与分步删除已独立通过。FAIL优先于未完成的后续步骤。','',
    '## 实际运行','',p.get('currentExecutionSlice',''),'', '| ID | 结果 | 范围 |','|---|---|---|']
    for r in runs:
        result=f"{r['passed']}/{r['total']}通过，失败{r.get('failed',0)}，{r['suiteFiles']}个测试文件" if 'total' in r else r['result']
        lines.append(f"| {r['id']} | 退出码{r['exitCode']}；{result} | `{r['testedCommit'][:7]}` |")
    lines+=['','R1/R2为QA独立复跑既有实施测试；R3是QA新增29项API/数据库/纯函数探针；R5复跑分页修复回归，R6是QA第二批6项独立P0探针；R7/R8为QA-F01修复的API/Web及iOS组件定向复跑；R9是第三批12项独立边界探针，R10/R11复跑解除准备，R12为QA新增真实备份中E0导出的恢复后撤销分支；R13为饭后及群/私聊权限独立探针；R14保留QA-F03修前2失败，R15为0518d45修后的12项独立探针复验，R16为身份模块26项受影响HTTP回归（包括fresh会话下未来proof拒绝），不能删除修前结果或把历史失败当当前通过；R17为举报本人回执及撤授权重放3项独立HTTP/PG探针，撤session/DELETING状态通过受控数据库夹具设置。R18为安排锁、历史截止补算、开始名单及预约隔离6项独立PG/HTTP探针，删除仅屏障状态，完整删除名单断言仍未通过。R19/R20独立定向复跑5a37fdc关闭顺序单测及真实PG负载退出，未替代远端CI结果。R21为删除实际HTTP/本地purge、故障rollback及用户锁消息/审批竞态5项独立探针，生产日志脱敏仍待完整捕获。R22为ac09af4固定版本的11项独立受控AI/controller/HTTP探针，仅035/036/037具完整预期证据；R23为该版本Claude发现修复28项API/DB独立定向复验。R24保留QA-F04修前停用后仍发布失败；R25为8e2b908修后7项独立停用/费用/reaper探针，R26为22项受影响DB回归，F04定向关闭而043仍有未测断言。R27保留QA-F05修前Web失败，T001另为已分类夹具错误；R28/R29为f298048独立session/PG及Web组件各3项，R30为iOS manager17项定向回归；F05在NEW与TTL/偏好删除差异范围关闭。R31为公开DTO/后台角色/CSV授权及跨快照游标和大序号4项独立HTTP/PG探针，公式转义另覆盖formatter，不声称Excel实际执行。R32保留QA-F06 CLI入口失败，R33保留QA-F07原生协议失败；R34/R35固定b76c593独立8+32项验证CLI修复，R36固定1080993独立iOS49项验证桥接修复。完整加入用户路径仍NOT_RUN，不据组件通过升级。不能将这些数量相加当作独立业务用例数；R5与R1有重复，R2也不是原生设备验收。逐项测试名、状态、时间和命令见[机器证据](evidence/2026-10-21/automated-runs.json)。R4是质量检查而非业务用例。','',
    '曾以错误的pnpm参数调用iOS测试，得到“No tests found”且退出0；该次不计入证据。更正为Jest exec后实际169项通过。部分初始命令误命中Xcode shim并返回69；通过既有infra/dev-env.sh选择工具链后执行，未修改系统许可。','',
    '本地隔离PostgreSQL是真数据库；身份、餐厅、邮件及AI为test/fixture/mock。没有调用真实外部服务。既有研究文档未提交修改不属于测试基线，本轮不暂存。截图和快照仅包含合成测试资料；原始token、验证码、日志及本机凭据不发布。','',
    '交付验证：适用生产修复检查见原开发交接与每轮运行记录；本批独立全Web/admin R188为312通过，含明确标记的F38工作树修复，正式接收仍需提交后定向复验。Python文档/配置测试当前77项；历史失败、源hash、报告可重现性均验证，不把测试数量换算成217条用例通过。','',
    '远端CI：'+p.get('deliveryValidation',{}).get('remoteCI','本轮未额外检查。'),'',
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
    *[f'{index}. {item}' for index,item in enumerate(p.get('nextExecution',[]),1)],'',
    'Claude参与此前测试设计建议；本次动态执行及结论由Codex负责。Claude提出静态发现后由开发筛选复现修复至ac09af4，QA已独立定向复跑28项API/DB通过；不算Claude动态测试或完整交叉签收。','']
    (ROOT/'docs/qa/execution-2026-10-21.zh-CN.md').write_text('\n'.join(lines))
if __name__=='__main__':render()
