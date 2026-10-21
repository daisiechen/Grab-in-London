# Fancy 平台配置交接

记录日期：2026-10-21（Europe/London）。本会话负责平台账号与安全配置，不接管PRD、Demo或其他开发会话的业务实现。配置成功、真实联调成功和发布批准分别记录。

## 资源与状态

| 平台 | 资源 | 当前证据与边界 |
| --- | --- | --- |
| Cloudflare | fancyabite.uk | 已注册一年，到期2027-10-21；控制台显示自动续费已开启，未更改此设置；网站暂无A/AAAA/CNAME部署记录 |
| Resend | mail.fancyabite.uk；Ireland eu-west-1 | 3条DNS已公开解析；22:05 BST显示verified/Forge Enabled。已创建单域名Sending access Key并按用户确认保存到Auth0。未启用收信或打开/点击追踪 |
| Google Cloud | fancy-512319 | 项目及账单已确认，维持试用状态。已核对仅启用Maps JavaScript API和Places API (New)；独立Web/Server Key及Web Map ID就绪；自有Google OAuth已创建、接入Auth0，保持测试模式 |
| Auth0 | fancy-dev；UK | fancy-dev.uk.auth0.com；已建Fancy Development BFF（Regular Web Application），精确回调及Authorization Code/Passwordless OTP已保存；Resend供应商、邮箱OTP及Google连接已配置 |
| Apple Developer | 个人发布主体 | 用户已付款，等待Apple审核；未创建正式Bundle ID/签名/Apple登录配置 |
| DeepSeek | 本机DEEPSEEK_API_KEY | 本机.env权限0600；官方/models认证通过，可见deepseek-flash、deepseek-v4-pro；未提交提示词，AI_PROVIDER=disabled，模型/价格/数据/预算门槛仍须真实核验 |

## 已添加的DNS

| 类型 | 相对fancyabite.uk的名称 | 内容 | 代理与TTL |
| --- | --- | --- | --- |
| TXT | resend._domainkey.mail | 由Resend当前界面给出的DKIM公钥，全文不在交接中复制 | DNS Only；Auto |
| CNAME | rsend.mail | rsend-euw1.forge.rmta.net | DNS Only；Auto |
| CNAME | send.mail | send.forge.rmta.net | DNS Only；Auto |

记录均手动添加，未授予Resend整个Cloudflare账号的DNS访问权限；未修改主域MX、DMARC、网站记录或支持邮箱收信设置。DNS公钥不是API密钥；真实API凭据仍不进入公开仓库。

## 开发会话使用方式

- 根目录.env受Git排除，是本机已授权配置真源；不要cat/打印其内容、复制到聊天或提交Git。仅检查所需键存在，程序从环境读取。
- 当前API入口读取process.env，不自动加载.env；运行时需显式使用兼容Node版本的`--env-file=.env`或已有安全加载机制，不能因为文件存在就声称运行进程已配置。
- 后端需要AUTH0_DOMAIN、AUTH0_CLIENT_ID、AUTH0_CLIENT_SECRET及GOOGLE_MAPS_API_KEY；浏览器只允许单独的VITE_PUBLIC_GOOGLE_MAPS_KEY和VITE_PUBLIC_GOOGLE_MAPS_ID，配置在被Git排除的apps/web/.env.local，不复用后端密钥。
- 当前Web OAuth回调由代码生成`WEB_ORIGIN/auth/callback`；支持CLI使用`WEB_ORIGIN/v1/auth/oauth/callback`；iOS使用IOS_REDIRECT_URI。配置精确允许列表，不使用任意域通配回调。
- iOS当前Bundle ID还是com.example.fancy.dev占位符；Apple审核通过后再统一正式标识、Google iOS密钥限制、签名与回调，不能假定已完成。
- Worker正式入口当前注入UnavailableMailProvider。Resend域名或Key就绪不意味着业务邮件已接线；代码责任会话须实现供应商发送、幂等、UNKNOWN查询/恢复、回调和真实收件验收。
- Auth0身份撤销/Apple撤销及运营MFA同样有独立接入门槛；创建登录应用不授予删除管理API或运营角色。
- 真实DeepSeek调用仍受[人民币预算决策](../engineering/decisions/ai-cny-budget.md)与[接入核查](../engineering/decisions/deepseek-readiness.md)约束；不因账号配置授权而取消模型/数据/费用门槛。

## 已保存的开发配置

根目录.env保存AUTH0_DOMAIN、AUTH0_CLIENT_ID、AUTH0_CLIENT_SECRET、GOOGLE_MAPS_API_KEY、RESEND_API_KEY、RESEND_FROM、SUPPORT_EMAIL、GOOGLE_OAUTH_CLIENT_ID、GOOGLE_OAUTH_CLIENT_SECRET及原有DEEPSEEK_API_KEY。apps/web/.env.local保存VITE_PUBLIC_GOOGLE_MAPS_KEY、VITE_PUBLIC_GOOGLE_MAPS_ID；两文件均0600、Git忽略，实际值不进入本文。

