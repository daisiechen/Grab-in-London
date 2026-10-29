# Fancy iOS 首发 App Store 提交材料

记录日期：2026-10-29（Europe/London）。按 Owner 要求由开发方整理首发 App Store Connect（ASC）所需的全部填写内容与决策依据。面向用户的英文文案单独见 [App Store listing copy (English)](app-store-listing.en.md)；法律页面与占位符见 [政策文本与发布核对](../policies/README.md)。本文是提交准备，不代表 Apple 账号、签名、生产部署或审核已完成。

## 1. 需要 Owner 决定的事项

| # | 决定 | 建议 | 影响 |
| --- | --- | --- | --- |
| D1 | 正式 Bundle ID | `uk.fancyabite.app`（Owner 域名 fancyabite.uk 的反向 DNS；一旦在 ASC 建档不可更改） | 第 9 节列出的全部外部配置 |
| D2 | 审核员登录方式 | 方案 A：审核专用账号＋固定验证码（服务端白名单、仅审核期开启），配合方案 C（审核员可直接用 Sign in with Apple） | 需新增少量 API 代码，见第 7 节 |
| D3 | App 名称 | “Fancy: Meet Over a Meal”；名称全商店唯一，被占用时用备选 | ASC 建档 |
| D4 | 销售地区 | 首发仅英国 | 不在欧盟上架可暂不处理 DSA 交易者信息公开（需公开地址与电话） |
| D5 | 24 小时处理举报的承诺 | 写入条款（“aim to review within 24 hours”），依靠自动隐藏＋每日摘要＋手机提醒 | Apple 1.2 审核常见要求 |
| D6 | 相机权限文案 | 当前只用相册，建议把 `expo-image-picker` 的 `cameraPermission` 设为 `false` 再提交，避免出现未使用的权限说明 | 需重新构建开发版；本轮未改 |
| D7 | 法律页面占位符 | 填写法定姓名、支持邮箱、联系地址、生效日期、保留期等 | 见政策 README 占位符表 |

## 2. App 信息

| 字段 | 内容 |
| --- | --- |
| 名称 / 副标题 | 见英文文案（名称 ≤30 字符，副标题 ≤30） |
| 主类别 / 次类别 | Social Networking / Food & Drink。理由：核心是认识新朋友与群聊（社交），场景是餐厅聚餐 |
| 价格 | 免费；无 App 内购买、无订阅、无广告 |
| 版本号 | 提交前把 `app.json` 的 `version` 从 0.1.0 改为 1.0.0（本轮未改，避免影响开发构建） |
| 设备 | 仅 iPhone（`supportsTablet: false`），只需 iPhone 截图 |
| 隐私政策 / 支持 / 营销网址 | https://fancyabite.uk/privacy、https://fancyabite.uk/support、https://fancyabite.uk |
| EULA | 使用自有条款 https://fancyabite.uk/terms（含 Apple 要求的最低条款，见条款第 11 节），在 ASC“License Agreement”粘贴全文 |
| 版权 | © 2026 {{OPERATOR_NAME}} |
| 联系人（仅 Apple 可见） | Owner 本人姓名、电话、邮箱，在 ASC 填写，不进仓库 |

## 3. 年龄分级问卷（目标 18+）

依据主 PRD r07：成年人 18+、线下与陌生人见面。Apple 2025 年起的问卷按下表回答，计算结果会低于 18+，再使用 ASC 的“Age Rating Override → 18+”主动提高分级。

| 问题 | 回答 | 理由 |
| --- | --- | --- |
| Parental Controls（家长控制） | No | 无家长控制功能 |
| Age Assurance（年龄保证） | No | 只有资料补全页的 18+ 自我声明，没有证件或第三方年龄核验；如实回答 |
| Unrestricted Web Access | No | App 内浏览器只打开 fancyabite.uk 的法律页；“在地图中打开”跳转到地图服务，不提供通用浏览 |
| User-Generated Content | Yes | 资料、照片、饭局描述、申请留言、评价、聊天 |
| Messaging and Chat | Yes | 饭局群聊与双方互选后的私聊 |
| Advertising | No | 无广告 |
| Profanity or Crude Humor | None | App 自身内容不含；UGC 由社区规则与举报约束 |
| Horror/Fear Themes | None | — |
| Alcohol, Tobacco, or Drug Use or References | None | App 自身内容不涉及；餐厅聚餐不等于酒精内容。若 Owner 计划推广酒吧/饮酒场景，改为 Infrequent/Mild |
| Mature or Suggestive Themes | None | 明确是友谊场景，禁止性暗示 |
| Medical or Treatment Information | None | 饮食选项只描述饭局，不提供医疗信息 |
| Health or Wellness Topics | No | — |
| Sexual Content or Nudity / Graphic Sexual Content | None / None | 社区规则禁止 |
| Cartoon or Fantasy Violence / Realistic Violence / Prolonged Graphic Violence | None | — |
| Simulated Gambling / Gambling / Contests / Loot Boxes | None / No / No / No | — |
| Made for Kids | No | — |
| 最终分级 | Override 为 18+ | 面向成年人在线下与陌生人见面；与条款第 2 节、隐私通知“Age limit”一致 |

