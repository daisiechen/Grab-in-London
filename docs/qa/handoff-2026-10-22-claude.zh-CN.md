# QA 交接记录：Codex → Claude Code（2026-10-22）

## 为什么交接

- Codex 测试会话（`01a15bd2…`，自动化 `fancy`）与开发会话「开发-三端MVP并行」（`01a15beb…`，自动化 `fancy-mvp`）分别于 2026-10-22 16:11 / 16:19 UTC 触发 `usage_limit_exceeded`，额度到 2026-10-28 才恢复。两个心跳自动化仍会唤醒，但每次立即失败，不会再写入。
- Claude Code 接手 QA 执行与记录。开发会话不可用期间，**生产实现修复无人负责**；QA 仍只改 `docs/qa`、QA 脚本/测试及 `docs/README.md` 索引。

## 交接时的权威状态

- 真源：[执行 JSON](execution-2026-10-21.json)，计数 **198 PASS / 8 NOT_RUN / 11 BLOCKED**（共 217 条，本轮未提升任何整条用例）。
- 11 条 BLOCKED 是真实外部门槛（真实 Auth/Places/邮件/iOS 真机签名/隐私政策/首尔部署演练/DeepSeek 真实评测、数据边界、实账），需要用户批准或真实供应商，Claude 不擅自调用付费服务或读取凭据。
- 8 条 NOT_RUN 为整条旅程：J001、J002、J004、J005、J007、J008、J009、J011；剩余断言见各用例 `remainingExpected`。

## 运行中的统一环境（重启后会丢失）

| 项 | 值 |
| --- | --- |
| Web 源 | `http://unified-final.localhost:53004`（native API 端口 62057） |
| 测试钟 | `2026-10-23T01:00:00Z`，owner `85491ba7…`，revision 145 |
| 控制命令 | `python3 /private/tmp/fancy-final-qa-command.py inspect`；推进：`… advance '{"target":"<ISO>"}'`（每次推进前跑新 guard，确认 API/worker/HTTP 空闲） |
| 只读 DB | rig 回执 `/private/tmp/fancy-unified-p2b-retained-ksPJDH/owner-receipt.json`；Claude 辅助脚本 `/private/tmp/claude-qa/ro.mjs "<SQL>"`（`BEGIN READ ONLY`） |
| 原生 | 模拟器 `D92E76C4-9333-4FC7-8B53-E681DA73C055`（iOS 27），App `com.example.fancy.dev`；探针工程 `/private/tmp/fancy-qa-native/Probe.xcodeproj`，`build-for-testing … CODE_SIGNING_ALLOWED=NO` 后用 `FormalF55.xctestrun` `test-without-building` |
| 账号 | H=QA Final Host `bf76e623…`，A=QA Final Applicant `86e932c7…`，B=QA Final Bystander `942aa7e3…`，Staff=Synthetic Analyst S `63a48c68…`；OTP 走测试 outbox，不发真实邮件 |
| 饭局 | M3 `120d0bb4-86bd-408c-9a67-bf506ade29c9`（已 COMPLETED），M2 `89bd0e09…`（CANCELLED），M1（COMPLETED） |

以上路径都在 `/private/tmp`，不进入公开仓库。机器重启或 rig 退出后，需由开发侧重建同一夹具，旧整条旅程证据不能拼接成新环境的 PASS。

## 本次完成（B61–B63，见 [证据](evidence/2026-10-21/browser-b61-b63.json)）

1. B61：00Z 自然快照，所有业务与 AI 账本摘要不变。（Codex 执行，Claude 归档）
2. B62：01Z END，M3 唯一 END、名册 H+A、无默认出席；Web 申请人 未知→本人出席→私评分 5。（Codex 执行，Claude 归档）
3. B63：原生主持人 本人出席 → 报告 A 缺席，A 的本人报告仍优先 → 私评分 4 → 公开评价 → 单方“再约”（未互选）。（Claude 执行）
   - native176/177/178 失败均为探针问题（只向上滑、可选分析横幅遮挡、键盘下按钮不可点），不是产品缺陷；修正版探针已入证据。

## 下一步（按顺序）

1. **J004（原生主持 / Web 申请方向）**：Web A 对 H 写公开评价并选“再约”→ 双方互选解锁 → 双向私信 → 撤回 → 拉黑再解封不恢复；第三账号 B 隐私核对。
2. **J007**：B（未参加）填产品问卷；确认问卷不要求资格、不归 meal；评分只计合格人次；同库后台下钻并导出 CSV（Staff 后台标签已登录在 `/admin/?lang=zh&snapshot=92587e49…`）。
3. **J001/J002**：补同库 Admin 追踪及剩余双向断言；**J005**：截止/名额双端重验与服务失败后正常申请；**J008**：剩余异常返回矩阵。
4. **J009/J011**：支持删除与纠错全路径需 CLI OAuth+MFA 支持授权链；开发不在线时先只读核对夹具是否可用，不延长 TTL、不绕过同意。
5. 每批完成后：更新执行 JSON（只追加证据，不凭片段提升整条）、在 `docs/README.md` 加索引、`python3 -m unittest discover -s tests -v`、`git diff --check`、仅提交 QA 白名单并核对远程 SHA。

## 注意

- 测试钟推进原先由开发会话逐步批准；开发不在线期间，推进前需向用户确认。
- 发现产品缺陷时登记到[缺陷登记](defects-2026-10-21.zh-CN.md)，等开发会话恢复（或用户另行指定修复负责人）后交接修复。
- 工作区原有的 `docs/research/competitive-landscape.zh-CN.md` 改动和 `qa/comments-2026-10-20/` 不属于 QA，提交时不要混入。
