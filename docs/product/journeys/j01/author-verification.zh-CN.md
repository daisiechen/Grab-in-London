# J01 PM作者验证

候选PM-r01；输入e7f2b895/r07。需求与Demo属于同包，UX/RD/独立QA未启动。

## 已执行

`python3 -m unittest discover -s tests -p test_pm_j01.py -v`：4项通过。使用既有Node24/jsdom；不安装环境，不发起网络、真实认证、模型或申请。

- 模型检查：完整新用户身份→资料→同meal申请Pending、重复不增申请、撤回/新轮次、未知响应查原结果；OTP等号过期、Google取消/Apple老用户分支；hard/soft/CLEAR、AI零业务写、Keep/Replace及满员失效；菜系/饮食正式字典与unknown匹配。
- 实际DOM事件：筛选草稿取消→详情→Apply→邮箱错码纠正→填完整资料→主动申请→待审→撤回→再次申请，读取各真实页面结果；不是只查字符串。
- Coverage按精确J01＋IOS-0.1.0选原文单元，历史/交付/共享合同保留不同处置；逐ID到PRD节和演示场景或documented-only理由。映射不称所有原文已可交互或已实现。
- 最终自包含HTML无ES模块、网络、持久化依赖；manifest固定PRD/coverage/源/入口/作者测试。清单不哈希自身。

## 未执行及边界

真实浏览器布局/键盘/读屏、原生iOS、真实Google/Apple/OTP/Places/模型、服务端并发/持久化、真实AI评测/费用账单均NOT_RUN。jsdom不等于浏览器。Demo日期/餐厅/用户/模型/故障与业务结果全合成；未把旧M01-01的部分流程或通过结果迁为本旅程完成证据。

## 查看与重建

[自包含Demo](../../../../demo/journeys/j01/index.html)直接file打开；[PRD](requirements.zh-CN.md)供用户同看。源有改动时用现有Node运行`node demo/journeys/j01/build.mjs`重建，不需要服务或打包依赖。

本包仅PM候选。后续由用户审阅，产品批准、UX/RD/QA与正式实现均另记；此作者记录不代签验收。

## Demo PM-r02 评审链接修正

仅当非file协议且路径精确为托管根/j01/或/j01/index.html时，评审区PRD链接指向../#prd-j01；真实仓库file路径及仓库/demo/journeys路径保留原相对Markdown链接，无私有地址或业务改动。新增jsdom实际点击事件检查托管两入口、file路径、仓库HTTP路径及嵌套路径，验证解析后的目标；拦截默认导航，因此不声称已测试真实托管阅读器加载。保持自包含，无真实浏览器或后端新测试。

本轮 `python3 -m unittest discover -s tests -p test_pm_j01.py -v`：5项作者检查通过，包含原有流程、链接点击、最终文件哈希和自包含一致性。
