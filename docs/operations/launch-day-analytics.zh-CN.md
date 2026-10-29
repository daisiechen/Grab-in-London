# 上线当天的运营数据步骤

2026-10-29 依据[管理后台运营分析评审](../delivery/admin-ops-analytics-review-2026-10-29.zh-CN.md) P0-5 编写。本页只写上线当天人要做的事，不涉及代码。全部在第一位真实用户进来**之前**完成；做完后在第 4 节的记录表里填日期。

## 1. 把内部账号标成 test 或 staff

为什么：被标成 test/staff 的账号，其行为、申请、出席都不计入指标；它们主持的饭局整场排除。没标的内部账号会让注册数、发布数和出席数虚高，而且分类只对**之后**生成的快照生效，旧快照不改。

要标的账号（缺一不可）：

| 账号 | 分类 | 原因示例 |
| --- | --- | --- |
| Owner 本人的成员账号（含自测用的第二个邮箱） | staff | Owner account used for operations and self-testing |
| 所有 QA 账号 | test | QA account for launch verification |
| App Store 审核演示账号（按[上架材料](../delivery/app-store-submission.zh-CN.md)选定的审核账号，例如 `appreview@mail.fancyabite.uk`） | test | App Store review demo account |
| 种子数据或演示饭局的 host | test | Seed host for demo meals |

### 1.1 先拿到用户编号

后台只接受用户编号（UUID）。在服务器上用只读 SQL 按邮箱查（邮箱只在服务器上输入，不发聊天、不进仓库）：

```sql
SELECT u.id, u.status, u.created_at
  FROM users u JOIN private_contact c ON c.user_id = u.id
 WHERE c.email = lower('<内部账号邮箱>');
```

### 1.2 在后台标注（推荐，有审计）

1. 操作人需要 `data_admin` 角色，并用带 MFA 的方式登录后台（服务端校验，没有 MFA 会被要求重新认证）。如果 Owner 还没有该角色，在服务器上授予一次：

   ```sql
   INSERT INTO roles (user_id, role, granted_by)
   VALUES ('<Owner 的用户编号>', 'data_admin', 'owner-launch-day')
   ON CONFLICT DO NOTHING;
   ```

2. 打开后台“数据质量”页，找到“统计账号分类”面板，粘贴用户编号，选择“测试”或“员工”，填写原因（5–500 字），保存。服务端写入 `account_classifications` 新版本，并记一条 `account.classified` 审计。
3. 每个账号重复一次。保存后面板会提示“需要新快照”：worker 每小时生成一份新快照，之后在后台顶部切换到新快照查看。

### 1.3 只在后台不可用时用 SQL

```sql
INSERT INTO account_classifications (user_id, classification, actor_id, reason)
VALUES ('<内部账号编号>', 'test', '<操作人编号>', 'App Store review demo account');
```

这条路径不会写审计记录，事后在第 4 节记录表里注明。分类记录不可修改或删除，改分类只能再插一条新版本。

### 1.4 核对

```sql
SELECT DISTINCT ON (user_id) user_id, classification, revision, created_at
  FROM account_classifications ORDER BY user_id, revision DESC;
```

确认第 1 节表里的每个账号都在结果中，且分类正确。

## 2. 核对采集后再设置 `ANALYTICS_COVERAGE_START`

不设置时，曝光、发起漏斗等依赖客户端事件的指标一直显示“未就绪”，这是有意的保守行为。设置步骤（详见 [infra/README](../../infra/README.md) “正式进程入口”）：

1. 在生产环境用一台 iPhone 和一个浏览器分别登录**已标为 test 的账号**，同意分析，浏览发现页、打开一个饭局详情、打开地图。
2. 在服务器上确认三类来源都有新事件进来：

   ```sql
   SELECT type, app_version, count(*), max(received_at)
     FROM analytics_events
    WHERE environment = 'production' AND received_at > now() - interval '1 hour'
    GROUP BY type, app_version ORDER BY max(received_at) DESC;
   ```

   需要看到 `discovery_results`（服务端，`app_version='server'`）、iOS 与 Web 的 `meal_impression`、`detail_view`。这些是 test 账号的事件，不进指标，但能证明链路通了。
3. 取三者实际开始覆盖的最晚时刻（UTC，ISO 8601），写入生产配置 `ANALYTICS_COVERAGE_START`，重启 worker。worker 会再与数据库投递台账的安装时间、原始事件 13 个月保留下限取较晚值。
4. 下一份快照生成后，后台“数据质量”页的来源不再显示 partial。

## 3. 记下上线基线

- 上线日期（伦敦时间）写进第 4 节记录表，同时在[举报值守流程](moderation-runbook.zh-CN.md)或[接手开发计划](../delivery/claude-takeover-plan.zh-CN.md)的进度记录里注明，作为所有周对比的起点。
- 前 2–4 周只核对数据是否完整，不定目标（与[后台 PRD](../product/admin/PRD.zh-CN.md) §7 一致）：
  - 概览“本周运营”一行的注册数与服务器 `SELECT count(*) FROM users WHERE created_at >= '<本周一 00:00 伦敦时间>'` 大致一致（差额应等于被标 test/staff 的账号）；
  - 质量页的“分析授权覆盖率”有分母，且不是 0%；标“仅授权样本”的卡片只看趋势；
  - 每周一导出一次概览的聚合 CSV 存档（只有聚合数），因为删号会撤销包含该成员的旧快照，旧数字无法复现。
- 快照只保留 48 小时内的每小时快照和 120 天内每天一份；需要长期留存的数字以周 CSV 为准。

## 4. 记录表

| 项目 | 日期（伦敦） | 操作人 | 备注 |
| --- | --- | --- | --- |
| 内部账号分类完成 | 待填 | 待填 | 列出已标账号数量；SQL 兜底的注明 |
| 采集核对通过、`ANALYTICS_COVERAGE_START` 已设 | 待填 | 待填 | 填写设置的时刻 |
| 正式上线（第一位真实用户可注册） | 待填 | 待填 | 作为基线起点 |
