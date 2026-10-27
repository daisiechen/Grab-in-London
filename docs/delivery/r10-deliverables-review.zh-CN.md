# r10 分版设计与架构交付核对

沿用已认可的原MVP Demo视觉与交互；业务仍为iOS＋管理后台、发起人自行订餐厅、到店各付。原Demo的模拟平台订位、支付退款不恢复，PM简化Demo只提供流程与需求依据。现行状态以[开发版本登记](development-versions-r10.json)为准，本文集中提供可打开的交付入口与核对边界。

## 用户体验与品牌交付

每个开发版本一个独立Figma，同版不同旅程分页面；不是每个页面一个版本。正式首发仍为IOS-0.1.0与ADMIN-0.1.0，dev.N为内部累积迭代。

| 交付包 | 本次用户旅程 | Figma与状态 |
| --- | --- | --- |
| DS-0.1.0 | 复用原MVP的布局、色彩、字形、组件及交互规范 | [规范文件](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3)，收口中 |
| IOS-0.1.0-dev.1 | 发现饭局→完整注册/登录及资料→申请、待审/撤回；个人资料、隐私与AI偏好 | [独立文件](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj)，收口中 |
| IOS-0.1.0-dev.2 | 四步发起→发布→审核申请→安排锁定与外订声明→截止/取消 | [独立文件](https://www.figma.com/design/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24)，候选已交 |
| IOS-0.1.0-dev.3 | 沟通与参与状态；饭后反馈、双向联系/私聊与解除；独立产品问卷 | [Figma入口](https://www.figma.com/design/mKXV0NvBavRb6fnmQ2g2xV?node-id=13-14)、[交接与限制](../design/r10/ios-0.1.0-dev.3/handoff.zh-CN.md)，候选已交 |
| IOS-0.1.0-dev.4 | 私密举报及本人追踪；再认证、确认删除、回执与无登录支持 | [Figma入口](https://www.figma.com/design/TxashjRfQDvnc4jQieeaWu?node-id=2-4)、[交接与限制](../design/r10/ios-0.1.0-dev.4/handoff.zh-CN.md)，候选已交 |
| SUPPORT-0.1.0-dev.1 | 最小授权个案、出席纠错与回复，不扩客服平台 | [独立文件](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-430)，候选已交 |
| ADMIN-0.1.0-dev.1 | 转化/供需→口径/来源→饭局/用户历史→保查询返回 | [独立文件](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=9-2)，候选已交 |
| ADMIN-0.1.0-dev.2 | 分类修订→原次结果→统计Ready→同快照聚合CSV及撤销 | [独立文件](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-430)，候选已交 |
| BRAND-0.1.0 | 图形、Fancy组合字标、单色/反白、iOS图标与24/32px规范 | [独立Figma](https://www.figma.com/design/8qCNU0sacee6OWP4hQF230?node-id=2-77)、[SVG/PNG与交接](../design/r10/brand/handoff.zh-CN.md)，两套候选已交 |

Logo推荐A“空位邀请”（俯视餐桌与拉出的椅位），B“空椅”保留备选。PJ已查看比较图及定向精修后的A，第一轮断圆环容易像耳机/Q的问题已调整。尚未选定采用方向，现有界面字标继续沿用Demo；DS只引用品牌候选真源，不自动替换全部界面。

## 开发人员交付

[技术选型](../engineering/r10/technology-selection.zh-CN.md)、[整体架构](../engineering/r10/architecture.zh-CN.md)、[12个模块工作包](../engineering/r10/module-work-packages.json)与[研发交接](../engineering/r10/handoff.zh-CN.md)已交方案候选。保留现有Expo/React Native、React/Vite、Fastify、Postgres/Drizzle及生成契约方向；依赖版本声明不冒称已通过原生兼容构建。

公共基础包与11个旅程包分别登记，当前全部未签发实现。共享契约、生成客户端、迁移、SDK及平台导航必须单writer；发包时固定精确文件租约、接口版本、环境和构建，其他无冲突模块才能并行。iOS迭代依次dev.1→2→3→4；Support与后台可依固定合同准备，实际联合验证仍绑定同一组候选与数据。完整依赖与各版本做/不做见[版本方案](development-versions-r10.zh-CN.md)。

## PJ实际核对与后续门槛

PJ已实际查看原Demo与Figma的发现/详情/账号表单、聊天/饭后反馈、后台概览/口径抽屉同视口对照。保留原地图、餐厅照片、信息密度、导航、侧栏、图表与抽屉层级；分离照片/地图素材允许使用，不接受整屏截图充当可编辑设计。源浏览器Arial度量回退已单独修正，未更换产品字体。

PJ已独立读取iOS dev.3/4、Support、Admin原生节点及原型目标；读取证明入口/目标存在，不等于Presentation完整逐点点击。Admin核对发现历史返回图层名与恢复页跨旧快照连接，已交原作者定向修复，已再次实际读回确认修复，不能仅以目标存在称语义正确。

各包保留输入哈希、需求映射、原生读回、视觉截图及未测记录。固定样例路径不等于任意输入、键盘/读屏、真机、真实认证、异步worker、邮件或CSV服务已测试；这些属于后续实现与相应QA证据。文件可变、未命名冻结时，必须标为候选。

首次业务代码开工前，DS及本轮全部7个版本Figma必须共同完成Ready核对并固定可审阅候选；共享基础骨架同样受此门槛约束。Logo选择与采用单独登记，不以品牌候选未选择阻塞原界面复用。当前门槛未关闭，未启动业务实现、产品QA或发布。
