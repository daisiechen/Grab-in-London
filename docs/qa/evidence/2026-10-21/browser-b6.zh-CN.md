# B6 · 实际审批与退席/群身份独立闭环

Web980c8edd634bd212a92cfac46d54cf562c8480e4、API/PG/worker8387580156d53eed2936f7650ccc71dbe8319e0f固定隔离归档；本任务IAB，真实墙钟，TestIDP/Places/mail fixture，无真实供应商或iOS设备验收。沿用B3同meal adadcda5-970a-41f5-9460-70d04611d992及group b68ecc96-56f6-4660-8719-3c8168779a2f。

## 已执行

Host通过真实UI审批QA F01 Applicant：Pending不占位1/4→Approve2/4，关键安排Edit消失，说明首批准后锁；人数变动reservation变stale，host本人报告Bookedfor2。仅用带显式本地flag和UUID校验的QA脚本追加一合成申请，host实际Approve3/4达到min3，预约再次stale并明确报告for3。空群Send禁用，输入一条合成hello显式Send后仅一条。

Guest真实登录：本人已确认申请→Cancelmyplace明确确认→Participationcancelled；群仍可发送cancel-seat标记。随后独立Leavegroup确认，历史只读无发送框；Applyagain新空表单、明确Send才Round2Pending。Host在guest离群后发送GAP，批准Round2后发送AFTER_REJOIN，明确Dissolvegroup。Guest重新登录只见第一授权段hosthello/本人cancel消息及第二段AFTER_REJOIN；GAP不存在(0)、Message输入框不存在(0)。刷新仍只读，settings无重新开群入口。host解散也不取消meal或假报出席。

该完整独立身份路径授JOURNEY003 PASS；JOURNEY001/002的同场结束出席/评分公评再约/后台仍未执行。未来Oct24场不通过改meal时间冒充已到期；环境owner正准备另起一次性受控钟场，后续须从创建重走并另编号。

## 证据与fixture

- [逐项观察](browser-b6.json)
- [审批后安排锁/人数3](b6-approved-arrangements-locked.jpg)
- [实际群消息](b6-group-message.jpg)
- [取消席位后仍群聊](b6-cancel-seat-group-still-open.jpg)
- [本人退群只读历史](b6-left-group-history.jpg)
- [重入后授权union及解散只读](b6-rejoined-union-history-dissolved.jpg)

追加fixture：scripts/qa-browser-extra-applicant.mjs，仅FANCY_QA_LOCAL_FIXTURE=1、localhost3000、明确UUID目标。node --check及无flag拒绝校验通过；实际返回application80a32e00-19c5-4e15-a54a-ed8008d43b05 Pending，随后由hostUI审批。没有输出cookie、验证码凭据或数据库URL；email全example.invalid合成。
