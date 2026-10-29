# Fancy policy drafts and release review

2026-10-21：用户授权起草英文隐私通知和社区规则，发布主体为个人。本文档不修改PRD或Demo，不构成政策已批准、已接入、已发布或真实数据处理已验收。

- [Privacy notice draft](privacy-notice.draft.en.md)
- [Community guidelines draft](community-guidelines.draft.en.md)
- 权威业务边界：[主PRD §0](../product/PRD.zh-CN.md)、[AI方案](../engineering/ai-development-plan.zh-CN.md)。条款不反向覆盖业务规则。

## 申请进度

按用户本轮报告：Google Cloud项目已创建且账单已关联；Apple Developer已付款等待审核；Auth0 UK开发租户已建立；DeepSeek Key已在本机保存。以上不是服务配置或真实联调通过证据。域名fancyabite.uk已购买一年；Resend已注册，mail.fancyabite.uk已完成DNS验证；平台配置状态见[交接记录](../delivery/platform-configuration-2026-10-21.zh-CN.md)。支持收件邮箱已私下提供，此公开仓库不保存个人邮箱或付款/身份资料。

Cloudflare已登录页面2026-10-21显示：fancyabite.uk首年及续费US$5.30，fancyabite.app首年US$8.20/续费US$14.20；价格为搜索页报价，最终以结账为准。推荐前者对应“Fancy a bite?”，末尾有e；此前输入的fancyabit.uk不等同于此候选；用户后续已确认购买fancyabite.uk一年。域名可注册不证明商标可用。

## 发布前必须关闭

| 项目 | 所需确认或证据 |
| --- | --- |
| 运营者 | 法定姓名、适用联络资料、最终公开支持地址、生效日期；不从账号昵称推断 |
| 处理依据 | 按目的确认合同/合法利益/同意，完成适用评估；饮食等可能揭示健康或宗教的信息需额外处理条件及交互，不能用接受隐私通知替代明确同意 |
| 保留与删除 | 分类期限、依据、备份到期/恢复删除、供应商清理、争议最小记录；与实际RETENTION_POLICY_JSON一致；不沿用未经批准的90天/12个月 |
| 供应商及跨境 | Auth0/Google/DeepSeek/邮件/托管的实际角色、接收数据、国家、合同、训练与留存、适用传输机制；UK租户不等于全链路UK存储 |
| AI | 应用30分钟会话边界不涵盖未验证的第三方留存；真实模型/数据/费用门槛关闭前不启用真实用户调用 |
| 用户权利 | 支持邮箱真实可收件，身份核验和请求响应流程，删除状态与实际清理一致；首期无导出按钮不取消权利请求 |
| Cookie与分析 | 实际存储清单、必要/可选区分、告知与同意/撤回及停采验证 |
| 举报与复核 | 负责人、查阅权限、可执行处理与复核路径；2026-10-29 起草稿“How reports are handled”只描述已实现的能力（举报人立即隐藏、重复举报自动限制、移除内容、取消饭局、停用/恢复账号、30天自动关闭），规则见[接手计划 §8](../delivery/claude-takeover-plan.zh-CN.md)；不承诺处理时限，警告功能未实现故已删去 |
| 发布核对 | 文案与首期功能一致，批准最终版本后由产出负责人接入注册及设置入口；另核对适用ICO登记/费用要求 |

## 中文审阅要点

隐私通知说明收什么、为什么用、谁可见、供应商与AI处理、保存删除、权利及投诉。社区规则说明18+、尊重边界、饭局与费用、隐私、饮食及线下安全、真实反馈、举报与复核。账号删除、私密评分、单方再约、游客可见范围按主PRD，不承诺背景审查或过敏安全。

## 官方参考

- [ICO privacy information requirements](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)：用于检查告知要素；该指南标记正在因法律更新复核，发布前再核查。
- [ICO special category conditions](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)：健康/宗教等额外条件；本稿不代替具体适用判断。

## 验证

内容校验须覆盖草稿状态、缺失字段、链接、隐私边界及公开仓库不含私人邮箱/密钥；不代表法律签核或服务联调完成。
