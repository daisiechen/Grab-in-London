# J007 产品问卷实际界面部分验收

被测生产源码：3a17e8b8971f617b1e4d4f1c3903586b6464e6f9。新隔离合成环境，普通 H/A/B 邮箱 OTP 与资料引导，无业务预置、支持角色、真实供应商请求或时间推进。

- QA 独立冻结核验一致；16 项夹具保护及问卷 HTTP/PG 检查通过，0 失败/跳过。这些检查不折算为 217 条业务用例通过。
- A 在内置浏览器正常登录、完善资料并返回原问卷；无饭局/出席情况下，提交 Yes/company，保存提示及刷新读回通过；再编辑为 No/cost，保存及刷新读回通过。
- B 在独立 Chrome cookie 会话正常登录、完善资料；初始答案全空，没有显示 A 的值。提交 Yes/conversation 并刷新持久化；A 同时刷新仍为 No/cost。
- B 明确确认正常退出后，问卷访问跳回登录。首次 QA 只打开退出确认框便导航离开，没有完成退出，随后重开并确认；这是测试控制失误，不是产品缺陷。
- H 随后正常登录与完善资料，自己的问卷全空，未继承 B 或 A 的值；H 未提交问卷。
- 有限只读数据库计数：product_surveys=3；meals、applications、attendance_revisions、experience_revisions、public_review_revisions、pair_consents、messages、roles、support_case_grants 均为 0。API/worker 无失败或在途处理，真实供应商请求均为 0。正常认证、资料与技术恢复元数据写入不包含在“业务表为零”的结论内。

本轮仅验收问卷无需饭局资格、正常保存/编辑/刷新和账号隔离部分。合格人次评分、后台下钻/CSV、Web/iOS 角色互换仍未完成，QA-JOURNEY-007 保持 NOT_RUN；整体统计仍为 194 PASS / 12 NOT_RUN / 11 BLOCKED。

截图：[A编辑后](survey-a-edited.png)、[B初始为空](survey-b-blank.png)、[B独立保存](survey-b-saved.png)、[H保持为空](survey-h-blank.png)。
