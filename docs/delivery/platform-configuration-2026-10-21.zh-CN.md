# Fancy 平台配置交接

记录日期：2026-10-21（Europe/London）。本会话负责平台账号与安全配置，不接管PRD、Demo或其他开发会话的业务实现。配置成功、真实联调成功和发布批准分别记录。

## 资源与状态

| 平台 | 资源 | 当前证据与边界 |
| --- | --- | --- |
| Cloudflare | fancyabite.uk | 已注册一年，到期2027-10-21；控制台显示自动续费已开启，未更改此设置；网站暂无A/AAAA/CNAME部署记录 |
| Resend | mail.fancyabite.uk；Ireland eu-west-1 | 已按用户明确授权添加以下3条记录，公开DNS查询均可解析；Resend 22:05 BST显示verified、Forge Enabled和域名可发信；未启用收信或打开/点击追踪 |
| Google Cloud | fancy-512319 | 已确认项目存在；用户确认账单已关联；控制台显示试用状态。地图API和凭据待明确授权后配置，不升级付费账号 |
| Auth0 | fancy-dev；UK | 用户已建立租户；Chrome控制台要求登录，等待用户本人登录；应用、连接及凭据尚未核验 |
| Apple Developer | 个人发布主体 | 用户已付款，等待Apple审核；未创建正式Bundle ID/签名/Apple登录配置 |
| DeepSeek | 本机DEEPSEEK_API_KEY | 本机.env配置非空、权限0600；本轮不输出密钥、不发起模型调用；模型/价格/数据/预算门槛仍须真实核验 |

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

## 尚需完成的验收

受限Resend发信Key及Auth0邮件配置；Google两个API、分别受限的Key与Map ID；Auth0精确回调、邮箱OTP与Google真实登录；Apple审核与签名；邮件真实投递/去重/退信；地点许可与署名、AI数据/费用验证；正式域名TLS/托管。未经用户明确授权不发测试邮件，不把本地凭据准备当作生产上线。
