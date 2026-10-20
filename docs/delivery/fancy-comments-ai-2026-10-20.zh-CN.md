# 浏览器批注1–16与Ask Fancy恢复

日期：2026-10-20至21。基线：`d7cee02`（线上v10）。本轮保留恢复版布局与首期规则，App/主PRD由原会话修改，后台由原负责人独立提交。

## 实际改动与证据

| 批注 | 已表达的交互 | 验证 |
| --- | --- | --- |
| 1 | 发现日历支持不连续多日、逐日取消；日期内部OR，与其他条件相交；关闭丢弃草稿，创建仍单日 | domain与comments浏览器测试 |
| 2 | 当前底部导航图标填充、aria-current | comments浏览器测试 |
| 3 | Inbox的Chats／Applications页签、数量及独立空态；Track in Inbox打开申请页签 | comments与申请回归 |
| 4–6 | 发言头像打开对应主页，返回原会话；群设置展示成员与Host/Member/You；host管理/解散、成员退群，动作不混入聊天正文，只读不显示写入动作 | comments、readiness浏览器测试及group-settings.png |
| 7–11 | 反馈按钮距头像20px；移除无操作的大心；仅一个出席标题；说明支持hover/focus/tap，Escape/点外关闭，关键状态保持可见 | 样式检查、键盘提示及饭后回归；meal-experience.png |
| 12–13 | 单场私密反馈只收1–5评分；再次参加意愿与产品因素移至Settings独立可选问卷 | 验证空回答、明确No、仅因素、更新/清除、与出席分离；product-survey.png |
| 14–16 | 注册和编辑共用伦敦状态单选标签、完整名称语言下拉、兴趣多选标签；保存生效，返回放弃编辑 | comments浏览器测试 |
| AI恢复 | 从历史`69a38d6`恢复MealHelper/assistant解析及专属样式；浮动拖动/贴边、搜索比较、费用、三类草稿、偏好确认/删除、首页/继续会话、30分钟闲置及可选语音降级 | 17个助手领域测试、13个助手浏览器场景；assistant-*.png |

AI入口此前随星期日基线回滚被移除。本轮只恢复助手模块及必要接线，没有用旧Prototype覆盖当前首期实现。助手推荐排除已过申请截止的饭局；应用草稿、发送消息继续经过现有登录、截止、容量及成员权限检查。助手不代用户发送、批准或发布。

主PRD为v0.6。后台同步提交`a396397dddf010b6ab3c555176b5cd25732eb53a`，指标契约v4；截至asOf每人最新有效产品问卷版本再按submittedAt入选，饭局维度不作用问卷，不回捞旧答案。旧meal.again/reasons不自动迁移。

## 验证与修复过程

- App领域/助手62项、Sites6项、仓库Python44项通过；TypeScript与构建通过，28个受保护运行时文件完整。
- 浏览器共29个场景：助手13、共享运行时8、批注3、首期规则5。最近全量运行的28项通过；日期场景暴露旧CSS将checkbox焦点当文字输入，弹层在点击中收缩。修复选择器后，批注与首期规则8项一起重新运行，全部通过。另复验了问卷No/清除/返回保留与出席提示键盘关闭。
- 测试定位曾沿用旧按钮名称、日期缺逗号、返回按钮重名；按实际语义修正定位。未跳过失败场景或降低业务断言。调试日志已清除。
- 视觉检查包括iPhone/Pixel助手键盘、搜索结果、浮动入口、群成员和430px问卷页。截图：[本批QA](../../demo/qa/comments-2026-10-20/)。既有>500kB构建提示仍存在，不影响构建成功。

## 交付边界

这是内存交互Demo：刷新/重置清空本地状态；模型、真实认证、消息、餐厅、问卷采集API及原生iOS仍待研发。浏览器语音只在用户确认说明后使用浏览器支持能力，不自动发送。此记录不代替双端整体研发准入复评，不把历史评审阻塞自动标为关闭。

发布版本、源码SHA与线上截图由本批QA目录的release.json及live-ai.jpg记录。GitHub与Sites源仓库分开核对，仅提交本轮App/文档文件，保留研究会话的未提交改动。

## 已发布

- Sites v11，状态succeeded：[手机可访问的Demo](https://grab-in-london-demo.daisie-chen-94.chatgpt.site/)。
- App/PRD提交`37585b744abb829b4aa8f1dce1fb1d2265605cb1`；Sites源码`0b40ce53d39d278ed8bd6cc5fa69f8b7eb8218cc`；72个Demo源文件逐字节一致。发布元数据见[release.json](../../demo/qa/comments-2026-10-20/release.json)。
- 已在线打开Ask Fancy、My preferences入口并执行Find a meal for Friday，显示23日两场可选饭局；截图见[live-ai.jpg](../../demo/qa/comments-2026-10-20/live-ai.jpg)。
