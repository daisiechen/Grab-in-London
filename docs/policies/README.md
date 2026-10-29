# Fancy 政策文本与发布核对

2026-10-21 用户授权起草英文隐私通知和社区规则，发布主体为个人。2026-10-29 按用户要求补齐首发所需的全部公开页面：隐私通知、使用条款、社区规则和支持页，内容按当前代码实际收集与处理的数据重写。四份文本仍是**草稿**：页首带“pending owner and legal review”提示，未经 Owner 填写占位符并完成法律审阅前不生效。本目录不修改 PRD 或 Demo；条款不反向覆盖业务规则。

## 文本（英文，权威源）

| 页面 | 草稿 | 发布地址 |
| --- | --- | --- |
| Privacy Notice | [privacy-notice.draft.en.md](privacy-notice.draft.en.md) | https://fancyabite.uk/privacy |
| Terms of Use | [terms-of-use.draft.en.md](terms-of-use.draft.en.md) | https://fancyabite.uk/terms |
| Community Guidelines | [community-guidelines.draft.en.md](community-guidelines.draft.en.md) | https://fancyabite.uk/guidelines |
| Support | [support.draft.en.md](support.draft.en.md) | https://fancyabite.uk/support |

- 静态网页由 `python3 scripts/build_legal_pages.py` 从上述草稿生成到 `apps/web/public/<page>/index.html`（共用 `apps/web/public/legal/legal.css` 与图标），Vite 构建时原样复制进 Web 产物，与 Web App 同源部署。只改 Markdown，再运行脚本；`--check` 模式与 `tests/test_legal_pages.py` 会发现网页与草稿不一致。草稿横幅存在时网页同样显示横幅并带 `noindex`。
- 部署要求：服务器需把 `/privacy` 等无斜杠地址指向 `/privacy/index.html`（如 nginx `try_files $uri $uri/index.html /index.html;`；Cloudflare Pages 默认如此）。若服务器把无斜杠地址交给 Web App，App 内的 `LegalRedirect` 路由会转到带斜杠的静态页。
- iOS 入口：设置页 “Help & legal” 四行（游客也可见）、登录页 “Privacy & community principles” 弹层、资料补全页 18+ 确认下方的条款链接；均用应用内 Safari 视图打开 `extra.legalBaseUrl`（默认 https://fancyabite.uk）。
- App Store Connect 填写材料见 [App Store 提交材料](../delivery/app-store-submission.zh-CN.md)。

## Owner 必须填写的占位符

发布前在四份草稿中替换，然后重新生成网页。公开仓库不保存私人邮箱、住址或身份资料：如不希望写入公开仓库，可在部署流水线中替换，但发布到网站上的页面必须包含真实值。

| 占位符 | 含义 | 说明 |
| --- | --- | --- |
| `{{OPERATOR_NAME}}` | 运营者法定姓名 | 个人发布主体，需与 Apple Developer 账号的法律名称一致 |
| `{{SUPPORT_EMAIL}}` | 公开支持邮箱 | 本机 `.env` 的 SUPPORT_EMAIL；必须真实可收件 |
| `{{OPERATOR_CONTACT_ADDRESS}}` | 联系地址 | 《2002年电子商务条例》要求提供地理地址；可用服务地址/虚拟办公室地址，不必公开住址 |
| `{{EFFECTIVE_DATE}}` | 生效日期 | 四份文本统一 |
| `{{ICO_REGISTRATION}}` | ICO 登记号 | 先用 ICO 自评工具确认是否需缴数据保护费；免缴则改写为“not required to register” |
| `{{SUPPORT_RESPONSE_TIME}}` | 支持回复时限 | 建议 “3 working days” |
| `{{ANALYTICS_RETENTION}}` | 分析事件保留期 | 建议 “13 months” |
| `{{DELETION_RECEIPT_RETENTION}}` | 删除回执保留期 | 须与生产配置 `RETENTION_POLICY_JSON.deletionReceiptDays` 一致 |
| `{{LOG_RETENTION}}` | 服务器日志保留期 | 建议 “30 days”，须与腾讯云/Cloudflare 实际设置一致 |
| `{{BACKUP_RETENTION}}` | 备份覆盖周期 | 建议 “35 days”，须与实际备份策略一致 |

## 需要法律或 Owner 确认的要点