开发默认值：ENVIRONMENT=development、AUTH_ADAPTER=auth0、PLACES_ADAPTER=google、MAIL_ADAPTER=provider、AI_PROVIDER=disabled、WEB_ORIGIN=http://127.0.0.1:5174；SESSION_SECRET仅在缺失时安全生成。DATABASE_URL未编造，须由接入会话提供本地隔离PG17配置。不会因这些默认值而自动启动或启用真实业务邮件/AI。

| 项目 | 配置 |
| --- | --- |
| Web Map ID | 5e6d065159e3a613430851e8；JavaScript/Vector；Fancy Web Map |
| Web地图Key | Fancy Maps Web Development；仅Maps JavaScript API；仅http://localhost:5174/*、http://127.0.0.1:5174/*、https://fancyabite.uk/* |
| Server地点Key | Fancy Places Server Development；仅Places API (New)；本机开发阶段尚无固定出口IP限制，不能直接当作生产凭据部署 |
| 发信 | Fancy <noreply@mail.fancyabite.uk>；仅mail.fancyabite.uk的Sending access Key；Auth0经明确确认持有同一受限Key |
| Auth0应用 | Fancy Development BFF；Authorization Code与Passwordless OTP；Implicit/Password/Client Credentials/Refresh Token授权关闭，业务会话由核心服务维护 |
| 邮箱OTP | email连接绑定Fancy应用，6位/300秒，允许注册，不提升为租户全局连接；Fancy应用关闭Username-Password-Authentication，仅开放email与google-oauth2 |
| Google OAuth | Fancy Auth0 Development，Web客户端；Google回调仅https://fancy-dev.uk.auth0.com/login/callback；Auth0 google-oauth2已存项目自有凭据，仅基础资料/邮箱，无日历/邮件/离线访问范围 |
| OAuth受众 | 外部/测试状态，仅本人两个已配置Google测试账号；具体邮箱只在平台及私有配置，不进公开仓库。Google测试同意页支持邮箱目前用项目账号，开发通知用用户指定支持地址；生产发布前调整并复核 |

Auth0回调允许列表是以下三个源各自的/auth/callback与/v1/auth/oauth/callback：http://127.0.0.1:5174、http://localhost:5174、https://fancyabite.uk。Logout和Web Origins同样仅这三个源；不包含通配域或未批准深链。站点DNS/TLS尚未部署，正式域名回调配置不代表网站已上线。

Node启动示意：先由运行会话提供DATABASE_URL，再使用`node --env-file=.env apps/api/src/main.ts`；API仍需项目既有依赖及Node24。继承环境变量优先于env文件，若先运行infra/dev-env.sh，须核对其测试适配器变量是否覆盖本文件。开发会话不得直接把安全配置原样复制到客户端、GitHub或日志。

## 当前验证证据

- 公开DNS查询：3条与Resend当前界面记录一致，Resend最终verified。
- Auth0公开OIDC发现文档：issuer与UK租户匹配；应用回调及授权类型经新页面重读确认保存。
- Google Places官方API：真实合成餐厅查询成功，返回结构化结果；未保存提供方餐厅内容。最初异步剪贴板复制造成错误值，出现HTTP400；改为核对平台显示值后通过，后端与浏览器密钥格式和不相同断言通过。
- DeepSeek官方/models认证通过；没有模型生成、质量、延迟、价格或数据留存验收。
- Auth0 Email Provider测试按钮直接发送到租户主邮箱，Resend显示delivered；它不证明用户指定支持邮箱已收到。自动审批拒绝未经新增确认的第二封测试邮件，已另向用户请求指定收件人的补发授权。
- 本机两份配置权限0600、无重复键、全部接入键存在；git check-ignore确认均排除。公开截图不保存私人邮箱/凭据；临时本机截图仅供本会话核查。

## 尚需完成的验收

跨端邮箱OTP及Google登录完整回流、PKCE及身份映射；Apple审核/正式Bundle ID/签名/Apple登录与授权撤销；业务Worker的Resend发送/UNKNOWN恢复/去重及退信webhook；地点字段许可、署名、照片策略和地图真实页面；Google预算/配额和部署固定出口IP限制；DeepSeek固定模型/价格/计数器/数据处理与预算/质量验证；本地数据库、正式域名TLS/托管及隐私政策审核。账号平台配置不关闭所有G-AUTH/G-PLACES/G-MAIL/G-AI发布门槛。
