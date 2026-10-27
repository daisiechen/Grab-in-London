# r10 RD架构准备交接

**状态：技术方案候选已交回PJ；业务实现、运行环境、产品QA和发布均未启动。** 用户现有授权允许本轮选型/架构/模块拆分，不等于现在签发代码包。

## 本包内容

- [技术选型](technology-selection.zh-CN.md)：现有栈与替代路线、依赖版本声明/未验证组合、已批准供应商与待验边界、官方依据。
- [整体架构](architecture.zh-CN.md)：业务权威、深模块接口、跨模块不变量、单writer、隔离与恢复。
- [模块工作包](module-work-packages.json)：11旅程＋公共前置，按同版垂直结果和候选小提交拆分；当前均not-issued。
- [固定输入](input-manifest.json)：源码/PRD/包声明hash、旧分支只读定位和PJ规划字段投影hash；不把Figma进度等可变状态作为永久输入。

PJ唯一版本真源为[开发版本r10](../../delivery/development-versions-r10.json)。现有正式产品号不改，内部dev编号不充当App Store版本/已发布build。

## 逐开发迭代当前缺项

| 迭代 | 完整旅程 | 当前缺的设计/输入 | 实施停止点 |
| --- | --- | --- | --- |
| IOS-0.1.0-dev.1 | J01、J05 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |
| IOS-0.1.0-dev.2 | J02 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |
| IOS-0.1.0-dev.3 | J03、J04、J06 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |
| IOS-0.1.0-dev.4 | J07、J08 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |
| SUPPORT-0.1.0-dev.1 | J09 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |
| ADMIN-0.1.0-dev.1 | J10 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |
| ADMIN-0.1.0-dev.2 | J11 | DS-0.1.0及本迭代全部Figma/路径映射Ready；界面以认可MVP Demo为基准。精确owner/文件租约、接口差异和环境预检待签发 | `implementationStatus=not-started`；不以别的迭代先完成替代本版Ready |

公共合同可在当前方案准备阶段固定；设计可并行。后续实现的先后/真实联合前置以同一r10记录的dependsOn及其语义为准，不给J01/J02创造互相等待整个模块的环。首发iOS需四次dev＋支持与真实上架门槛，后台需两次dev及跨域数据/隐私联调；不是先做一个dev就对外上架。

## 实际核对与保留限制

- 只读检查了现有package.json/lockfile、实际目录、主要HTTP/SDK/worker入口、安全存储/UI tokens、既有核心/AI合同及封存/补丁分支记录。保留Expo/RN、React/Vite、Fastify、Postgres/Drizzle、生成契约、持久job/outbox方向；没有创建packages/domain空壳，也没有整枝合并P1.1。
- 明确SDK58/RN0.88/React19.3为仓库声明，不宣称已验证原生兼容；iOS与后台React声明差异不强行统一。保留DeepSeek＋CNY50/月闸，现有Auth0/Maps/Resend配置须逐能力实际核证，不要求重建已存在账户。
- 2026-10-27访问官方Expo、React Native、Fastify、Postgres17、Auth0、Places、Resend及DeepSeek文档；只核接口原则，不外呼账户、发送消息/邮件、获取价格批准或启用真实模型。
- `python3 -m unittest discover -s tests -p 'test_architecture_r10.py' -v`：5项通过；含首次全套设计门槛（共享骨架亦受控），验证规划投影与原始输入、每旅程唯一迭代/不实施状态、共享writer和无环依赖、关键范围/AI约束。静态检查不是产品QA/构建/供应商测试。
- 本轮未安装依赖，未运行pnpm业务测试/构建、DB/API/worker、iOS工具链、供应商、部署、迁移或产品QA。所有runtimeBuild/codeCommit/deployment仍null。
- 无新增需要Owner重复确认的产品范围问题；依赖兼容、设计Ready、实际owner/文件租约和环境预检为后续相应模块的执行前置，不交给Owner做技术排障。

## 后续接收与写入边界

PJ先核本方案是否与最新范围/版本一致；UX补足本轮全部迭代的MVP视觉保真规范/场景；RD按工作包核接口可实现性。首次任何业务代码（含WP-FOUNDATION共享骨架）须先满足`initialDesignSetReady`：DS-0.1.0＋4个iOS、1个Support、2个Admin版本Figma全部Ready；未来J12—J15不在此集合。全套设计门槛关闭后，仍需该迭代固定候选、实际模块owner与精确文件租约、接口兼容及隔离环境预检齐备，PJ才按用户既有条件授权逐版本逐模块签发，不边设计边实现。后续发布仍独立；QA无本轮启动任务。

本包唯一写入负责人为RD架构准备作者；交接后停止写入。文件白名单：`docs/engineering/r10/`和`tests/test_architecture_r10.py`。Git索引与提交/推送归PJ，未改旧任务表、PRD/Demo/旧Figma、业务源码、环境或其他worker文件。
