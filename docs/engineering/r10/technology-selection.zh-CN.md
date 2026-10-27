# r10 技术选型：复用现有工程，按版本交付

2026-10-27（Europe/London）。作者职责：RD架构准备。**本文件是建议与执行约束，不是功能实现、Figma Ready、真实服务通过或上线批准。** 本轮未安装依赖、启动服务、连接业务数据库、读取凭据或外呼供应商。

用户已确认保留MVP Demo的视觉与交互，产品继续iOS App＋管理后台；host自行联系餐厅、到店各付。移动Web前台、平台订位、订金/支付/退款后置。Demo源码只能作为视觉/交互参考，旧模拟交易不因被展示而进入首发。

## 1. 可核对的输入与事实

- 当前读取基线为`f344c8d5a682f66ffe18c867977619ea91b7456f`；准确文件SHA256见[input-manifest.json](input-manifest.json)。
- 视觉来源为`demo/qa/picker-refinement-2026-10-21/release.json`记载的MVP Demo v13，对应GitHub应用提交`361ab04ed6fc55c0f1e041bb5d6cc5d216d1a7b2`。这不等于当前生产App或后端的实现基线。
- 当前主分支已经存在`apps/ios`、`apps/admin`、`apps/api`、`apps/worker`及`packages/contracts/client/db/config/assistant/testkit`。旧[核心方案](../core-development-plan.zh-CN.md)中“目录待创建”只属历史；其`packages/domain`目标目前不存在，不创建空壳目录以符合旧图。
- 封存、客户端补丁和后台补丁分别保留。补丁分支有主体分类修订与统计Ready关联等可复用候选，但未整体合入本轮，也未重跑其历史测试；不能按分支标题宣布复用成功。
- `apps/ios/app.json`仍是开发占位bundle与localhost API配置；不能拿它作为商店可用包、正式签名或公网服务的证明。

## 2. 推荐组合与取舍

下列版本是**现有manifest声明值**，不是本次验证过的兼容组合，也不宣称为最新版本。锁文件与package.json一致性、实际安装、原生依赖及构建必须在后续同一候选上验证；本轮不升级依赖。

| 层 | 选用方向／现有值 | 未选方案及理由 | 进入实现前的局部核对 |
| --- | --- | --- | --- |
| iOS | 保留React Native＋Expo开发构建、Expo Router；manifest Expo 58.0.16 / RN 0.88.0 / React 19.3.0 | 暂不改为SwiftUI整套重写，也不套WebView。既有身份、安全存储、消息、地图及测试资产可沿用；网页DOM/CSS与手机模拟键盘不移植到原生 | 对照对应Expo SDK矩阵运行依赖检查，核原生地图、身份回调、secure-store、键盘/安全区；以匹配Figma的真实iOS构建验证。Linux可检查TS/组件，不代表能签名或设备验收 |
| 后台 | 保留React DOM＋Vite；React19.2.7 / Vite8.3.4 / TS5.9.3声明 | 不另建Next.js SSR层、移动前台或客服平台；内部脱敏查询无需先引入SSR | 日期/locale/URL、抽屉焦点、长表滚动以及1440/1024/864/390代表布局按现行契约验证 |
| 服务端 | Node24＋TypeScript＋Fastify5；manifest Fastify5.12.7 | 不拆微服务，不迁Nest/GraphQL。现有HTTP schema、鉴权与命令封装可复用，事务在同一权威服务完成 | 锁定Node与pnpm工具链，核schema输入/白名单响应、鉴权、If-Match、幂等和错误Envelope；不将类型通过当授权正确 |
| 数据 | PostgreSQL17＋pg8.23.1＋Drizzle0.45.4；现有本地compose固定17.11 | 不改客户端直写BaaS，也不引Redis/Kafka来补事务。名额、删除屏障、联系授权、修订和快照需要同一DB权威 | 确认目标数据库实际主版本、迁移head、约束/锁/恢复；本地compose含关闭持久化安全选项，仅用于隔离测试，不能原样部署生产 |
| 接口共享 | 保留TypeBox schema→OpenAPI与客户端元数据生成，使用`@fancy/client` | 不给iOS、后台各造一套DTO/错误/重试，不让前端业务模型直接序列化为API | 单writer更新schema与生成物，`check:generated`验证；App布局组件与DOM组件分开，复用语义tokens而非强行跨端复用UI |
| 作业与通知 | API＋worker两个进程，同库持久job/outbox、租约；站内事实与关键邮件分开 | 不先建队列平台、WebSocket、presence或移动Web Push；群/私聊首发用HTTP＋可见前台增量轮询 | worker/重复执行/UNKNOWN处理单独验证；退群区间撤销在业务事务内，不依赖异步任务及时赶到 |
| 身份 | 沿用已规划/已有Auth0适配与业务自持userId/session；邮箱OTP/Google/Apple | 不自建密码库，不按相同邮箱自动合并；不因技术选型重开已确认产品登录入口 | 租户、套餐、地域、SMTP、真实回调/PKCE与身份链接逐项核证；迁移记录的discovery200只证明可访问元数据，不证明登录全链 |
| 地图与餐厅 | 沿用Google Maps/Places，iOS原生地图适配，server校验placeId/投影 | 不把示意地图当真实Google数据，不从店名推断菜系/饮食，不新增餐厅库存系统 | 字段/缓存/图片署名/地图呈现许可与真实凭据限制；保留无结果、失败、缺图/署名状态，不用其他店照片补齐 |
| AI | 继承DeepSeek、有限白名单上下文、人工转入/提交；已有`packages/assistant`及API kernel | 不恢复旧OpenAI默认、不加自治Agent/工具执行、不把聊天/举报/私密意愿送模型 | CNY50/月应用准入硬闸、价格/model配置、数据许可、token上界、质量/延迟和账单对账仍分别取证；未批准配置保持关闭，普通找饭/偏好删除继续可用 |
| 邮件 | 沿用Resend适配＋本地事务outbox/dispatch记录 | 不因有Key就发送测试邮件，不以提供方短期幂等替代应用稳定事件去重 | 原次查询/重放边界、域名与发送配置、真实接收结果另验。官方幂等记录24小时，不可推成永久“恰好一次” |
| 托管 | 优先复用用户已有腾讯云首尔计算资源；API/worker按独立进程部署，Postgres持久存储/备份单列 | 不另开云账号/区域、不把Sites静态Demo当生产API托管、不复制本地测试compose到生产 | 域名/HTTPS/网络、备份恢复、进程配置、数据驻留与密钥管理须有具体部署方案及实际批准；本轮不部署 |

