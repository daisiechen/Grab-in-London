# IOS-0.1.0-dev.4 独立研发方案评审

评审基线9c669f55及当前原作者候选方案；原作者修订后三项已独立复验关闭，限定为方案可实施；未启动业务代码或QA。r11按本版设计通过独立推进，不等待I1/I2/I3整版。

## R11-E4-01（方案修订已复验关闭）

ReportScreen候选路径不存在；既有createReport details必填与本版可选说明冲突，必须由共享契约writer明确兼容增量并同步API/客户端。

证据：`packages/contracts/src/operations/operations-admin.ts`、`apps/api/src/support/routes.ts`、`apps/ios/src/features/settings/ReportScreen.tsx`

## R11-E4-02（方案修订已复验关闭）

本人报告历史缺少服务端列表权威；Unknown尚无reportId不能用reportStatus读取。需固定同actor/key/body原POST恢复及列表契约增量。

证据：`docs/product/journeys/j07/requirements.zh-CN.md`、`apps/api/src/common/idempotency.ts`、`apps/api/src/http/routes.ts`

## R11-E4-03（方案修订已复验关闭）

明确复用现有删除屏障/StepwiseProvider/安全receipt，不复制认证层；补provider缺配置、retention未批准、并发迟到失败不覆盖完成与receipt遗失过期测试。

证据：`apps/api/src/deletion/routes.ts`、`apps/worker/src/deletion/provider.ts`、`apps/worker/src/handlers/deletion.ts`、`apps/worker/src/deletion/auth0.ts`、`apps/ios/src/features/settings/deletion-receipt-store.ts`

原作者PJ-IOS2已直接收到以上缺陷。J07/J08边界、单writer精确租约、15分钟排障、PR合main后按精确SHA部署的方向成立。真实跨版依赖仅限制对应联调；夹具结果不能关闭真实联调。删除受理不可回滚为有效账号，兼容回退需继续处理持久步骤。

此次只核方案与源码，不跑真实API/DB或原生测试，不声明当前实现符合新设计。测试矩阵目前均NOT_RUN，实际分配文件与环境仍是开工前置。

复验结论：修正settings真实路径；明确optional details为有意契约兼容变更，并由唯一writer补服务端分页本人历史；Unknown复用原POST同key/body重放，不能发明查询操作。现有applyDeletion/StepwiseDeletionProvider/安全receipt保持权威，Auth0现有适配器按配置选择，Apple缺实现与retention未批准不可完成。新增T11—T14覆盖兼容、丢响应、过期遗失及provider门槛。

实施签发仍须实际RD负责人、精确≤5文件租约、本人列表精确operation/path/schema及生成SDK兼容、最小环境预检；本评审不代签。合法receipt是最小状态查询的bearer凭据，无需session，账号隔离指UI不自动暴露另一账号token。I1/I2/I3仅阻断实际依赖的联调点，不阻断本版方案或独立小包。共享PR#1必需CI仍需重跑全通过后才merge/deploy，独立方案推进不因此等待。

共享CI定向修复（根PJ追加授权）：Node24复现原两曝光断言失败（2失败、5通过）；原因是meal默认2026-10-23已过期，guest eligibility与回调按Date.now正确过滤。只在两测试文件给曝光正例设置相对当前的未来时间，不修改生产源码；保留49%、999ms、后台中断、1000ms一次性与requestId断言，并将原关闭负例扩展为关闭、过期开始、过期截止三种。定向9项全通过，diff check通过。默认Node20的undici worker启动错误不算业务测试结果；改用现成Node24，无安装。全套CI尚未重跑，不宣称整PR绿。
