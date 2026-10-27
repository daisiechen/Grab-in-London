# IOS-0.1.0-dev.4 · UX-r02候选交接

产品首发版本仍为IOS-0.1.0，dev.4只是内部迭代。仅本版本J07, J08，每旅程独立页面；不启动RD实现/QA。

[Figma可编辑文件](https://www.figma.com/design/TxashjRfQDvnc4jQieeaWu)。文件可变、未冻结，没有可用的命名版本API；namedVersionId为null。Owner未批准整包，PJ已核对聊天/饭后视觉方向，不能替代版本Ready。

业务输入固定14db53257a2b4bb7610a3afad5e1ecfd735db605；视觉固定旧MVP v13 / 361ab04ed6fc55c0f1e041bb5d6cc5d216d1a7b2。完整输入SHA256见manifest。通用规范引用DS-0.1.0（UX-1唯一维护，Figma yUMVg2xpLXQHKPr2ZWpkO3，docs/design/r10/system/tokens.json）；没有另造品牌/全局规范，也没有发布或冒称可导入的组件key。文件内本地原生控件用于代表路径，RD应按最终DS交接实现。

## 打开与范围

- [J07入口](https://www.figma.com/design/TxashjRfQDvnc4jQieeaWu?node-id=2-4)，页面0:1；节点全集及实际连线见figma-readback.json。
- [J08入口](https://www.figma.com/design/TxashjRfQDvnc4jQieeaWu?node-id=5-16)，页面1:2；节点全集及实际连线见figma-readback.json。

## 视觉依据与差异

打开visual-comparison.html查看同视口源Demo/新Figma并排图。原聊天气泡、头像、安排条、composer和Ask Fancy、原ChoiceGroup/Settings/BottomSheet/Notice/SummaryBox/Toast及图标均沿原MVP模式。Avatar为原分离素材，不使用整屏截图充当可编辑设计。

源浏览器起初Arial实际fallback至DejaVu；隔离/tmp字体环境加入Arial度量兼容Liberation Sans后重新采图，Figma仍Arial。实际CDP字体见dev.3 evidence/source-platform-fonts.json。动态时钟、设备外壳、指针与平台emoji不作为产品差异。未修改Demo或系统字体。

唯一必要的安排文案差异为Restaurant confirmed→Host-reported booking（Host外部自订，不恢复平台订位）。其他业务必要补充：J04三对象独立回执/失败重试及私密权限；J07原因必填、说明可空和私密状态；J08原Demo缺少的再认证/本人最终确认/异步删除及无登录支持，复用既有Settings、字段、表单和通知模式。没有拓展分享、推送或支付场景。

## 验证及限制

已实际读回各旅程页面原生文本、节点、图片边界和prototype反应；聊天/饭后/表单及关键只读/受理/支持状态截图已肉眼核对。发送SVG白色、第二泡264px、表单取消返回、无默认评分/确认、WAITING无私聊承诺、退出无实时名册均定向检查。覆盖与状态表见coverage.json和state-contracts.zh-CN.md；继承原PM coverage全部源单元，并未将共同服务合同宣称成可点击UI。

可点击代表路径采用固定样例，字段点击切换示例状态；不是自动填写产品规则。未运行Figma Presentation完整逐点点击，未测试任意自由输入、系统键盘/动态字号/VoiceOver/剪贴板/真实邮件、真实认证/服务/网络/并发/通知或外部worker。长文安全区和滚动以节点/截图核对，不等价于原生设备运行。评审层的外部对方/支持/worker状态不是用户推进动作。

交付验证为设计证据/映射校验，不是产品QA。Ready仍需Owner/PJ整包审阅、DS最终一致性确认及后续真实命名版本/冻结；RD实现与QA未启动。不以真实服务尚未开发冒充本轮已完成验证。

验证命令：`python3 -m unittest discover -s tests -p test_ux_r10_ios34.py`，2项通过；检查冻结输入/包完整性、逐条映射、页面内连线、分离素材边界与关键权限状态。尚未执行Presentation真实端到端。

r11定向修复（待PJ-IOS1独立复验）：R11-I34-02的实际Cancel为4:151（评审列4:152为失效ID）；填稿取消→15:72原成员草稿保留态，原举报入口可重入4:78，未经过Send。R11-I34-03为最小来源状态变体：NEEDS_SUPPORT→14:97→Back/Retry回5:275；COMPLETED新增沿原按钮的支持出口→14:138→Back/Retry回5:348；PENDING沿5:307→5:182。查询不代替worker推进。未自签通过。