| 项目 | 需要确认 |
| --- | --- |
| 韩国存储 | 正式 API 与 PostgreSQL 在腾讯云首尔（2026-10-29 Owner 决定）。依据为《The Data Protection (Adequacy) (Republic of Korea) Regulations 2022》（英国对韩国的数据桥，2022-12-19 生效）。需确认：腾讯云签约主体及其所在地（可能不是韩国实体）、其员工是否会从第三国远程访问、处理者条款（UK GDPR 第28条）是否已在服务协议中 |
| 其他供应商 | Cloudflare（DNS 与代理，流量经其全球网络、TLS 在边缘终止）、Auth0/Okta（UK 租户，美国公司）、Resend（爱尔兰发信区域，美国公司）、Google Maps Platform（iOS 地图 SDK 直接连 Google，Google 依其隐私政策处理）。逐一确认 DPA、子处理者、传输机制（UK IDTA／UK Addendum／UK-US 数据桥认证）后再定稿“International transfers”段 |
| 处理依据 | 分析按同意；PECR 对设备端存储/读取的要求仍按同意处理（《2025年数据（使用与访问）法》的统计豁免生效情况待核）。问卷与私密评分按合法利益，需做简短的合法利益评估（LIA）留档 |
| 举报处理 | 2026-10-29 Owner 决定以自动处理为主，已实现（规则见[接手计划 §8](../delivery/claude-takeover-plan.zh-CN.md)）：举报人立即看不到被举报内容、7 天内 2 名不同成员举报自动限制、自动回执、30 天无处理自动关闭（限制保留）、每日摘要邮件、后台一键处置（维持/解除限制、移除内容、取消饭局、停用/恢复账号）。文本写明“自动限制可撤销、停用由人决定”，避免 UK GDPR 第22条纯自动决定问题；警告功能未实现，条款不写 |
| 安全记录保留 | 2026-10-29 Owner 决定：安全记录保留 12 个月后删除，已实现并写入隐私通知（不再是占位符）。成员删除账号时，与其有关的个案（举报其本人/其饭局/其消息，以及其提交的举报）不再立即抹除，而是登记保留（`safety_record_holds`）：举报文字、个案、员工备注及前后状态、审计原因，以及被举报内容的副本（资料文字、饭局标题与描述、被举报消息前后各 3 条中其本人的发言；不保留头像）。只有领取了个案的支持人员可见。worker 在“删除时间”与“个案最后关闭时间”两者较晚者起满 12 个月后清除（`RETENTION_POLICY_JSON.safetyRecordDays`，默认 365）；未关闭的个案不清除（有举报的个案 30 天自动关闭）。删除者提交的举报保留举报人的账号编号（删除后该账号已无邮箱、资料与登录方式，只用于“不同举报人”计数）。删除状态页不逐人说明是否有保留记录（避免向被调查者透露被举报），完成后统一提示“部分记录按隐私通知限期保留”。双方账号都未删除时，举报记录随账号保留，尚无固定期限，需要时另行决定 |
| 24 小时承诺 | Apple 对 UGC 应用通常要求“24 小时内处理举报”。条款写为“aim to review within 24 hours”，个人运营需确认能做到（每日摘要＋手机提醒） |
| Online Safety Act 2023 | Fancy 属于用户对用户服务（U2U）。需完成并留档：非法内容风险评估、儿童访问评估（18+ 但仅自我声明）、举报与申诉流程。条款第7节已写申诉入口。两份评估草稿与待办见下方“Online Safety Act 记录” |
| 年龄 | 只有自我声明（资料补全页勾选 18+），无证件核验。若儿童访问评估要求“高效年龄保证”，需另行设计 |
| 责任限制 | 免费服务上限 £100、不排除人身伤亡/欺诈责任、消费者法定权利不受影响；请律师按《2015年消费者权利法》复核公平性 |
| 投诉 | 写了“30天内确认收到投诉”，对应《2025年数据（使用与访问）法》新增的投诉处理要求，需核对生效时间与具体义务 |
| 照片 | 2026-10-28 决定允许上传本人照片（偏离 PRD r07 样例头像），不做预审核；隐私通知已写明公开范围、元数据清除与删除方式 |
| AI | 本版关闭（`ASSISTANT_ENABLED=false`，生产 `AI_PROVIDER=disabled`）。启用前必须更新隐私通知（DeepSeek 角色、所在地、留存与训练用途、传输机制） |

## Online Safety Act 记录（2026-10-29 草稿，非法律意见）

两份英文记录草稿：[非法内容风险评估](online-safety-illegal-content-risk-assessment.draft.en.md)、[儿童访问评估](online-safety-childrens-access-assessment.draft.en.md)。依据为 Ofcom 风险评估指南 v2.0（2026-06-25，优先非法内容由 17 类改为 18 类：新增 cyberflashing，自伤并入自杀类）、Register of Risks、2026 年修订的用户对用户非法内容守则（Codes）、儿童访问评估指南和高效年龄保证指南。起草时无法直接访问 ofcom.org.uk，标注“verify”的守则适用范围须在签署前对照当时生效的版本核对。

