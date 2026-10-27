# I3 修后公开原型实际点击补测

四组浏览器回执已全部收齐：14 PASS、1 BLOCKED（任意公评自由输入仅固定热点）；无FAIL或NOT_RUN。结论仅固定原型代表路径，不签真实服务/设备QA。

|用例|状态|实际结果|
|---|---|---|
|I3-P01 退群取消保写态|PASS|取消保成员与Say a little hello composer/Send|
|I3-P02 退群确认与连续返回不恢复写态|PASS|Left group · Read-only；无当前名册/Send，历史只读，重复返回未恢复写态；seat参与本就与group分离|
|I3-P03 本人退席取消/确认且群保留|PASS|取消保原seat，确认后Your seat is cancelled且group未改，群仍可写，View meal仍取消|
|I3-P04 host无guest退席与解散取消/确认|PASS|host只读Meal明确无guest withdrawal；取消不解散；确认dissolved后只读、无composer/Send，Back不复活|
|I3-P05 评分独立回执且无默认|PASS|Your private meal experience is saved；公评空、私密checkbox未选|
|I3-P06 公评不代勾私密再约|PASS|固定公评稿未代勾私密；Your reference is waiting to be published及No private choice has been selected|
|I3-P07 私密选择独立不代填公评|PASS|No public reference has been submitted及Your wish to meet again is private until mutual；另32:682点击Choose to meet again才呈现checked|
|I3-P08 撤回联系连续返回不复活OPEN/同意|PASS|Previous private conversation与新mutual才可发消息；Back为withdrawn summary，Edit到No private choice has been selected，未复活OPEN或同意|
|I3-P09 初次问卷取消无已存Yes|PASS|未保留Yes，无首次取消伪已保存|
|I3-P10 reason-only保存/编辑不代选Yes|PASS|Company-only保存；Update仍Company且Yes/No均未选；取消恢复已确认Company-only|
|I3-P11 Yes/No/清空与取消恢复|PASS|Yes/No可切换，Clear answer清空；取消仍原Company-only；点击已选chip自身不清空，清空由明确控件完成|
|I3-P12 Yes-only/No-only不自动填理由|PASS|两条独立实际保存/更新/取消/重开均保持本人已确认Yes-only或No-only，Company均off，无默认理由。|
|I3-P13 完整AI转入Keep/Replace|PASS|Keep保原文且不发送；Replace仅填入完整候选，包含最终Please let the host know if your plans change.|
|I3-P14 草稿不自动发送且本人Send保末句|PASS|点击Send前无新bubble；点击后完整Hi everyone! Shall we meet at The Little Table at 19:00? Please let the host know if your plans change.展示；仅原型不真实外发|
|I3-P15 公评任意自由文本输入|BLOCKED|Figma热点只切至固定公评样例，自定义文本未生成；不以样例行为冒称真实任意输入已通过|

逐步点击、公开URL、原型前提及首次未测→补测历史见同名JSON。全部PASS均browser-click；未用节点图代替点击。

外部互选OPEN、guest已确认seat、host身份是明确直接样例前提，不是假用户外部操作。公评输入字段仅预置稿，任意文本BLOCKED未改产品需求。Yes/No-only先只看样例未算通过，随后同会话分别Save/Update/Cancel/重开实点通过。

截图在连接器托管prototype-qa-report.html、outputs/j04-prototype-retest.html、outputs/figma-prototype-retest.html以及J06窄补六张截图；未写不存在的本地图片路径。真实服务/任意输入/并发权限/后端持久化/设备QA均未验证。

代表入口：[群](https://www.figma.com/proto/mKXV0NvBavRb6fnmQ2g2xV/Fancy?node-id=13-14&starting-point-node-id=13%3A14)、[饭后](https://www.figma.com/proto/mKXV0NvBavRb6fnmQ2g2xV/Fancy?node-id=2-62&starting-point-node-id=2%3A62)、[问卷](https://www.figma.com/proto/mKXV0NvBavRb6fnmQ2g2xV/Fancy?node-id=8-14&starting-point-node-id=8%3A14)。