## 4. App 隐私（营养标签）

总答：**收集数据：是。用于跟踪（Tracking）：否**——无广告、无第三方分析 SDK、不与其他公司数据关联，不需要 App Tracking Transparency 弹窗。以下“关联身份”均为“是”，因为数据与 Fancy 账号绑定。

| 数据类型（Apple 分类） | 收集 | 用途 | 关联身份 | 跟踪 | 代码依据 |
| --- | --- | --- | --- | --- | --- |
| Contact Info → Email Address | 是 | App Functionality | 是 | 否 | `private_contact`；登录与服务邮件 |
| Contact Info → Name | 是 | App Functionality | 是 | 否 | 资料 `displayName`（通常是真实名字），公开显示 |
| User Content → Photos or Videos | 是（可选） | App Functionality | 是 | 否 | `avatar_images`；仅本人上传的头像 |
| User Content → Emails or Text Messages | 是 | App Functionality | 是 | 否 | 群聊与私聊消息 `messages`（Apple 定义含 App 内消息内容） |
| User Content → Customer Support | 是 | App Functionality | 是 | 否 | 举报 `reports`、支持邮件 |
| User Content → Other User Content | 是 | App Functionality、Analytics | 是 | 否 | 简介、兴趣、语言、背景、生活状态、饭局、申请留言、评价、出席、私密评分、再约选择、屏蔽、问卷（问卷与评分用于汇总分析） |
| Identifiers → User ID | 是 | App Functionality、Analytics | 是 | 否 | 账号 UUID；分析事件含 `user_id` |
| Usage Data → Product Interaction | 是（需同意） | Analytics | 是 | 否 | `analytics_events`，白名单事件（`apps/ios/src/analytics/allowlist.ts`） |
| Search History | 是（需同意） | Analytics | 是 | 否 | `analytics_discovery_requests.filters` 记录浏览筛选条件（片区、日期、预算等）；不记录自由文本 |
| Location（精确/粗略） | 否 | — | — | — | 无定位权限；IP 只做哈希限流，不推断位置 |
| Identifiers → Device ID | 否 | — | — | — | 分析用的 `anonymousId` 是每次会话的随机值，不是设备级标识；不读取 IDFA |
| Sensitive Info / Health / Financial / Contacts / Browsing History | 否 | — | — | — | 不收集；无支付 |
| Diagnostics | 见下注 | — | — | — | Fancy 自身无崩溃/性能 SDK |

注意：

1. **Google Maps SDK for iOS**（`react-native-maps` 的 Google provider）属于第三方 SDK，它自身收集的数据也要申报。提交前：用 Xcode Archive 生成 **Privacy Report**（汇总各 SDK 的 `PrivacyInfo.xcprivacy`），并对照 Google 官方的 Maps SDK for iOS App Store 隐私披露。按惯例预计需追加 Diagnostics（Crash Data、Performance Data、Other Diagnostic Data）及 Product Interaction（用途 App Functionality/Analytics，不关联身份）——以 Privacy Report 和 Google 文档为准。
2. Expo/React Native 使用 Apple 要求说明理由的 API（如 UserDefaults、文件时间戳）。若 Privacy Report 显示缺少 `NSPrivacyAccessedAPITypes`，在 `app.json` 的 `ios.privacyManifests` 中补充后重新构建。
3. 可选分析默认关闭，用户在登录后弹窗或设置页开启；营养标签仍需申报（Apple 要求申报“可能收集”的数据）。

## 5. 出口合规

`app.json` 已设 `ios.config.usesNonExemptEncryption: false`，ASC 不再逐版询问。依据：App 只使用 iOS 系统提供的标准加密（HTTPS/TLS、Keychain），不含自有或非标准加密算法，属于豁免。无需上传年度自分类报告或 CCATS；如将来加入自有加密需重新评估。

## 6. 内容权利

ASC 问“是否包含、显示或访问第三方内容”：**是，且拥有使用权**。

- 餐厅名称、地址、地图与照片：Google Maps Platform，按其服务条款展示并署名（照片署名已在 App 中显示，不长期保存提供方内容；`venues` 表只存 placeId 与片区）。
- 伦敦片区数据：ONS（OGL v3.0）与下议院图书馆（Open Parliament Licence v3.0），设置页“Data sources”及条款第 10 节署名，见[伦敦片区边界数据](../engineering/london-areas.zh-CN.md)。
- 用户内容：条款第 4 节取得展示所需的许可。
- 品牌插画与 App 图标：本项目原创（图标见第 10 节）。