| 项目 | 结论与 Owner 要做的事 |
| --- | --- |
| 风险结论 | 暂定“多风险”（multi-risk）：骚扰／跟踪／威胁和 CSEA 诱骗（grooming）为中风险，其余为低或可忽略。小型服务若为多风险，适用的守则措施多于“低风险”（内部审核政策、处理目标、按严重程度排序、人手、培训、申诉流程等） |
| 签署 | 由 Owner（运营者法定姓名）作为 ICU A2 指定负责人审阅并签署两份记录。建议把签署作为上架前的门槛；新服务首份评估的法定期限见 OSA 附表 3（待核实） |
| 年龄保证是否必须 | 法律上不强制：Fancy 不含色情内容，且儿童访问评估暂定“儿童用户条件不满足”。但自我声明不属于高效年龄保证，第一阶段结论只能是“儿童可以访问”；未登录也能浏览饭局和公开资料。Owner 须在 A（接受暂定结论，附监测条件，上线 3 个月内用真实数据复评）、B（注册时接入高效年龄保证，可把 grooming 降为低风险）、C（按儿童可访问处理，做儿童风险评估并适用儿童保护守则）中选择；草稿建议 A，并提示 B 对线下见面场景保护最强 |
| 需改产品（上架前） | ① 新增举报原因“可能未满 18 岁”及处理规则；② 举报原因分级，高危举报即时提醒（接手计划 §8.5 待决项）；③ 群聊单条消息举报（另一 Agent 并行开发中，完成后同步条款与社区规则措辞）；④ 未登录访客的公开饭局／资料页提供邮件举报入口；⑤ ~~被举报成员删除账号时举报文字和处理备注被立即清除~~：已完成（2026-10-29，安全记录保留 12 个月，见上表“安全记录保留”） |
| 需改产品（3 个月内） | 公开评价（reference）不能直接举报，需新增举报对象或书面说明“举报作者”即可覆盖 |
| 需写的内部文件 | 一页内部审核政策（按 Ofcom Illegal Content Judgements Guidance 判定、CSAM 处理与上报 IWF/NCA/警方、取缔组织账号、人身威胁报警）；投诉与申诉流程（受理时限、决定时限、记录）；Owner 缺席时的值守安排；自学培训记录；每季度回顾举报数据 |
| 条款补充 | 使用条款第 7 节补一句“不使用主动检测技术，举报＋人工复核，自动限制可撤销”（条款正由另一 Agent 修改，待其完成后再加） |
| 复评 | 上架前签署；上线 3 个月内；此后至少每 12 个月；重大功能变更前（聊天图片、无共同饭局的私信、搜人、付款、开启 AI、扩城或放宽年龄门槛等）；出现 CSAM／诱骗举报、确认未成年账号、警方或 Ofcom 联系，或 Ofcom 更新守则时 |

## 代码事实核对（2026-10-29）

文本依据当前实现：Auth0 邮箱验证码与 Google/Apple 登录（`identities`、`private_contact` 只存邮箱与提供方标识）；资料字段（`packages/contracts/src/dto.ts` 的 `Me`/`PublicProfile`，生活状态不公开）；头像上传（`apps/api/src/profiles/avatar.ts`，重新编码去元数据）；饭局、申请、群聊/私聊、出席与反馈、屏蔽、举报（迁移 0006–0014）；可选分析（`apps/ios/src/analytics/allowlist.ts`，事件白名单，无文本、无位置，每次会话随机 ID）；邮件模板（`apps/worker/src/mail/delivery.ts`：批准/拒绝/过期/饭局取消/删除受理/删除完成）；删除流程（`apps/api/src/deletion/routes.ts` 受理时取消本人主持的未来饭局、退出席位与会话；`apps/worker/src/handlers/deletion.ts` 删除资料、照片、邮箱、问卷、评分、分析、会话并替换消息与申请文本，保留无身份的参与事实；与其有关的举报个案由 `holdSafetyRecords` 登记保留，`purgeExpiredSafetyRecords` 到期清除，见 `apps/api/src/support/privacy.ts`）。

已知差距：iOS 群聊尚无“举报单条消息”入口（契约支持 `MESSAGE` 目标），文本改为“举报发言的成员”；见 App Store 提交材料的风险表。

## 官方参考

- [ICO privacy information requirements](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)：告知要素；该指南正因法律更新复核，发布前再核查。
- [ICO special category conditions](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)：特殊类别数据条件；当前不收集，但简介等自由文本可能含有。
- [ICO international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/)：充分性认定与 IDTA。
- [Apple App Review Guidelines 1.2 / 5.1.1](https://developer.apple.com/app-store/review/guidelines/)：UGC 过滤、举报、屏蔽、联系信息；隐私政策与账号删除。

## 验证

`tests/test_legal_pages.py` 检查：网页与草稿同步、草稿横幅、占位符清单与本表一致、不含邮箱地址或密钥形态的字符串、隐私通知包含韩国数据桥与供应商清单。这些检查不代表法律签核或服务联调完成。
