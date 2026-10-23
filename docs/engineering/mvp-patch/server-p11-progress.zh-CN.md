# P1.1 消息与推送服务端进度

## 范围与负责人

用户已授权后台会话接手 Claude 后续开发，并在客户端会话选择由现有后台会话承接 P13–P16。基于冻结方案 [plan.zh-CN.md](plan.zh-CN.md) §7–§8，采用增量接口、存储和 worker；PATCH-006 管理后台验收结论见[独立报告](../../reviews/admin-p11-development-acceptance-2026-10-23.zh-CN.md)。当前文档只记录工程状态，不改写 PRD、Demo 或冻结方案。

| 唯一负责人 | 文件边界 |
| --- | --- |
| 后台 | `packages/contracts/src/messaging-dto.ts`、`operations/messaging.ts`、registry、operation 路径解析与 OpenAPI 生成器；统一生成 `packages/contracts/generated/openapi.json` 和 `packages/client/src/generated/operations.ts` |
| 后台 | `packages/db/migrations/0027+`、对应 Drizzle schema/index；API conversations、notification-settings、push 和必要 membership/session 撤权接点；worker push 与对应测试 |
| 客户端 | `apps/web/`、`apps/ios/`、client 手写 share/intents，以及 tasks.json；不同时写服务端或运行契约生成 |

共享手写客户端 HTTP 文件若需要改动，先交接具体文件。现有 admin 与 P03 receipt 实现继续保留。每片完成验证后提交并核对远程，客户端按固定提交集成。

## P13 接口切片

新增七项 operation，沿用现有 envelope、结构化错误、CSRF、认证和分页机制：

| operation | 实际路由 | 协议 |
| --- | --- | --- |
| sendGroupMessageV2 | `POST /v2/conversations/{conversationId}/messages` | body/clientMessageId/mentions/draftId；资源键去重、payload hash 冲突 409 |
| readGroupMessagesV2 | `GET /v2/conversations/{conversationId}/messages` | 与 v1 相同 HISTORY/LIVE 授权区间、cursor 和 throughSeq 语义 |
| mentionCandidates | `GET /v1/conversations/{conversationId}/mention-candidates` | q/cursor/limit；当前可写群成员；everyone 仅群主 |
| getConversationNotificationSettings | `GET /v1/conversations/{conversationId}/notification-settings` | `{muted, version}`，缺省 false/version 0 |
| putConversationNotificationSettings | `PUT /v1/conversations/{conversationId}/notification-settings` | body muted、If-Match、Idempotency-Key；冲突后刷新 |
| registerPushSubscription | `POST /v1/me/push-subscriptions` | installationId/platform/tokenOrEndpoint/keys/environment/appBuild；当前 actor/sessionFamily 绑定 |
| deletePushSubscription | `DELETE /v1/me/push-subscriptions/{subscriptionId}` | 自有订阅撤销、Idempotency-Key |

v2 DTO 在旧 Message 字段上增加有效 mentions 及 `warnings.droppedMentionIds`（userId 数组）。偏移为 Unicode code point 半开区间；输入 body 原样保留，实体最多 100 个。凭据只写不回传；注册返回 subscriptionId/version/platform/environment/createdAt。

路径版本统一由 operationPath 解析，避免产生 `/v1/v2/...`，旧操作默认 v1。当前提交只完成接口契约与生成物，尚未注册七项新服务处理器，不能作为 P13–P16 完成或客户端可调用的证明。

## 授权与交付设计

复用现有会话行锁、membership_intervals 和消息序号内核。每个成员授权区间的不可变 ID 可作为该次入群的授权 epoch，退出后旧事件永久撤销；重入群产生新区间，不恢复旧推送。群级 epoch 与溶解边界同事务维护。发送、撤权与 worker provider 前置检查须遵守相同锁序并测试退出/重入群/延迟队列组合。

普通消息只影响未读，不逐条创建站内提醒；提及提醒去重并与消息同事务。推送使用独立持久事件和 per-subscription delivery；1 小时 TTL、最新静音/已读/会话与用户授权检查、UNKNOWN 不盲目重发。真实 provider 默认关闭，使用 fake provider 验证；真实设备、凭据、域名及发布仍是独立门槛。

## 已提交切片与验证

- `f097039`：客户端 RequestOf 在完整 operation 上先分发，再组合 Params/Query/Body/Key/IfMatch，避免新增接口后 TS2590；HTTP 编码实现和公开泛型调用签名未改。通用请求相关性测试独立保留。
- `8a44f49`：七项契约、统一版本路径、OpenAPI 与生成 SDK 元数据。contracts 单元测试 59 项；合并客户端原有回归与新类型/消息编码共 5 文件 77 项通过。
- `88bef0e`：0027 增量存储、Drizzle 镜像及事务撤权触发器。迁移/列一致性/订阅唯一/登出与账号撤权共 2 文件 14 项 DB 测试通过，独立本地 PostgreSQL，无真实 provider。

完整 core:check 通过（全 workspace 类型检查、infra 类型检查、生成物漂移、ESLint、公开秘密扫描）；文档和现有 Python 94 项验证通过。切片推送后分别 fetch 并核对本地/远程 SHA 一致。

API 业务处理器、成员退出/重入群与 worker 完整组合测试、订阅加密和 SSRF 防护尚待实现；不得将存储触发器或契约通过记为 P13–P16 或端到端完成。