## 7. 审核员登录方案（D2，需 Owner 决定）

背景：生产登录只有 Auth0 邮箱验证码、Google、Apple 三种。Auth0 的验证码由 Auth0 生成并发到用户邮箱，审核员无法读取我们的邮箱；开发用的固定验证码 `DEV_FIXED_OTP=000000` 只存在于测试适配器，**绝不能在生产开启**。

| 方案 | 做法 | 安全性 | 可靠性 |
| --- | --- | --- | --- |
| A（推荐）审核专用账号 | API 增加两项生产配置：`REVIEW_ACCOUNT_EMAIL`（如 `appreview@mail.fancyabite.uk`，Owner 可收件）与 `REVIEW_ACCOUNT_CODE_HASH`（随机 6 位码的哈希，经 `setup` 脚本录入，不进仓库）。仅当邮箱精确匹配该地址且 `REVIEW_LOGIN_ENABLED=1` 时，`/v1/auth/email/start` 不调用 Auth0，`verify` 比对哈希；其他所有邮箱照旧走 Auth0 | 只影响一个账号；该账号分类为 `test`（不进指标）；沿用现有每邮箱/每 IP 限流与 5 次尝试上限；每次使用写审计日志并邮件提醒 Owner；审核通过后关闭开关并更换验证码 | 高：不依赖审核员访问邮箱 |
| B 共享收件箱 | 给审核员一个可登录的邮箱账号读取验证码 | 需交出第三方邮箱密码；新设备登录常触发二次验证 | 低 |
| C Sign in with Apple | 审核员用自己的 Apple ID 登录，创建新账号 | 不削弱任何安全设置 | 高，但新账号没有已批准的饭局和群聊，审核员看不到完整流程 |

建议：实现 A 并在审核说明中同时注明 C 可用。另外用 Owner 控制的 `test` 分类账号预先发布 1–2 场“审核用”饭局（标题见英文文案中的 `{{REVIEW_MEAL_TITLE}}`），并预先批准审核账号入座，使群聊、饭后流程可见。方案 A 的 API 改动不在本轮范围（涉及认证代码，需单独评审与测试）。

审核说明（英文）见英文文案“App Review notes”，`{{REVIEW_SIGN_IN_INSTRUCTIONS}}` 在 D2 决定后填写，例如：“Tap Profile → Sign in → Continue with email, enter appreview@mail.fancyabite.uk and the code 123456 (also provided in the Sign-In Information fields).” 账号与验证码填在 ASC 的“Sign-In Information”字段，不写进仓库。

## 8. 截图计划

Apple 要求：iPhone 6.9" 必需（1320×2868 或 1290×2796 竖屏）；6.5"（1284×2778 或 1242×2688）按 Owner 要求同时准备。每组 3–10 张，PNG/JPEG，无透明。

| # | 画面 | 状态与数据 |
| --- | --- | --- |
| 1 | Discover 地图＋卡片 | 已登录，选中 Soho 片区，可见 3+ 场饭局 |
| 2 | 饭局详情 | “Who’s coming”有 3 个头像、预算、餐厅与时间 |
| 3 | 申请页 | 已填写给 host 的留言 |
| 4 | 发起饭局 | Arrange 步骤，已选餐厅 |
| 5 | 群聊 | 3–4 条消息，含 host |
| 6 | 饭后反馈 | 出席、评价、再约选择 |
| 7 | 个人资料 | 有头像、简介、兴趣 |

拍摄方法：Mac 上 `pnpm --filter @fancy/ios ios:preview`（预览模式使用本地种子数据，不连服务器），模拟器分别选 iPhone 17 Pro Max（6.9"）与 iPhone 11 Pro Max（6.5"），`xcrun simctl io booted screenshot`。种子数据中的人物与头像必须是虚构或已获授权的图片；状态栏用 `xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100`。英文说明文字可在截图上方叠加（见英文文案“Screenshot captions”），保持与 App 一致的森林绿/米白配色。截图不提交到公开仓库（2026-10-28 决定）。

## 9. Bundle ID 变更清单（D1）

已在代码中准备，**不影响现有开发构建**：`apps/ios/app.config.js` 增加构建变体，默认（开发）仍是 `com.example.fancy.dev`；只有设置 `APP_VARIANT=production` 时才使用 `uk.fancyabite.app`。`src/config.test.ts` 覆盖两种变体。URL scheme 保持 `fancy`（登录回跳 `fancy://auth/callback` 由 ASWebAuthenticationSession 回到发起的 App，即使开发版与正式版同时安装也不会串）。