RN与后台声明的React版本不同，暂不强行统一。原生SDK兼容与浏览器生态分别验证；共享SDK只包含平台无关数据/协议。若兼容核对失败，记录精确依赖组合、复现与最小修正ADR，不把“升级全部包”作为默认环境修复。

## 3. iOS路线决定的范围

本轮建议继续原生React Native实现，以MVP Demo的同状态截图、UX组件规范和手势/安全区契约核对视觉，不以“跨端框架限制”自行改版。确有原生系统能力差异时，先在当前模块记录差异，再用Swift/原生模块作局部适配；只有真实原型/性能证据证明现路线无法满足要求时，才评估整套SwiftUI替换及其迁移成本。没有把未来Android作为本轮产品范围。

## 4. 已批准决定与未验证项分开

- DeepSeek选择、应用CNY50/月上限、偏好soft/hard/CLEAR、host声明、外订各付等沿用既有用户决定；不重新索要同一批准。
- [CNY预算决定](../decisions/ai-cny-budget.md)覆盖旧AI方案的microUSD/OpenAI默认文字。账本为整数microCNY，月硬上限50,000,000；UNKNOWN保留责任，无自动重试/充值。本文不引用旧价格作为可启用价格，也不新增外呼额度。
- Auth0/Maps/邮件/Apple签名及生产政策等门槛只说明待验，不冒称账号不存在或要求重建配置。既有迁移记录证明保留过配置，不证明业务真实通过；不读取秘密来“盘点”。
- 正式依赖升级、服务采购/额度、真实删除/外部发送、部署等不由本轮技术建议自动授权。

## 5. 官方依据与检查效力

以下页面于2026-10-27只读访问，用于验证接口原则；不是特定账户、SDK组合或生产SLA证书。未复制长段原文。

- [Expo库兼容方法](https://docs.expo.dev/workflow/using-libraries/)：依赖需与对应SDK/RN兼容，不能把任意npm版本视为可直接使用。
- [React Native平台代码](https://reactnative.dev/docs/platform-specific-code)：允许平台专用实现；不要求拿DOM组件冒充原生组件。
- [Fastify输入/响应Schema](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)：schema用于请求验证与响应序列化；实际schema来自固定源码而非用户输入。
- [PostgreSQL17显式锁](https://www.postgresql.org/docs/17/explicit-locking.html)：显式行锁支持应用级并发控制，业务锁序和有效时点仍由本项目契约规定。
- [Auth0 Expo集成](https://auth0.com/docs/quickstart/native/react-native-expo)：说明有原生集成方向；不证明已购套餐、嵌入OTP和本项目回调已可用。
- [Google Places政策](https://developers.google.com/maps/documentation/places/web-service/policies)：placeId与其他内容的缓存权利不同，地图/Logo/第三方署名有适用要求。
- [Resend幂等](https://resend.com/docs/dashboard/emails/idempotency-keys)：记录有时间窗口，应用不能在UNKNOWN后盲目重新发送。
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)：接口文档不替代当前具体model/价格、数据条款及账户能力核证。
