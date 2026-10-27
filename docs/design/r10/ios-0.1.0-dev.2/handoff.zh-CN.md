# IOS-0.1.0-dev.2 · J02 UX-r02候选

[Figma可编辑入口](https://www.figma.com/design/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24)，页面0:1。26个正常/必要状态根节点，原生文本/控件/SVG/分离地图及餐厅头像素材，不使用整屏截图作为UI填充。产品版本仍IOS-0.1.0，dev.2仅内部迭代。

复用旧MVP v13 / 361ab04ed6fc55c0f1e041bb5d6cc5d216d1a7b2视觉，业务固定14db53257a2b4bb7610a3afad5e1ecfd735db605；DS-0.1.0由UX-1唯一维护，引用docs/design/r10/system/tokens.json与Figma yUMVg2xpLXQHKPr2ZWpkO3。文件内为源转入本地原生节点，不冒称已发布组件key。源原四步、地图、进度条、ChoiceGroup、字段、费用深绿receipt、Review卡、申请卡、浮层与Ask Fancy保留。PJ已实际看Arrange源/Figma并排并确认方向；Header原分割线与地图链接原矢量/下划线已修。

## 入口与代表路径

- Arrange 1:24 → Introduce 1:340 → Costs 1:449 → 本人声明CostsConfirmed 4:164 → Review 1:594 → 本人最终确认ReviewReady 3:2365 → Published 1:719 → Applicants 1:880 → Approved 3:3809。
- 公开申请资料6:290；拒绝回执3:4329→不可再处理DeclinedResult 6:185。
- 订位声明3:3907→本人勾选5:188→Host-reported更新3:4021。
- 取消确认3:4117→Keep返回或Cancelled 3:4233。餐厅自己联系；群历史保留，群页交J03。
- AI主动草稿3:3526→替换确认3:3669→仍需手动Review/Publish；原文保留分支BACK。
- Reviewer专层3:4644：DST错误3:2803、发布失败3:3248/未知3:3387、409锁冲突3:4432、截止不足3:4538。外部事件不塞入用户屏作为假动作。

## 相对旧Demo的必要业务差异

按已确认首发范围删除Deposit/Fixed menu和Book through app；仅到店各付及host外订声明，原费用receipt只写Pay individually at the restaurant与Budget per person £25–35，不显示平台应付/发布收款行。新增已批准可选菜系/饮食字段、Review最低数/截止/声明来源细节，沿原字段/ChoiceGroup，不更改品牌。申请批准不再出现支付hold与“已通知对方”的虚假投递承诺；首批准锁定、人数变化Needs update及确认门槛补齐。服务失败与恢复用原BottomSheet，原v13没有的服务矩阵保留在状态合同而非无限扩屏。

visual-comparison.html为同393×852对照。Introduce重新采失焦源状态，旧keyboard截图仅历史交互证据；Figma移除平台键盘壳、恢复750高可滚动视口，长内容不压缩。源实际字体为隔离/tmp环境Liberation Sans（Arial度量兼容），Figma仍Arial。硬件壳/island、动态时钟、emoji/定位glyph平台渲染是明确豁免，地图链接使用原生矢量避免蓝底emoji。原分离素材来自repo；真实Places许可与provider内容未伪称已验证。

## 验证和Ready边界

实际浏览器走四步→发布→审核→取消浮层；原生Figma逐根读回文本、图片hash/范围、滚动和prototype动作并截图目视检查。Costs/Review/声明更新的本人确认门槛、锁定、人数2/4、Confirmed可见文字、长锁定提示与按钮间距均定向核对。完整需求/AC映射见coverage.json；每条源单元继承及状态/权限/返回恢复见state-contracts.zh-CN.md。

未运行Figma Presentation逐点完整流程；任意自由输入、原生键盘/动态字号/辅助功能、真实Places/OAuth/OTP/AI/邮件、持久化、交易锁/并发/worker/DST全矩阵未测试。固定样例选择不是自动填写产品规则。J01全身份门槛复用I1、Hosting父级与J03/J04联调尚未串联到跨文件Presentation；这三项如需展示应由PJ协调原包Owner补联调，不另复制整个模块。

UX-r02候选文件仍可变、未冻结，命名版本工具不可用，namedVersionId=null。Owner未批准整包、implementationReady=false；待Owner/PJ审阅、DS一致性和跨文件正常路径Ready核对。不启动RD实现/QA，不操作Git，由PJ串行提交。验证测试是设计证据检查，不能替代产品QA。

验证：`python3 -m unittest discover -s tests -p test_ux_r10_ios2.py`检查固定输入/包完整性、全部需求/AC映射、正常门槛连线、原素材及长滚动；2项通过。`git diff --check`通过。

PJ最后独立读回发现费用数字由“£”和“0.00”分节点组成；已定向移除两个Costs状态中的完整旧金额节点，而非只改整句匹配。全页派生状态扫描剩余0项旧零额/不存在的平台退款文案；取消说明统一自然表达Let the host know if plans change.，最终增量证据为evidence/final-copy-cleanup.json。