随正式 ID 必须同步修改的外部配置：

| 位置 | 修改 |
| --- | --- |
| Apple Developer → Identifiers | 注册 App ID `uk.fancyabite.app`（显式 ID）；如启用通用链接，勾选 Associated Domains |
| Apple Developer → Sign in with Apple | 当前 Apple 登录走 Auth0 网页流程，不需要 App 内 Sign in with Apple 权限；需创建 Services ID（如 `uk.fancyabite.auth`）、验证域名、回调 `https://<生产 Auth0 域名>/login/callback`，生成 .p8 Key，把 Team ID、Key ID、Services ID 填入 Auth0 Apple 连接 |
| App Store Connect | 用 `uk.fancyabite.app` 新建 App 记录、SKU（如 `fancy-ios-1`） |
| 签名 / EAS | Distribution 证书与 App Store 描述文件绑定新 ID；构建命令带 `APP_VARIANT=production` 与 `EXPO_PUBLIC_API_BASE_URL=https://fancyabite.uk` |
| Google Cloud | iOS Maps Key 的“iOS 应用”限制加入 `uk.fancyabite.app`（建议生产单独一把 Key，开发 Key 保留 `com.example.fancy.dev`）；Key 通过 `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` 注入 |
| Auth0（生产租户/应用） | 允许回调与登出地址加入 `https://fancyabite.uk/v1/auth/oauth/callback`、`https://fancyabite.uk/auth/callback`，Allowed Web Origins 加 `https://fancyabite.uk`；API 的 `IOS_REDIRECT_URI` 保持 `fancy://auth/callback`（若改 scheme，需同时改 `apps/ios/src/config.ts` 的 `AUTH_REDIRECT_URL`） |
| Google OAuth 同意页 | 从测试模式发布为正式；支持邮箱与隐私政策链接改为 fancyabite.uk |
| 通用链接（可选，后续） | 生产变体加 `ios.associatedDomains: ["applinks:fancyabite.uk"]`；在 `https://fancyabite.uk/.well-known/apple-app-site-association` 以 `application/json`、无重定向提供 `{{APPLE_TEAM_ID}}.uk.fancyabite.app` 与路径（`/meals/*`、`/profiles/*`）；Cloudflare 不得改写该文件。未启用前不要加该权限，否则签名会失败 |
| 删除账号 | 生产 Worker 必须接入 Auth0 身份删除与 Apple 授权撤销（Sign in with Apple REST API `revoke`），否则删除状态会停在 NEEDS_SUPPORT |
| QA 证据脚本 | `docs/qa/evidence/` 的 XCUITest 脚本是历史证据，仍用开发 ID，不改 |

## 10. App 图标

- 源文件：`apps/ios/assets/brand/app-icon.svg`；导出：`apps/ios/assets/images/icon.png`（1024×1024、RGB 无透明、直角，iOS 自动加圆角遮罩）；两者由 `python3 scripts/render_app_icon.py` 从同一组几何图形生成。
- 设计：森林绿底，俯视的圆桌被咬了一口（呼应“Fancy a bite?”），四把椅子用品牌的 citrus 与 vermilion，盘中一颗橙子；只用圆与圆角矩形，小尺寸（40–60 px）仍可辨认。原创，未使用参考图或第三方素材。
- 已接入 `app.json` 的 `expo.icon`；需在 Mac 上重新构建后才会出现在设备上。网页法律页的站点图标使用同一 SVG。
- 与 `docs/design/r10/brand/` 的两版候选 Logo 不同：那是未经 Owner 选定的历史候选，本图标同样需要 Owner 认可。

## 11. 提交前核对

| 项目 | 状态 |
| --- | --- |
| 隐私政策、条款、社区规则、支持页可在 https://fancyabite.uk 访问 | 网页已生成（`apps/web/public/`），待部署与占位符填写 |
| App 内可打开隐私政策与支持联系方式 | 已完成：设置页 Help & legal、登录弹层、资料补全页 |
| 用户在发帖前同意条款（1.2） | 已完成：资料补全页 18+ 确认下方写明同意 Terms 与 Guidelines |
| 举报与屏蔽（1.2） | 资料与饭局可举报、可屏蔽成员；**缺口：群聊中无法直接举报单条消息**（契约支持 `MESSAGE`），建议首发前补上 |
| App 内删除账号（5.1.1(v)） | 已完成：Settings → Delete account；生产需接通 Auth0/Apple 撤销 |
| Sign in with Apple（4.8） | 已提供（Auth0 网页流程） |
| 生产 API 使用 HTTPS | 待部署（腾讯云首尔＋Cloudflare） |
| 年龄分级 18+、营养标签、出口合规、内容权利 | 见第 3–6 节 |
| 审核账号与审核用饭局 | 待 D2 决定 |
