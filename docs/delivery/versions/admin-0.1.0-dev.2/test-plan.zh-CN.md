# admin-0.1.0-dev.2 独立测试计划

本文件是方案准备，不是产品QA通过报告。设计签收由总PJ独立完成；真实服务与实现当前未启动。每条证据绑定候选SHA、build、接口版本、迁移、环境与合成夹具版本，缺一不签真实联调。

|用例|检查对象|通过条件|
|---|---|---|
|A201|分类与权限|subject分类只影响分析投影不改业务权限；data-admin/MFA与原因必填|
|A202|409恢复|subject revision2 staff与本地test/原因同时展示；本人INTENT-2提交expected2，取消保staff2|
|A203|UNKNOWN|先查INTENT-1原次，不重复改分类，不借更大revision猜成功；旧统计/导出不可读|
|A204|受理与统计|分类受理不等Ready；统计失败只重试统计不回滚/重复分类|
|A205|快照CSV|新快照覆盖本次subject revision、相同query/asOf/definitionVersion；CSV数值/分母/来源一致|
|A206|撤销下载|权限或隐私撤销后旧票据拒读；生成票据不等下载成功，不能声称远程撤回磁盘文件|

测试顺序：公开模块接口/纯规则→独立数据库命令与事务→本版真实客户端路径→受影响回归→具备真实上游后的定向联调。单测、mock、原型和真实服务分别记录；上游未实现只阻断对应联调。

环境先检查项目既有Node版本/锁文件、数据库可达、唯一端口/PID/CWD和本版合成夹具；不要每个小包重建整个环境。失败先分权限、合同、数据、候选与环境，再交唯一owner修复；不反复无目标重跑。

回归仅覆盖受影响消费者：Support→出席/再约/公评/分析；Admin1→分类/纠错/删除的快照读取；Admin2→Admin1查询与导出/隐私。无相应实现不声称联调通过。真实供应商、生产数据和部署需独立授权与发布门槛。

工程复验补充：同subject另次分类、其他subject高revision不能证明原意图；Unknown复用原PUT actor/key/body/If-Match；Pending/Failed API+客户端拒旧图/旧明细/旧导出；统计retry不调用classify；excluded subject仍有封存输入证明。新任务/DTO/worker尚未实现，此处仅测试计划。

## 独立工程签收证据

docs/reviews/r11/admin2-engineering-review.json已逐项关闭本版问题，plan-approved-with-issuance-gates。每版独立计划检查5项通过；这些是文档/证据校验，真实模块API/数据库/CLI/客户端/跨版QA尚未运行。真实writer租约、契约增量、迁移与环境仍按签发闸执行，不能把本节作为代码或生产测试通过证明。
