# IOS-0.1.0-dev.3 独立研发方案评审

两项原问题已由原作者修回并经独立复验关闭，限定为方案可实施，未启动代码/QA。不等I2整版。

## R11-EI3-01

P00同时承担既有契约核对与C01成员名单增量，而P01/P02/P03/P04/P05均等整个P00；需明确P00可独立完成existing-contract切片，C01仅卡P02名单接入，不传播阻塞消息/饭后/AI。应加入依赖传播反例。

证据：`docs/engineering/r11/ios-0.1.0-dev.3/work-packages.json`

## R11-EI3-02

三对象回执与survey等Unknown缺精确协议：普通幂等写需保原actor/op/method/path/body/key/原If-Match重放（不能当前GET版本换入原key）；sendMessage为clientMessageId去重且权限重验先于duplicate，失权后不能为恢复而重发；AI为resourceKey/requestId专用恢复。补独立对象版本/无记录0的服务端来源、混合成功只恢复未知/失败原意图及409本人新意图反例。

证据：`packages/contracts/src/operations/social.ts`、`apps/api/src/http/routes.ts`、`apps/api/src/conversations/routes.ts`、`apps/api/src/post-meal/experience.ts`、`apps/api/src/post-meal/reviews.ts`、`apps/api/src/connections/service.ts`

已核实际contracts/源码及3项方案检查通过，不代表API/DB/原生验收。成员区间严格端点、退席/退群/解散、WAITING私密/OPEN授权、三对象非原子编排与独立survey方向成立。真实跨版只限制对应联调，精确writer租约/环境/CI/PR合main及候选部署门槛保留。

独立复验关闭EI3-01：P00仅existing audit且明确排除C01；实际各包无整P00依赖，分别核消费合同，名单增量只限P02真实接入。T21固定C01仍open反例，不恢复全版互等；共享writer租约仍保持。

独立复验关闭EI3-02：普通写原actor/op/method/path/body/key/IfMatch恢复；消息按clientMessageId且失权停重发；AI原requestId/poll保费用责任。评分、公评、私密选择、问卷版本分别沿真实experience/reviews/connections/surveys权威与无记录0语义，不共享Save版本。T22覆盖评分已成功、公评未知、联系409，只恢复原未知项，冲突本人复核且不重写成功对象。

3项作者方案检查复跑通过；独立核JSON依赖与C01排除边界通过，22场景仍NOT_RUN。输入hash已刷新，未跑真实API/DB或设备QA。精确writer租约、名单新契约、环境、适用测试/联调、独立代码评审、CI及PR合main/精确候选部署门槛仍保留。
