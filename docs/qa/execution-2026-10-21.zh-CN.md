# 独立QA执行报告 · 2026-10-21

**结论：部分执行，尚不能完成整体验收；不构成发布通过。** 已定向关闭：QA-F01, QA-F03, QA-F04, QA-F05, QA-F06, QA-F07, QA-F08, QA-F09, QA-F10, QA-F11, QA-F12, QA-F13, QA-F14, QA-F15, QA-F16, QA-F17, QA-F18, QA-F19, QA-F20, QA-F21, QA-F22, QA-F23, QA-F24, QA-F25, QA-F26, QA-F27, QA-F28, QA-F29, QA-F30, QA-F31, QA-F32, QA-F33, QA-F34, QA-F35, QA-F36, QA-F37, QA-F38, QA-F39, QA-F40, QA-F41, QA-F42, QA-F44, QA-F45, QA-F48；组件修复验证：QA-F02。保留修前失败历史和未执行断言。

原测试计划基线4659fdb；被测交接`8ba6fc7c9974cf6be1ac06d8b16e0380fb3beced`，业务代码`8bc1e9280153491b6a63c68cd6ba6a49f8061978`。Inbox分页修复在`cd66d87a153b3171cebbe7ae74680eceb356aed1`仅做定向复验；QA-F01及第二批P0探针在04cb601验证，第三批边界、删除/恢复和适配在d4582f7及后续仅CI增量版本定向验证，具体版本见运行表；更早证据沿用对应固定基线。

## 阻塞澄清与跟进

当前11条外部门槛仍需真实服务验收、发行设备、部署或政策批准证据；开发已告知除Apple待审核外资源就绪，不再沿用账号/Key未开通作为笼统阻塞。QA尚未把资源就绪等同实际接入通过。AI034属于本地NOT_RUN，原生runtime/签名/冷恢复已实际可运行；待测为重装token边界及受控AI生命周期。原14条中的本地隐私/恢复已通过。当前F44原生安全入口缺失为开发待修；完整双端旅程与新生产切片仍实际推进。

15分钟仅为兜底唤醒，无项目规定；发现问题直接交开发、有修复即复验，不等待定时周期。原14条已逐条交原开发会话处理，两条本地删除/恢复用例已通过，其余本地准备继续推进。

## 用例状态

| 状态 | 数量 |
|---|---:|
| PASS | 193 |
| FAIL | 0 |
| BLOCKED | 11 |
| NOT_RUN | 13 |
| N/A | 0 |

共217条。PASS只授予已核对完整预期的用例；相关测试通过但缺完整步骤/断言证据的仍为NOT_RUN。BLOCKED仍缺真实供应商、真实设备发行、部署或政策批准证据；本地已有可运行模拟器和正常签名原生UI，不能再用旧许可/runtime缺失概括。本地恢复与分步删除已独立通过。FAIL优先于未完成的后续步骤。

## 实际运行

B22 actual80 F48formal0a targetedclosed, normalguestApply/login/profile/exacttarget andPGapplication0/businessunchanged verified. F45formal6e75–78targetedclosed. 193PASS/13NOT_RUN/11BLOCKED; no wholeJourneycountincrease. F49actual79keyboardAskoccluded OPEN awaitingformalcbdbcandidate; F46actualfaultnoticeandAI034newpersistentPG RAMloss pending; unifiedHAB/Web-iOS/Adminsameenvironment planownedbydevelopment. Originalmainriglost F47; no releaseclaim.

| ID | 结果 | 范围 |
|---|---|---|
| R1 | 退出码0；569/569通过，失败0，86个测试文件 | `8ba6fc7` |
| R2 | 退出码0；169/169通过，失败0，25个测试文件 | `8ba6fc7` |
| R3 | 退出码0；29/29通过，失败0，1个测试文件 | `071ecd7` |
| R5 | 退出码0；11/11通过，失败0，1个测试文件 | `071ecd7` |
| R4 | 退出码0；workspace/infra typecheck; generated contract drift check; eslint --max-warnings=0; secret scan passed | `8ba6fc7` |
| R6 | 退出码0；6/6通过，失败0，1个测试文件 | `04cb601` |
| R7 | 退出码0；16/16通过，失败0，2个测试文件 | `04cb601` |
| R8 | 退出码0；9/9通过，失败0，1个测试文件 | `04cb601` |
| R9 | 退出码0；12/12通过，失败0，1个测试文件 | `d4582f7` |
| R10 | 退出码0；57/57通过，失败0，7个测试文件 | `d4582f7` |
| R11 | 退出码0；16/16通过，失败0，2个测试文件 | `d4582f7` |
| R12 | 退出码0；1/1通过，失败0，1个测试文件 | `29a78cf` |
| R13 | 退出码0；29/29通过，失败0，1个测试文件 | `2ded02f` |
| R14 | 退出码1；2/4通过，失败2，1个测试文件 | `2ded02f` |
| R15 | 退出码0；12/12通过，失败0，2个测试文件 | `0518d45` |
| R16 | 退出码0；26/26通过，失败0，1个测试文件 | `0518d45` |
| R17 | 退出码0；3/3通过，失败0，1个测试文件 | `2f665ec` |
| R18 | 退出码0；6/6通过，失败0，1个测试文件 | `f27c17d` |
| R19 | 退出码0；1/1通过，失败0，1个测试文件 | `5a37fdc` |
| R20 | 退出码0；1/1通过，失败0，1个测试文件 | `5a37fdc` |
| R21 | 退出码0；5/5通过，失败0，1个测试文件 | `bf297d9` |
| R22 | 退出码0；11/11通过，失败0，2个测试文件 | `ac09af4` |
| R23 | 退出码0；28/28通过，失败0，9个测试文件 | `ac09af4` |
| R24 | 退出码1；2/3通过，失败1，1个测试文件 | `159b0e8` |
| R25 | 退出码0；7/7通过，失败0，1个测试文件 | `8e2b908` |
| R26 | 退出码0；22/22通过，失败0，1个测试文件 | `8e2b908` |
| R27 | 退出码1；0/2通过，失败2，1个测试文件 | `361e85e` |
| R28 | 退出码0；3/3通过，失败0，1个测试文件 | `f298048` |
| R29 | 退出码0；3/3通过，失败0，1个测试文件 | `f298048` |
| R30 | 退出码0；17/17通过，失败0，1个测试文件 | `f298048` |
| R31 | 退出码0；4/4通过，失败0，1个测试文件 | `2462b97` |
| R32 | 退出码1；3/4通过，失败1，1个测试文件 | `291e115` |
| R33 | 退出码1；0/1通过，失败1，1个测试文件 | `291e115` |
| R34 | 退出码0；8/8通过，失败0，1个测试文件 | `b76c593` |
| R35 | 退出码0；32/32通过，失败0，4个测试文件 | `b76c593` |
| R36 | 退出码0；49/49通过，失败0，5个测试文件 | `1080993` |
| R37 | 退出码1；0/3通过，失败3，1个测试文件 | `e5d3542` |
| R38 | 退出码0；14/14通过，失败0，2个测试文件 | `a0287f9` |
| R39 | 退出码1；0/1通过，失败1，1个测试文件 | `fb26b28` |
| R40 | 退出码0；20/20通过，失败0，3个测试文件 | `360d1fe` |
| R41 | 退出码1；0/1通过，失败1，1个测试文件 | `360d1fe` |
| R42 | 退出码0；26/26通过，失败0，3个测试文件 | `6272e9d` |
| R43 | 退出码0；1/1通过，失败0，1个测试文件 | `360d1fe` |
| R44 | 退出码0；2/2通过，失败0，1个测试文件 | `b3adefe` |
| R45 | 退出码0；11/11通过，失败0，2个测试文件 | `b3adefe` |
| R46 | 退出码0；26/26通过，失败0，1个测试文件 | `b3adefe` |
| R47 | 退出码0；3/3通过，失败0，2个测试文件 | `1974180` |
| R48 | 退出码0；6/6通过，失败0，1个测试文件 | `739d6da` |
| R49 | 退出码0；1/1通过，失败0，1个测试文件 | `05faa12` |
| R50 | 退出码0；2/2通过，失败0，1个测试文件 | `6cc3055` |
| R51 | 退出码0；1/1通过，失败0，1个测试文件 | `0eb03af` |
| R52 | 退出码1；0/2通过，失败2，1个测试文件 | `e8844de` |
| R53 | 退出码0；3/3通过，失败0，1个测试文件 | `e8844de` |
| R54 | 退出码0；3/3通过，失败0，1个测试文件 | `49d22b6` |
| R55 | 退出码0；24/24通过，失败0，2个测试文件 | `49d22b6` |
| R56 | 退出码1；7/9通过，失败2，2个测试文件 | `49d22b6` |
| R57 | 退出码0；9/9通过，失败0，2个测试文件 | `49d22b6` |
| R58 | 退出码0；20/20通过，失败0，2个测试文件 | `49d22b6` |
| R59 | 退出码1；2/3通过，失败1，1个测试文件 | `49d22b6` |
| R60 | 退出码0；24/24通过，失败0，3个测试文件 | `5676dde` |
| R61 | 退出码0；1/1通过，失败0，1个测试文件 | `1253409` |
| R62 | 退出码0；2/2通过，失败0，1个测试文件 | `94f5c36` |
| R63 | 退出码0；26/26通过，失败0，3个测试文件 | `94f5c36` |
| R64 | 退出码0；2/2通过，失败0，1个测试文件 | `f481d25` |
| R65 | 退出码0；16/16通过，失败0，1个测试文件 | `f1c4e16` |
| R66 | 退出码1；0/1通过，失败1，1个测试文件 | `a1120ae` |
| R67 | 退出码0；6/6通过，失败0，1个测试文件 | `a1120ae` |
| R68 | 退出码1；0/1通过，失败1，1个测试文件 | `2125ca9` |
| R69 | 退出码1；0/1通过，失败1，1个测试文件 | `761304c` |
| R70 | 退出码0；1/1通过，失败0，1个测试文件 | `761304c` |
| R71 | 退出码0；14/14通过，失败0，3个测试文件 | `761304c` |
| R72 | 退出码0；3/3通过，失败0，1个测试文件 | `761304c` |
| R73 | 退出码0；2/2通过，失败0，2个测试文件 | `26317f8` |
| R74 | 退出码0；5/5通过，失败0，2个测试文件 | `26317f8` |
| R75 | 退出码0；1/1通过，失败0，1个测试文件 | `e66c5e6` |
| R76 | 退出码0；1/1通过，失败0，1个测试文件 | `8e94ab3` |
| R77 | 退出码1；0/1通过，失败1，1个测试文件 | `8e94ab3` |
| R78 | 退出码1；0/1通过，失败1，1个测试文件 | `8e94ab3` |
| R79 | 退出码0；2/2通过，失败0，1个测试文件 | `04f219d` |
| R80 | 退出码0；1/1通过，失败0，1个测试文件 | `04f219d` |
| R81 | 退出码1；0/1通过，失败1，1个测试文件 | `04f219d` |
| R82 | 退出码0；4/4通过，失败0，1个测试文件 | `04f219d` |
| R83 | 退出码0；1/1通过，失败0，1个测试文件 | `04f219d` |
| R84 | 退出码0；33/33通过，失败0，3个测试文件 | `ec379b0` |
| R85 | 退出码0；32/32通过，失败0，2个测试文件 | `ec379b0` |
| R86 | 退出码1；0/1通过，失败1，1个测试文件 | `492db55` |
| R87 | 退出码1；0/1通过，失败1，1个测试文件 | `492db55` |
| R88 | 退出码0；20/20通过，失败0，1个测试文件 | `492db55` |
| R89 | 退出码0；32/32通过，失败0，2个测试文件 | `492db55` |
| R90 | 退出码0；30/30通过，失败0，3个测试文件 | `980c8ed` |
| R91 | 退出码1；0/2通过，失败2，1个测试文件 | `4a0c66f` |
| R92 | 退出码1；0/2通过，失败2，1个测试文件 | `4a0c66f` |
| R93 | 退出码0；2/2通过，失败0，1个测试文件 | `2b9449a` |
| R94 | 退出码0；8/8通过，失败0，2个测试文件 | `2b9449a` |
| R95 | 退出码1；2/3通过，失败1，1个测试文件 | `61853fd` |
| R96 | 退出码0；3/3通过，失败0，1个测试文件 | `61853fd` |
| R97 | 退出码0；3/3通过，失败0，1个测试文件 | `61853fd` |
| R98 | 退出码1；2/3通过，失败1，1个测试文件 | `cc489ef` |
| R99 | 退出码1；1/2通过，失败1，1个测试文件 | `68374a9` |
| R100 | 退出码0；2/2通过，失败0，1个测试文件 | `68374a9` |
| R101 | 退出码1；2/3通过，失败1，1个测试文件 | `68374a9` |
| R102 | 退出码1；2/3通过，失败1，1个测试文件 | `68374a9` |
| R103 | 退出码0；3/3通过，失败0，1个测试文件 | `68374a9` |
| R104 | 退出码0；6/6通过，失败0，2个测试文件 | `cd66d87` |
| R105 | 退出码0；10/10通过，失败0，2个测试文件 | `cd66d87` |
| R106 | 退出码1；9/10通过，失败1，1个测试文件 | `c2d5b0d` |
| R107 | 退出码0；10/10通过，失败0，1个测试文件 | `c2d5b0d` |
| R108 | 退出码0；3/3通过，失败0，1个测试文件 | `7e372cd` |
| R109 | 退出码0；4/4通过，失败0，1个测试文件 | `7e372cd` |
| R110 | 退出码0；1/1通过，失败0，1个测试文件 | `aee2cdb` |
| R111 | 退出码0；2/2通过，失败0，1个测试文件 | `aee2cdb` |
| R112 | 退出码0；7/7通过，失败0，1个测试文件 | `9df9ab0` |
| R113 | 退出码1；7/7通过，失败0，2个测试文件 | `5b26fb3` |
| R114 | 退出码0；10/10通过，失败0，2个测试文件 | `5b26fb3` |
| R115 | 退出码0；2/2通过，失败0，1个测试文件 | `e775bef` |
| R116 | 退出码1；4/16通过，失败12，1个测试文件 | `b332b70` |
| R117 | 退出码1；14/16通过，失败2，1个测试文件 | `b332b70` |
| R118 | 退出码1；1/2通过，失败1，1个测试文件 | `b332b70` |
| R119 | 退出码0；2/2通过，失败0，1个测试文件 | `b332b70` |
| R120 | 退出码1；4/6通过，失败2，1个测试文件 | `b332b70` |
| R121 | 退出码1；0/0通过，失败0，1个测试文件 | `b332b70` |
| R122 | 退出码1；0/0通过，失败0，1个测试文件 | `b332b70` |
| R123 | 退出码0；4/4通过，失败0，1个测试文件 | `b332b70` |
| R124 | 退出码1；5/6通过，失败1，1个测试文件 | `b332b70` |
| R125 | 退出码0；6/6通过，失败0，1个测试文件 | `b332b70` |
| R126 | 退出码0；17/17通过，失败0，1个测试文件 | `61ff27c` |
| R127 | 退出码1；1/2通过，失败1，1个测试文件 | `61ff27c` |
| R128 | 退出码0；2/2通过，失败0，1个测试文件 | `61ff27c` |
| R129 | 退出码1；2/3通过，失败1，1个测试文件 | `61ff27c` |
| R131 | 退出码1；4/5通过，失败1，1个测试文件 | `61ff27c` |
| R132 | 退出码0；1/1通过，失败0，1个测试文件 | `61ff27c` |
| R133 | 退出码1；1/2通过，失败1，1个测试文件 | `61ff27c` |
| R134 | 退出码1；0/1通过，失败1，1个测试文件 | `61ff27c` |
| R135 | 退出码1；3/4通过，失败1，2个测试文件 | `61ff27c` |
| R136 | 退出码0；1/1通过，失败0，1个测试文件 | `61ff27c` |
| R138 | 退出码1；0/1通过，失败1，1个测试文件 | `61ff27c` |
| R137 | 退出码1；0/1通过，失败1，1个测试文件 | `61ff27c` |
| R139 | 退出码1；0/1通过，失败1，1个测试文件 | `61ff27c` |
| R130 | 退出码0；3/3通过，失败0，1个测试文件 | `61ff27c` |
| R140 | 退出码0；1/1通过，失败0，1个测试文件 | `61ff27c` |
| R141 | 退出码1；0/1通过，失败1，1个测试文件 | `61ff27c` |
| R142 | 退出码0；25/25通过，失败0，2个测试文件 | `19d1fb9` |
| R143 | 退出码0；1/1通过，失败0，1个测试文件 | `19d1fb9` |
| R144 | 退出码1；0/1通过，失败1，1个测试文件 | `19d1fb9` |
| R145 | 退出码0；1/1通过，失败0，1个测试文件 | `15934c2` |
| R146 | 退出码0；1/1通过，失败0，1个测试文件 | `15934c2` |
| R147 | 退出码1；1/2通过，失败1，1个测试文件 | `15934c2` |
| R148 | 退出码0；2/2通过，失败0，1个测试文件 | `15934c2` |
| R149 | 退出码0；2/2通过，失败0，1个测试文件 | `15934c2` |
| R150 | 退出码0；1/1通过，失败0，1个测试文件 | `15934c2` |
| R151 | 退出码1；0/1通过，失败1，1个测试文件 | `15934c2` |
| R152 | 退出码1；0/2通过，失败2，1个测试文件 | `15934c2` |
| R153 | 退出码0；2/2通过，失败0，2个测试文件 | `e731144` |
| R154 | 退出码1；0/1通过，失败1，1个测试文件 | `e731144` |
| R155 | 退出码1；0/1通过，失败1，1个测试文件 | `e731144` |
| R156 | 退出码0；2/2通过，失败0，2个测试文件 | `8ae96ef` |
| R157 | 退出码1；0/1通过，失败1，1个测试文件 | `8ae96ef` |
| R158 | 退出码1；0/1通过，失败1，1个测试文件 | `8ae96ef` |
| R159 | 退出码0；6/6通过，失败0，3个测试文件 | `8ae96ef` |
| R160 | 退出码1；0/1通过，失败1，1个测试文件 | `55a7f50` |
| R161 | 退出码0；1/1通过，失败0，1个测试文件 | `55a7f50` |
| R162 | 退出码0；1/1通过，失败0，1个测试文件 | `3b322cb` |
| R163 | 退出码1；0/1通过，失败1，1个测试文件 | `3b322cb` |
| R164 | 退出码0；1/1通过，失败0，1个测试文件 | `3b322cb` |
| R165 | 退出码0；1/1通过，失败0，1个测试文件 | `3b322cb` |
| R166 | 退出码1；1/3通过，失败2，1个测试文件 | `3b322cb` |
| R167 | 退出码1；0/1通过，失败1，1个测试文件 | `f796428` |
| R168 | 退出码1；0/1通过，失败1，1个测试文件 | `f796428` |
| R169 | 退出码0；3/3通过，失败0，1个测试文件 | `f796428` |
| R170 | 退出码0；3/3通过，失败0，1个测试文件 | `f796428` |
| R171 | 退出码1；0/1通过，失败1，1个测试文件 | `9e169ff` |
| R172 | 退出码0；1/1通过，失败0，1个测试文件 | `9e169ff` |
| R173 | 退出码0；15/15通过，失败0，2个测试文件 | `9e169ff` |
| R176 | 退出码1；0/1通过，失败1，1个测试文件 | `f7bb95e` |
| R174 | 退出码0；4/4通过，失败0，1个测试文件 | `f7bb95e` |
| R175 | 退出码0；1/1通过，失败0，1个测试文件 | `f7bb95e` |
| R177 | 退出码0；1/1通过，失败0，1个测试文件 | `f7bb95e` |
| R178 | 退出码1；0/0通过，失败0，1个测试文件 | `f7bb95e` |
| R179 | 退出码1；0/0通过，失败0，1个测试文件 | `f7bb95e` |
| R180 | 退出码1；0/0通过，失败0，1个测试文件 | `f7bb95e` |
| R181 | 退出码1；0/1通过，失败1，1个测试文件 | `f7bb95e` |
| R182 | 退出码0；20/20通过，失败0，3个测试文件 | `83dfde3` |
| R183 | 退出码0；2/2通过，失败0，2个测试文件 | `83dfde3` |
| R184 | 退出码1；0/1通过，失败1，1个测试文件 | `f7bb95e` |
| R185 | 退出码0；1/1通过，失败0，1个测试文件 | `83dfde3` |
| R186 | 退出码0；8/8通过，失败0，5个测试文件 | `83dfde3` |
| R187 | 退出码1；0/1通过，失败1，1个测试文件 | `83dfde3` |
| R188 | 退出码0；312/312通过，失败0，50个测试文件 | `611a90e` |
| R189 | 退出码0；7/7通过，失败0，3个测试文件 | `3919465` |
| R190 | 退出码1；0/0通过，失败0，0个测试文件 | `3919465` |
| R191 | 退出码0；2/2通过，失败0，2个测试文件 | `2debc60` |
| R192 | 退出码1；0/1通过，失败1，1个测试文件 | `3919465` |
| R193 | 退出码0；16/16通过，失败0，2个测试文件 | `4945453` |
| R194 | 退出码1；4/4通过，失败0，1个测试文件 | `042bc79` |
| R195 | 退出码0；13/13通过，失败0，2个测试文件 | `042bc79` |
| R196 | 退出码0；14/14通过，失败0，2个测试文件 | `cd69e09` |
| R197 | 退出码0；14/14通过，失败0，1个测试文件 | `19d1fb9` |
| R198 | 退出码0；15/15通过，失败0，3个测试文件 | `2005991` |
| R199 | 退出码0；3/3通过，失败0，1个测试文件 | `2005991` |
| R200 | 退出码0；12/12通过，失败0，1个测试文件 | `2005991` |
| R201 | 退出码1；0/2通过，失败2，1个测试文件 | `2005991` |
| R202 | 退出码0；2/2通过，失败0，1个测试文件 | `ff3231d` |
| R203 | 退出码1；0/1通过，失败1，1个测试文件 | `6e497d3` |
| R204 | 退出码0；1/1通过，失败0，1个测试文件 | `0a4593e` |

R1/R2为QA独立复跑既有实施测试；R3是QA新增29项API/数据库/纯函数探针；R5复跑分页修复回归，R6是QA第二批6项独立P0探针；R7/R8为QA-F01修复的API/Web及iOS组件定向复跑；R9是第三批12项独立边界探针，R10/R11复跑解除准备，R12为QA新增真实备份中E0导出的恢复后撤销分支；R13为饭后及群/私聊权限独立探针；R14保留QA-F03修前2失败，R15为0518d45修后的12项独立探针复验，R16为身份模块26项受影响HTTP回归（包括fresh会话下未来proof拒绝），不能删除修前结果或把历史失败当当前通过；R17为举报本人回执及撤授权重放3项独立HTTP/PG探针，撤session/DELETING状态通过受控数据库夹具设置。R18为安排锁、历史截止补算、开始名单及预约隔离6项独立PG/HTTP探针，删除仅屏障状态，完整删除名单断言仍未通过。R19/R20独立定向复跑5a37fdc关闭顺序单测及真实PG负载退出，未替代远端CI结果。R21为删除实际HTTP/本地purge、故障rollback及用户锁消息/审批竞态5项独立探针，生产日志脱敏仍待完整捕获。R22为ac09af4固定版本的11项独立受控AI/controller/HTTP探针，仅035/036/037具完整预期证据；R23为该版本Claude发现修复28项API/DB独立定向复验。R24保留QA-F04修前停用后仍发布失败；R25为8e2b908修后7项独立停用/费用/reaper探针，R26为22项受影响DB回归，F04定向关闭而043仍有未测断言。R27保留QA-F05修前Web失败，T001另为已分类夹具错误；R28/R29为f298048独立session/PG及Web组件各3项，R30为iOS manager17项定向回归；F05在NEW与TTL/偏好删除差异范围关闭。R31为公开DTO/后台角色/CSV授权及跨快照游标和大序号4项独立HTTP/PG探针，公式转义另覆盖formatter，不声称Excel实际执行。R32保留QA-F06 CLI入口失败，R33保留QA-F07原生协议失败；R34/R35固定b76c593独立8+32项验证CLI修复，R36固定1080993独立iOS49项验证桥接修复。完整加入用户路径仍NOT_RUN，不据组件通过升级。不能将这些数量相加当作独立业务用例数；R5与R1有重复，R2也不是原生设备验收。逐项测试名、状态、时间和命令见[机器证据](evidence/2026-10-21/automated-runs.json)。R4是质量检查而非业务用例。

曾以错误的pnpm参数调用iOS测试，得到“No tests found”且退出0；该次不计入证据。更正为Jest exec后实际169项通过。部分初始命令误命中Xcode shim并返回69；通过既有infra/dev-env.sh选择工具链后执行，未修改系统许可。

本地隔离PostgreSQL是真数据库；身份、餐厅、邮件及AI为test/fixture/mock。没有调用真实外部服务。既有研究文档未提交修改不属于测试基线，本轮不暂存。截图和快照仅包含合成测试资料；原始token、验证码、日志及本机凭据不发布。

交付验证：适用生产修复检查见原开发交接与每轮运行记录；历史R188全Web/admin为312通过（含当时F38工作树修复），F38正式定向关闭另见R189/B18。80 Python documentation/configuration tests passed; added fail-closed owned-native-safety guard. Native and actual journey evidence remain separately scoped. 历史失败、源hash、报告可重现性均验证，不把测试数量换算成217条用例通过。

远端CI：f27c17d run39567618348失败历史保留；5a37fdc修复后独立R19/R20通过。QA通过GitHub只读API核实bf297d9 run39568947238 completed/success（https://github.com/daisiechen/Grab-in-London/actions/runs/39568947238）；5a37fdc自身run被后续push取消，不算通过。

## 浏览器和缺陷

[B1 浏览器逐步记录](evidence/2026-10-21/browser-journey.zh-CN.md)覆盖创建、认证回流保稿、申请、审批、锁安排及群聊发送；未走完出席和后台闭环。

[缺陷登记](defects-2026-10-21.zh-CN.md)：QA-F01申请卡片缺场次信息在04cb601经B2浏览器及R7/R8定向复验关闭；QA-F02分页在071ecd7通过组件定向复验，范围不扩张到大数据浏览器负载。

## 逐条结果

完整预期、未证实断言、相关测试索引见[结构化执行记录](execution-2026-10-21.json)。下表证据ID对应机器证据中的唯一断言ID；“相关”索引只帮助继续执行，不证明整条用例通过。

| 用例 | 状态 | 结果或剩余工作 |
|---|---|---|
| QA-AUTH-001 · 游客浏览与敏感入口门禁 | PASS | Actual public Discover/detail/profile and private Meals/Inbox/Create/Apply gates verified; R186 actual guest Map/list fallback remains public and never writes. Fixture Google integration remains GATE002, not inferred live.；证据 B5-T005, R186-T004 |
| QA-AUTH-002 · 邮箱失败与恢复 | PASS | Actual native invalid-email/wrong-OTP rejection, explicit fixture correct-code recovery plus actual Web return to unsent initial application. Fixture OTP/IdP explicitly marked simulated in environment/evidence; real provider gate remains open.；证据 B16-O004, B4-T001 |
| QA-AUTH-003 · 验证码过期和重发 | PASS | Actual Web component server-derived30s cooldown/expiry error and explicit resend preserve email/new challenge/clear code, plus real PG exact300000ms expiry rejection and fresh adapter-issued OTP success. No real mail provider claim.；证据 R162-T001, R165-T001 |
| QA-AUTH-004 · 供应商取消回流 | PASS | F31 formalf796 actual React cancellation Google/Apple retains exact allowed apply target; explicit email retry reaches same meal editor, no apply call before Send. Planned browser_or_unit component scope satisfied. Separate actual-browser portal attempt rejected insecure authorization URL correctly; no real provider/browser provider-loop claim.；证据 R170-T002, R170-T003 |
| QA-AUTH-005 · 资料门槛 | PASS | B3固定8387580实际IAB：资料各缺项就地拒绝，合成完整资料成功返回原Create，随后饭局host公开投影与昵称/bio/English/Food录入一致；不公开email。一次London life未选导致提交拒绝，重新明确选择后正常保存，无稳定丢字段缺陷。仅本地fixture身份，非真实供应商。；证据 B3-T001 |
| QA-AUTH-006 · 退出及刷新边界 | PASS | B4真实IAB两次合成账号：Sign out弹确认，Stay signed in保持原账号；明确确认后回认证页，再reload仍认证页，不恢复离开账号。Web980c8ed/API8387580本地实际session；不是外部IdP持久登录/真实设备声明。；证据 B4-T006 |
| QA-INPUT-001 · 姓名长度1 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T001 |
| QA-INPUT-002 · 姓名长度2 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T002 |
| QA-INPUT-003 · 姓名长度40 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T003 |
| QA-INPUT-004 · 姓名长度41 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T004 |
| QA-INPUT-005 · 介绍长度19 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T005 |
| QA-INPUT-006 · 介绍长度20 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T006 |
| QA-INPUT-007 · 介绍长度1000 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T007 |
| QA-INPUT-008 · 介绍长度1001 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T008 |
| QA-INPUT-009 · 标题长度4 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T009 |
| QA-INPUT-010 · 标题长度5 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T010 |
| QA-INPUT-011 · 标题长度80 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T011 |
| QA-INPUT-012 · 标题长度81 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T012 |
| QA-INPUT-013 · 饭局说明长度19 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T013 |
| QA-INPUT-014 · 饭局说明长度20 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T014 |
| QA-INPUT-015 · 饭局说明长度1000 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T015 |
| QA-INPUT-016 · 饭局说明长度1001 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T016 |
| QA-INPUT-017 · 申请留言长度19 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T017 |
| QA-INPUT-018 · 申请留言长度20 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T018 |
| QA-INPUT-019 · 申请留言长度300 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T019 |
| QA-INPUT-020 · 申请留言长度301 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R3-T020 |
| QA-AUTH-007 · OTP尝试次数与一次消费 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T398 |
| QA-AUTH-008 · OTP丢响应 | PASS | 真实HTTP/test IDP：成功OTP响应丢弃后另一浏览器重放同clientRequestId/challenge/code得到409 STATE_CONFLICT，提示重新start；无cookie/凭据/data，通用idempotency无OTP验证明文结果。；证据 R32-T001 |
| QA-AUTH-009 · 同邮箱链接 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T412 |
| QA-AUTH-010 · 链接票据边界 | PASS | 真实HTTP/PG核LINK票据约10分钟TTL；令ticket恰过期后409不返回identities。其他family的原challenge proof403，正确proof仅成功一次，新intent再消费409且无旧身份列表。未真实提供方调用。；证据 R32-T002, R32-T003 |
| QA-AUTH-011 · 非空账户冲突 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T415 |
| QA-AUTH-012 · CSRF与开放重定向 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T402, R1-T406 |
| QA-AUTH-013 · refresh轮换重用 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T411 |
| QA-AUTH-014 · 退出后缓存和深链 | PASS | 独立真实PG/API：设备logout204撤销family及cookie；捕获cookie重放session、私密messages深链、旧clientMessageId及新写均401且DB消息数不增加；另一合法设备session200且消息201。R45 Web11项清除查询缓存、持久草稿及组件RAM，失联退出和迟到session也不恢复私密状态；R46原生session26项含SecureStore/cache清理。完整覆盖本条api_db_or_unit方法的三项预期；不等同真实浏览器全程或原生设备验收。；证据 R44-T001, R45-T001, R45-T002, R45-T003, R45-T004, R45-T005, R45-T006, R45-T007, R45-T008, R45-T009, R45-T010, R45-T011, R46-T001, R46-T002, R46-T003, R46-T004, R46-T005, R46-T006, R46-T007, R46-T008, R46-T009, R46-T010, R46-T011, R46-T012, R46-T013, R46-T014, R46-T015, R46-T016, R46-T017, R46-T018, R46-T019, R46-T020, R46-T021, R46-T022, R46-T023, R46-T024, R46-T025, R46-T026 |
| QA-DISCOVERY-001 · 地图列表与返回保持 | PASS | F33 actual browser filter/selected return plus actual router bounds/areas/card/profile path and controlled SDK two-meal/five-person map/list equality. Planned browser_or_unit scope; no live Google SDK certification.；证据 B16-O001, R182-T001, R185-T001 |
| QA-DISCOVERY-002 · 日期OR与跨字段AND | PASS | B5 Web980c8ed/API8387580固定本地合成环境。实际IAB两个不连续日期23/25取并集为2场，加入2人和English交集只Sunday；未应用Englishoff/Chineseon按Escape关闭后仍原1场，重新打开仍Englishtrue/Chinesefalse。未使用页面计算作预期，按已知四场日期/人数/语言/预算fixture核对；不代Google Maps真实服务。；证据 B5-T001 |
| QA-DISCOVERY-003 · 空结果恢复 | PASS | B5 Web980c8ed/API8387580固定本地合成环境。实际无场次Thu22显示0/No meals found，无伪推荐；Clear filters恢复原4个已知mealId。未使用页面计算作预期，按已知四场日期/人数/语言/预算fixture核对；不代Google Maps真实服务。；证据 B5-T002 |
| QA-DISCOVERY-004 · 地图拖动与点选 | PASS | Actual app GoogleMap/Discover with controlled SDK: camera idle changes only pending viewport, explicit Search this area applies, pin preview makes no detail/confirm/create call. Actual restaurant preview does not alter confirmed draft before Use. No real Google physical-device gesture claim; GATE002 stays blocked.；证据 B14-O001, B16-O003, R185-T001 |
| QA-DISCOVERY-005 · 选店无结果与旧选中 | PASS | Actual production create UI fixture search: empty query result retains old confirmed venue, no manual-add bypass; candidate preview does not change confirmed selection until explicit use. Published detail still North.；证据 B14-O001 |
| QA-DISCOVERY-006 · 预算上限和双语去重 | PASS | B5 Web980c8ed/API8387580固定本地合成环境。4场min20/max35，上限20/30均0、40为4，排除按min或平均27.5比较。English或Chinese并集4个唯一href，Chinese单独只双语场1次，不重复计同场。未使用页面计算作预期，按已知四场日期/人数/语言/预算fixture核对；不代Google Maps真实服务。；证据 B5-T003 |
| QA-DISCOVERY-007 · 分页扫描无副作用 | PASS | F27 formal15934 fixed. Real501-candidate continuation obeys500 cap; public list/detail execute under true PG read-only connection, with negative UPDATE/FOR UPDATE controls rejected25006; expiry has no APPLY/business writes.；证据 R149-T001, R149-T002 |
| QA-DISCOVERY-008 · 未提供菜系饮食 | PASS | B5 Web980c8ed/API8387580固定本地合成环境。host未提供菜系/饮食，Japanese或Vegan具体hard各0、Any恢复4；详情两字段Not provided，筛选与详情均host声明且无过敏保证。未使用页面计算作预期，按已知四场日期/人数/语言/预算fixture核对；不代Google Maps真实服务。；证据 B5-T004 |
| QA-DISCOVERY-009 · 坐标区域边界 | PASS | F24 formal8c3 coordinate mapper: lexical boundary/overlap, hole/MultiPolygon, unknown/invalid and actual HTTP confirmed point persistence independently verified. Licensed real London geometry remains external G-PLACES.；证据 R142-T023, R142-T024, R142-T025 |
| QA-CREATE-001 · 创建四步与返回保稿 | PASS | B3先前真实四步输入和Review未确认拒绝保留；正式Web980c8ed B4原条款返回路径两入口均Step4，false/true确认各自保留、餐厅显示仅RAM且不自动发布。返回安排/介绍/费用原字段不变，成功发布后同账号新Create无餐厅/时间、默认4不复用旧2。R90原QA组件与创建回归30项绿，R86/R87及B3原红保留。API8387580非AI核心未变；无真实外订。；证据 B3-T004, B4-T002, B4-T005, R90-T018 |
| QA-CREATE-002 · 外订声明与预算 | PASS | B3真实UI：倒置预算拒绝，£20–35到店付说明及0应用收费，不勾外订不能继续。B4在已确认4人声明后返回改2人，旧声明清空、文案同步2人、Continue要求重新确认；本人再次明确确认才可进Review。Web980c8ed/API8387580固定快照，无真实订位。；证据 B3-T004, B4-T004 |
| QA-CREATE-003 · 人数范围 | PASS | B12 actual production Web prevents invalid size/minimum choices at2/6 boundaries, preserves other draft fields; R107 independently verifies invalid actual API inputs422 without publish. Local real PG, fixture venue; not native or real restaurant booking.；证据 B12-O001, R107-T001, R107-T002, R107-T003, R107-T004, R107-T005, R107-T006, R107-T007, R107-T008, R107-T009, R107-T010 |
| QA-CREATE-004 · 时间菜单恢复 | PASS | F34/F35 formal actual Create and390/320 browser:48 slots,160x224 internal scroll/selected focus, keyboard and outside cancel preserve value; confirmed different venue clears time/declarations and explains required re-selection. Current PRD uses all48 planned slots, not obsolete supplier inventory filtering.；证据 B16-O002, B16-O003, R183-T001, R183-T002 |
| QA-DB-001 · 最后一席双审批 | PASS | 第二批QA独立探针在04cb601以真实隔离PG执行，完整预期核对通过；消息HTML显示另有B1纯文本浏览器证据。；证据 R6-T001 |
| QA-DB-002 · 锁等待跨截止 | PASS | 真实PG双连接确认审批已在截止前等待行锁；持锁至DB时钟越过截止后释放，HTTP409，EXPIRED及insufficient事实提交，无新增席位。；证据 R9-T011 |
| QA-DB-003 · 补齐后业务拒绝事务 | PASS | 第三批独立探针在d4582f7匹配源码完成；命令时钟精确边界及真实PG副作用按本条预期核对通过。；证据 R9-T012 |
| QA-DB-004 · 同键重试与变body | PASS | 第二批QA独立探针在04cb601以真实隔离PG执行，完整预期核对通过；消息HTML显示另有B1纯文本浏览器证据。；证据 R6-T002 |
| QA-DB-005 · 撤回与拒绝不同终局 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T421 |
| QA-DB-006 · 先批准再全部退出 | PASS | 真实HTTP批准/退出后，arrangement_locked_at保持原值；容量、餐厅、开始时间、预算、截止和饮食六类PATCH各409 ARRANGEMENT_LOCKED，整行不变，席位回到仅host。；证据 R18-T001 |
| QA-DB-007 · 开始前跌破minimum | PASS | 第三批独立探针在d4582f7匹配源码完成；命令时钟精确边界及真实PG副作用按本条预期核对通过。；证据 R9-T004 |
| QA-DB-008 · 开始后主持取消 | PASS | 真实PostgreSQL：H及A/B/C四人minimum3/capacity4，在startsAt精确0及+1ms分别以holder行锁同时阻塞host cancel与guest leave，观测两个不同backend均Lock等待后释放；二者均DEADLINE_PASSED。开始名单及全部seat_events逐行不变、无meal.cancelled事实；普通状态仍OPEN。MEAL report201并创建独立support_case，受理后开始资格不变；仅证明支持受理而非裁决完成。受控领域时钟在拿锁后注入，非真实2030年运行。；证据 R47-T002, R47-T003 |
| QA-DB-009 · 迟到worker按历史重放 | PASS | 隔离PG历史恢复夹具：截止时2人不足minimum3，截止后追加第三人；end后真实事务lockMeal补算仍按closesAt取消，事件effective_at恰为截止，不产start/end或名单。重试事件/通知/outbox不增。仅锁后时钟受控，未做真实worker进程停机演练。；证据 R18-T002 |
| QA-DB-010 · 退出恰好开始 | PASS | 组合独立证据：R18分别LEFT start−1ms/0/+1ms重建名单为排除/排除/保留；R21实际HTTP删除及本地worker清理后历史席位/封存名单/出席完整保留，不抹他人资格。外部供应商未完成不影响本地历史事实断言。；证据 R18-T003, R18-T004, R18-T005, R21-T001, R21-T002 |
| QA-DB-011 · 预约失败独立 | PASS | 真实事务FAILED声明不取消场/群；新增席位后HTTP再声明错误人数1，201但stale=true，仍OPEN且群未关闭。需更新由正式contract的stale字段表示，原状态保留REPORTED_CONFIRMED（host自报），无PROVIDER_CONFIRMED假成功。；证据 R18-T006 |
| QA-TIME-001 · 截止相对-1ms | PASS | 第三批独立探针在d4582f7匹配源码完成；命令时钟精确边界及真实PG副作用按本条预期核对通过。；证据 R9-T001 |
| QA-TIME-002 · 截止相对0ms | PASS | 第三批独立探针在d4582f7匹配源码完成；命令时钟精确边界及真实PG副作用按本条预期核对通过。；证据 R9-T002 |
| QA-TIME-003 · 截止相对1ms | PASS | 第三批独立探针在d4582f7匹配源码完成；命令时钟精确边界及真实PG副作用按本条预期核对通过。；证据 R9-T003 |
| QA-TIME-004 · 秋季未选偏移 | PASS | 独立HTTP分别覆盖start与close墙钟字段；BST/GMT落库UTC逐字匹配oracle，歧义/春季空缺422且无饭局落库。；证据 R9-T009 |
| QA-TIME-005 · 秋季BST | PASS | 独立HTTP分别覆盖start与close墙钟字段；BST/GMT落库UTC逐字匹配oracle，歧义/春季空缺422且无饭局落库。；证据 R9-T007 |
| QA-TIME-006 · 秋季GMT | PASS | 独立HTTP分别覆盖start与close墙钟字段；BST/GMT落库UTC逐字匹配oracle，歧义/春季空缺422且无饭局落库。；证据 R9-T008 |
| QA-TIME-007 · 春季不存在 | PASS | 独立HTTP分别覆盖start与close墙钟字段；BST/GMT落库UTC逐字匹配oracle，歧义/春季空缺422且无饭局落库。；证据 R9-T010 |
| QA-CHAT-001 · pending无群权限 | PASS | 第二批QA独立探针在04cb601以真实隔离PG执行，完整预期核对通过；消息HTML显示另有B1纯文本浏览器证据。；证据 R6-T003 |
| QA-CHAT-002 · 群区间空档分页 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T027 |
| QA-CHAT-003 · 退群与解散独立 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T026 |
| QA-CHAT-004 · 取消和结束可发言 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T023 |
| QA-CHAT-005 · 消息去重 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T024 |
| QA-CHAT-006 · 撤回与发送并发 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T028 |
| QA-CHAT-007 · 拉黑解除不恢复 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T025 |
| QA-CHAT-008 · 多场资格纠错 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T432, R1-T434 |
| QA-CHAT-009 · 轮询中断与恢复 | PASS | F11修复5676dde固定独立R60三文件24项通过，原deferred元数据红探针保持原前置和断言后转绿；HISTORY围栏不被迟到canSend/晚LIVE/错误信息重启，新的会话挂载仍可正常LIVE。GROUP/DIRECT后台暂停、2/4/8/16/30退避、先auth再补拉、403后HISTORY一次且保留未发文字、不自动send均核；R58原生poller/chat20项沿用，iOS生产无变化。R56原混合红和R59明确竞态红永久保留。受控UI/计时器，非真机网络。；证据 R58-T001, R58-T002, R58-T003, R58-T004, R58-T005, R58-T006, R58-T007, R58-T008, R58-T009, R58-T010, R58-T011, R58-T012, R58-T013, R58-T014, R58-T015, R58-T016, R58-T017, R58-T018, R58-T019, R58-T020, R60-T001, R60-T002, R60-T003, R60-T004, R60-T005, R60-T006, R60-T007, R60-T008, R60-T009, R60-T010, R60-T011, R60-T012, R60-T013, R60-T014, R60-T015, R60-T016, R60-T017, R60-T018, R60-T019, R60-T020, R60-T021, R60-T022, R60-T023, R60-T024 |
| QA-POST-001 · 结束前 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T001, R13-T002, R13-T003, R13-T004, R13-T005 |
| QA-POST-002 · 结束等号 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T006, R13-T007, R13-T008, R13-T009, R13-T010 |
| QA-POST-003 · 窗口最后 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T011, R13-T012, R13-T013, R13-T014, R13-T015 |
| QA-POST-004 · 七天等号 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T016, R13-T017, R13-T018, R13-T019, R13-T020 |
| QA-POST-005 · self优先与unknown | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T021 |
| QA-POST-006 · 评分范围与upsert | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T022 |
| QA-POST-007 · 无资格和自评 | PASS | 第四批独立真实PG/HTTP及精确命令时钟探针按完整预期通过；四个饭后窗口各覆盖SELF/HOST/体验/公评/再约五种操作。消息key按正式sender级唯一契约核验，撤回/发送使用真实双连接锁屏障两顺序。；证据 R13-T029 |
| QA-POST-008 · 公评双盲与到期发布 | PASS | R115 independent real-PostgreSQL production API/projection probes: unilateral reference is absent at end+7d-1ms and published exactly at end+7d; reciprocal references publish both sides before deadline. Public rows contain no consent/reconnect fields; non-selecting member sees selected=false/CLOSED and no other-authored private review. Synthetic local data and injected projection time; not native UI or real-provider evidence.；证据 R115-T001, R115-T002 |
| QA-POST-009 · 资格修订传播 | PASS | Independent R119 real PG and production support HTTP checks. Exact7d boundary uses production domain commands under injected effectiveNow, equality audit in same transaction; real HTTP role/MFA/case granted analyst cannot correct or read group history. Qualification loss changes fresh sealed metrics/public reviews and closes sole-basis direct; restoration does not duplicate ratings or restore consent.；证据 R119-T001 |
| QA-POST-010 · 支持窗与最小权限 | PASS | Independent R119 real PG and production support HTTP checks. Exact7d boundary uses production domain commands under injected effectiveNow, equality audit in same transaction; real HTTP role/MFA/case granted analyst cannot correct or read group history. Qualification loss changes fresh sealed metrics/public reviews and closes sole-basis direct; restoration does not duplicate ratings or restore consent.；证据 R119-T002 |
| QA-SURVEY-001 · 全空与仅因素 | PASS | R96 independent real PG/API: no-attendance actor blank422/company-only null; explicitfalse vs clear-null immutable revisions; duplicate/unknown/case/empty factors422, seven unique enumerated factors accepted. Eight-day-old completed meal score5 remains exactly one revision after expired score update409 and independent survey save200; no mealId accepted and no again/reasons in postmeal DTO. B8 real browser persistence and separate same-meal Admin score/survey evidence reused. R95 fixture setup failure permanently retained, not product failure.；证据 R96-T001, B8-T001, B8-T002 |
| QA-SURVEY-002 · No与清除不同 | PASS | R96 independent real PG/API: no-attendance actor blank422/company-only null; explicitfalse vs clear-null immutable revisions; duplicate/unknown/case/empty factors422, seven unique enumerated factors accepted. Eight-day-old completed meal score5 remains exactly one revision after expired score update409 and independent survey save200; no mealId accepted and no again/reasons in postmeal DTO. B8 real browser persistence and separate same-meal Admin score/survey evidence reused. R95 fixture setup failure permanently retained, not product failure.；证据 R96-T002, B8-T001, B8-T002 |
| QA-SURVEY-003 · 问卷与单场分离 | PASS | R96 independent real PG/API: no-attendance actor blank422/company-only null; explicitfalse vs clear-null immutable revisions; duplicate/unknown/case/empty factors422, seven unique enumerated factors accepted. Eight-day-old completed meal score5 remains exactly one revision after expired score update409 and independent survey save200; no mealId accepted and no again/reasons in postmeal DTO. B8 real browser persistence and separate same-meal Admin score/survey evidence reused. R95 fixture setup failure permanently retained, not product failure.；证据 R96-T003, B8-T001, B8-T002 |
| QA-PRIVACY-001 · 举报回执与本人范围 | PASS | 隔离HTTP+真实PG独立执行：举报本人回执RECEIVED→IN_REVIEW→RESPONDED，其他主体猜ID404；所有本人回执及双方通知无私密正文，无虚构已处理状态。支持访问仅用于合成case授权，未发生真实投诉处理。；证据 R17-T001 |
| QA-PRIVACY-002 · 删除同步屏障 | PASS | 真实HTTP删除202后未来host场取消、成员退席、pending撤回，全部活跃session撤销、mutual consent撤销及公开资料404。真实PG用户锁中先排队删除再消息/审批，两者拒绝且无新消息或批准席位；身份/餐厅为test适配器。；证据 R21-T004, R21-T005 |
| QA-PRIVACY-003 · 删除失败与丢响应 | PASS | R21真实DB删除journal故障500，user/epoch/meal/receipt/session整体回滚，移除后202丢响应、撤session仍凭预存receipt查最小三字段证据沿用。R61补实际非silent Fastify/Pino管道：子进程中故障异常故意含合成receipt秘密，捕获实际stdout含unexpected error及请求完成；500后ACTIVE/session200，重试202后session401，receipt POST200只含completedAt/requestedAt/status。receipt/accessToken均不在日志，所有调用URL无query，响应不含token。仅日志内存脱敏检查，不发布原始日志、不关闭部署日志运输/真实provider门槛。；证据 R21-T003, R61-T001 |
| QA-PRIVACY-004 · 开始后删除 | PASS | 开始后分别删除host/guest：真实HTTP受理再运行本地purge，席位/已封名单/双方出席原行不变，场仍OPEN不虚假取消；删除者消息正文脱敏/资料删除，另一人资料与消息保持。远端Unavailable，receipt诚实NEEDS_SUPPORT，不冒称最终完成。；证据 R21-T001, R21-T002 |
| QA-PRIVACY-005 · 快照导出撤销 | PASS | 真实S0/E0先CSV200并保留本地bytes；删除A202后五页overview/journey/supply/retention/quality、下钻首/旧cursor后页、E0下载及再导出均410。下载需要session/MFA（无session401）、private no-store，ticket期限≤15分钟，无公开长期URL。本地已取CSV哈希不变，明确服务器撤销不能抹已下载副本。R63自有ConsoleProvider探针先缓存A111/B222，再410清当前及所有缓存、picker打开、重新选未撤A必须网络重取333；实际App410清URL/页面及export处理回归也通过。仅本地HTTP/组件，非部署验收。；证据 R62-T002, R63-T008, R63-T012, R63-T021, R63-T023 |
| QA-PRIVACY-006 · MVCC构建与删除竞争 | PASS | 真实PG两连接：A主持未来M、确认N、pendingQ及开始后R；RR构建同事务显式读旧epoch后暂停原privacy FOR SHARE发送。普通删除HTTP202提交且epoch已升，再释放未改写的原SQL，PostgreSQL40001拒绝旧构建且snapshot行数不增加。重新构建成功；新snapshot_subjects及users/applications/seats/attendance/experiences/rosters均无删除A，公开profile404/session401；物理共享R的start_roster仍保留A历史资格，未复活身份。；证据 R62-T001 |
| QA-PRIVACY-007 · 供应商删除分步失败 | PASS | 生产worker+真实PG受控Auth0/Apple逐步故障、进程重建恢复、稳定幂等键及他人数据保留通过；仍不关闭真实供应商撤销门槛。；证据 R10-T050, R10-T051, R10-T052, R10-T053, R10-T054 |
| QA-PRIVACY-008 · 备份恢复删除台账 | PASS | QA扩展实际pg_dump/pg_restore：闸门在重放前阻API/worker，原receipt/身份失效及他人保留；备份前真实可下载E0恢复重放后由仍有效analyst会话读得410 SNAPSHOT_REVOKED且无CSV；重复重放和审计/时长通过。线上台账持久化/漏项检测仍属G-HOST。；证据 R12-T001 |
| QA-METRIC-001 · 零分母 | PASS | Independent targeted production probes R127 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R127-T001, B13-O002 |
| QA-METRIC-002 · 重复事件与伪成功 | PASS | R125 independent production metrics hand-calculated facts / real PG+HTTP snapshot checks. Dedup and forged success rejection, immutable S0/late S1, person-meal vs latest-user survey factors, classification exclusion/restoration each verified by the named assertion. No real telemetry deployment claim.；证据 R125-T004 |
| QA-METRIC-003 · 迟到接收 | PASS | R125 independent production metrics hand-calculated facts / real PG+HTTP snapshot checks. Dedup and forged success rejection, immutable S0/late S1, person-meal vs latest-user survey factors, classification exclusion/restoration each verified by the named assertion. No real telemetry deployment claim.；证据 R125-T005 |
| QA-METRIC-004 · 首次申请14天等号 | PASS | R82 独立手算fixture：首申请10月1日12Z，14天-1ms observing分母0、等号成熟1/1；同用户后续申请不替全历史first，选期排除历史first时不回捞较晚申请。直接调用现生产metrics函数并检查明细行/手算分子分母；不是页面计算作oracle，不代表CSV或浏览器全链路。；证据 R82-T001 |
| QA-METRIC-005 · 30天复赴约窗口 | PASS | R82 独立手算fixture：另场延迟0不复赴约，30天恰好纳入、30天+1ms不纳入；同meal两次出席revision仍只一场，重复率0/1。直接调用现生产metrics函数并检查明细行/手算分子分母；不是页面计算作oracle，不代表CSV或浏览器全链路。；证据 R82-T002 |
| QA-METRIC-006 · 申请出席成熟26小时 | PASS | R82 独立手算fixture：start10月1日18Z/end20Z，26小时-1ms分母0、等号1/1；start+24h仍未成熟，使用end+24h。直接调用现生产metrics函数并检查明细行/手算分子分母；不是页面计算作oracle，不代表CSV或浏览器全链路。；证据 R82-T003 |
| QA-METRIC-007 · 申请轮次归因 | PASS | R82 独立四轮fixture：撤回r1、确认并出席r2、B拒绝r3、另一取消场r4；结果分母4分子1，仅r2行计出席，所有适用轮次分母保留。直接调用现生产metrics函数并检查明细行/手算分子分母；不是页面计算作oracle，不代表CSV或浏览器全链路。；证据 R82-T004 |
| QA-METRIC-008 · 成团与取消分开 | PASS | Independent handwritten formation/cancellation facts plus actual3-seat lifecycle; classified third excluded in analysis peak2 but authoritative business formation stays unchanged.；证据 R125-T003, R146-T001 |
| QA-METRIC-009 · 问卷最新再筛 | PASS | R83独立手算：A9月25Yes、10月2No，asOf10月18查9月不回捞旧Yes；asOf9月30可见Yes有效1/1。B null+venue只有未答行且不入分母；全期A No分母1分子0，与B null严格区分。直接现行metrics函数，页面/CSV全链路另列。；证据 R83-T001 |
| QA-METRIC-010 · 问卷独立过滤 | PASS | Independent targeted production probes R130 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R130-T002, B13-O002 |
| QA-METRIC-011 · 评分和问卷粒度 | PASS | R125 independent production metrics hand-calculated facts / real PG+HTTP snapshot checks. Dedup and forged success rejection, immutable S0/late S1, person-meal vs latest-user survey factors, classification exclusion/restoration each verified by the named assertion. No real telemetry deployment claim.；证据 R125-T001 |
| QA-METRIC-012 · 预算互斥分段 | PASS | Independent targeted production probes R130 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R130-T001, R130-T003, R125-T002 |
| QA-METRIC-013 · 测试员工分类恢复 | PASS | R125 independent production metrics hand-calculated facts / real PG+HTTP snapshot checks. Dedup and forged success rejection, immutable S0/late S1, person-meal vs latest-user survey factors, classification exclusion/restoration each verified by the named assertion. No real telemetry deployment claim.；证据 R125-T006 |
| QA-METRIC-014 · 删除后peak重算 | PASS | Actual deletion202 after3-seat formation: newly sealed snapshot removes user contribution and recomputes analysis peak2; authoritative lifecycle/business formation remains unchanged.；证据 R146-T001 |
| QA-METRIC-015 · London周跨DST | PASS | Independent hand-computable fixed-asOf fixtures R109, actual production calculateMetrics. London2026-10-25 00:30Z and01:30Z both local01:30 and oneSunday; weekly keysOct19 forSunday thenOct26 forMonday, unique counts2 and1. Across fallback14-day maturity exactUTC ms and30-day repeat exactUTC accepted while+1h excluded. Exact plan1/2/3/10 and alternate1/2/4/10 yield nearest-rankP50=2/P90=10; later duplicate approval does not shift first decision, withdrawals/expiry/cancel have no decision duration, only one live pending; cancelled meal and exactclose pending excluded. This is independent fixture reconciliation, not page/network/native proof.；证据 R109-T001, R109-T002 |
| QA-METRIC-016 · 同快照全链路 | PASS | Independent actual S0 page/drilldown cursor/CSV across new S1 retain exact original filters/asOf/v4; hand oracle2/2→explicit S1 4/4, wrong-snapshot cursor422.；证据 R161-T001 |
| QA-METRIC-017 · 审核分位数 | PASS | Independent hand-computable fixed-asOf fixtures R109, actual production calculateMetrics. London2026-10-25 00:30Z and01:30Z both local01:30 and oneSunday; weekly keysOct19 forSunday thenOct26 forMonday, unique counts2 and1. Across fallback14-day maturity exactUTC ms and30-day repeat exactUTC accepted while+1h excluded. Exact plan1/2/3/10 and alternate1/2/4/10 yield nearest-rankP50=2/P90=10; later duplicate approval does not shift first decision, withdrawals/expiry/cancel have no decision duration, only one live pending; cancelled meal and exactclose pending excluded. This is independent fixture reconciliation, not page/network/native proof.；证据 R109-T003, R109-T004 |
| QA-METRIC-018 · 采集曝光阈值 | PASS | Independent targeted production probes R136 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R136-T001, R128-T001, R128-T002 |
| QA-ADMIN-001 · 五页导航与筛选 | PASS | B10 real browser traversed exactly five primary pages; en+zh and sizes2+3 OR retain English capacity2 meal; Chinese AND matching sizes yields no meals. Switching to English and navigating supply/retention preserves both sets, date and language. Local synthetic staff environment only.；证据 B10-T001 |
| QA-ADMIN-002 · 字典弹层焦点 | PASS | B13 actual browser observations and saved screenshots/DOM widths; B10 preceding empty-filter evidence retained. Fixed local snapshot, no real telemetry/vendor claim.；证据 B13-O001 |
| QA-ADMIN-003 · 小屏和空态 | PASS | B13 actual browser observations and saved screenshots/DOM widths; B10 preceding empty-filter evidence retained. Fixed local snapshot, no real telemetry/vendor claim.；证据 B13-O002 |
| QA-ADMIN-004 · 导出元信息 | PASS | F28 formale731 actual CSV pins snapshot/asOf/filterHash/v4, server-derived synthetic fixture provenance and no private body/contact/one-sided reconnect fields.；证据 R156-T001 |
| QA-API-001 · 公开字段白名单 | PASS | 游客/他人令牌读取公开profile与meal时profile键严格在公开白名单；私密邮箱/消息/举报及敏感字段不序列化。猜授权群历史和别人举报回执403/404；别人申请ID与主体不出现在自己的列表。合成身份、真实HTTP/PG。；证据 R31-T001 |
| QA-API-002 · 后台角色隔离 | PASS | 真实HTTP/PG：analyst改classification拒绝，data_admin+MFA/reason/version成功且有审计，但被标staff者无role/不能读后台，data_admin不能越权取消他人饭局。support无全表case接口且不能读分析/分类，仅case授权范围。；证据 R31-T002 |
| QA-API-003 · 错误版本与额外字段 | PASS | 第二批QA独立探针在04cb601以真实隔离PG执行，完整预期核对通过；消息HTML显示另有B1纯文本浏览器证据。；证据 R6-T006 |
| QA-API-004 · 游标篡改和大序号 | PASS | 真实HTTP/PG：snapshot cursor换主体/limit及篡改拒绝，真实meals下钻cursor用于另一snapshot拒绝422；列表和消息limit101拒绝。head大于2^53时发消息/读LIVE/扫描位置以十进制字符串准确往返，无Number精度损失。；证据 R31-T004 |
| QA-API-005 · CSV注入与下载授权 | PASS | 真实csvCell对=、+、-、@及空白/控制字符前缀加公式抑制并RFC quoting；真实CSV下载private no-store、无合成私密字段，换actor404、撤role/MFA403、隐私epoch变更410且非CSV。formatter断言非实际Excel执行，下载始终重新鉴权。；证据 R31-T003 |
| QA-NOTIFY-001 · 渠道收件人矩阵 | PASS | R104 fixed formal cd66d87 archive, actual API publish/apply/approve/decline/withdraw/leave/message/cancel and lifecycle worker: approved/declined requester in-app+email; cancelled only host/current pending/confirmed, excludes withdrawn/left; qualified close expires pending once in-app+email; message creates unread1 with no email. Actual approved seat and in-app notice remain when provider throws/UNKNOWN. UNKNOWN lookup timeout never resends; authoritative NOT_SENT alone permits same-ID retry. Original F19 red R98 retained; corrected original probe green, plus R10510 safety tests: exhaustion/age, concurrency one event, active lookup lease, observer fallback, runtime wiring. Only controlled provider/log alert proved; external mail/alert platform remains separate gate.；证据 R104-T004, R104-T005, R104-T006, R104-T001, R104-T002, R104-T003 |
| QA-NOTIFY-002 · 邮件失败不回滚席位 | PASS | R104 fixed formal cd66d87 archive, actual API publish/apply/approve/decline/withdraw/leave/message/cancel and lifecycle worker: approved/declined requester in-app+email; cancelled only host/current pending/confirmed, excludes withdrawn/left; qualified close expires pending once in-app+email; message creates unread1 with no email. Actual approved seat and in-app notice remain when provider throws/UNKNOWN. UNKNOWN lookup timeout never resends; authoritative NOT_SENT alone permits same-ID retry. Original F19 red R98 retained; corrected original probe green, plus R10510 safety tests: exhaustion/age, concurrency one event, active lookup lease, observer fallback, runtime wiring. Only controlled provider/log alert proved; external mail/alert platform remains separate gate.；证据 R104-T004, R104-T005, R104-T006, R104-T001, R104-T002, R104-T003 |
| QA-NOTIFY-003 · 通知隐私 | PASS | Actual outbox and production mail matrix: no private application/chat/report text or one-sided reconnect choice in email; unique event-recipient-channel records. Test outbox only, not real provider delivery.；证据 R104-T001, R104-T002, R104-T003, R104-T004, R104-T005, R104-T006, R153-T002 |
| QA-AI-001 · 偏好仅排序 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T471, R1-T310 |
| QA-AI-002 · 显式预算是hard | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T471, R1-T310 |
| QA-AI-003 · CLEAR持续抑制 | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T001 |
| QA-AI-004 · UNSET不是CLEAR | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T002 |
| QA-AI-005 · 完整集合先排序 | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T003 |
| QA-AI-006 · unknown饮食与soft | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T004 |
| QA-AI-007 · Spanish歧义 | PASS | Independent targeted production probes R126 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R126-T005 |
| QA-AI-008 · 便宜些需确认 | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T006 |
| QA-AI-009 · 日期自然周 | PASS | F25 formalf633 same effective seven London calendar dates used for actual search and explicit response bounds; natural Friday/next Friday replay green.；证据 R142-T018 |
| QA-AI-010 · 今晚和DST | PASS | Actual Node and PG fixed19:00 London clock: only future same-day18–23:59 eligible candidates; DST ambiguous time requires explicit offset and nonexistent time rejected. API/DB scope, not native picker.；证据 R150-T001 |
| QA-AI-011 · 无结果与不可用 | PASS | Controlled provider real PG: legitimate zero displayed as zero; provider unavailable fails without fabricated zero; legal persisted meals require non-null mandatory budget (23502 rejects invalid unknown).；证据 R153-T001 |
| QA-AI-012 · 只比较明确三场 | PASS | Independent targeted production probes R131 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R131-T002, R131-T003, R131-T004, R131-T005 |
| QA-AI-013 · 解释本人状态 | PASS | R80受控provider+真实PG：本人PENDING申请询问批准/付款，结果仅PENDING且不保留座位，不称批准/已确认/预付款要求；私有申请正文不传模型。隔离数据库临时重命名applications注入真实状态SQL读取失败，结果FAILED且result=null，不生成已知状态；finally恢复表名，业务行数不变。服务端实现范围，不代表真实模型供应商评测。；证据 R80-T001 |
| QA-AI-014 · 申请草稿无副作用 | PASS | B11 actual browser/editor and actual real PG/core routes on frozen cb9257e with controlled deterministic model. Application: original unsent preserved, Keep cancels, explicit samecandidate replacement twice noappend, six watched business writes0 through generate/transfer; only original Send creates one Pending/hostnotice and no guest seat, refreshsame. Create: onlytitle/description transferred; venue/date/time remainunset, venue validationblocks; budget/reservationunset until explicit humansteps; final termsfalse/Publishblocked and no new business writes. No paid-provider or native App claim.；证据 B11-T001 |
| QA-AI-015 · 创建草稿不默认同意 | PASS | B11 actual browser/editor and actual real PG/core routes on frozen cb9257e with controlled deterministic model. Application: original unsent preserved, Keep cancels, explicit samecandidate replacement twice noappend, six watched business writes0 through generate/transfer; only original Send creates one Pending/hostnotice and no guest seat, refreshsame. Create: onlytitle/description transferred; venue/date/time remainunset, venue validationblocks; budget/reservationunset until explicit humansteps; final termsfalse/Publishblocked and no new business writes. No paid-provider or native App claim.；证据 B11-T002 |
| QA-AI-016 · 非空编辑器冲突 | PASS | 独立Web生成后关闭助手编辑v2，重开Continue并取消替换，v2保留且无transfer/apply；R22服务端版本冲突、显式确认及重复转入证据互补，不能静默覆盖或追加。；证据 R22-T005, R29-T001 |
| QA-AI-017 · 生成转入发送三次鉴权 | PASS | 真实PG/HTTP三阶段：生成GROUP草稿无消息写，provider完整输入未含已发送群正文sentinel；退群后转入409 TARGET_CHANGED，再请求生成SUPERSEDED且无结果。另一群先生成并转入200，仍无消息写；随后主持明确解散，旧转入文字Send403且消息数0。各阶段服务器独立鉴权，不把AI生成/转入视作发送；只使用计数mock provider，不是真实模型或系统浏览器。；证据 R64-T001 |
| QA-AI-018 · 取消饭局仍可协调 | PASS | 真实PG/HTTP：主持取消未来饭局但未退群/解散；成员仍可生成GROUP草稿并转入，两个AI阶段消息数均0；只有本人随后显式POST消息才201且恰好1条。非成员发送隐藏404且无额外消息，conversation.dissolved_at仍null。饭局取消未被误当作群权限撤销，发送仍依成员授权。；证据 R64-T002 |
| QA-AI-019 · 目标切换与过期卡片 | PASS | 真实PG/controller FULL/CLOSED两分支：M1生成申请草稿不写业务，切M2转入TARGET_CHANGED；M1被其他人填满或截止后，原M1草稿转入也TARGET_CHANGED。随后SEARCH不再给M1可申请卡，手工填席后业务计数在AI操作期间不变，旧draft无占位。容量/截止检查不依赖人为递增meal.version，验证实时条件。；证据 R65-T001, R65-T002 |
| QA-AI-020 · 最小上下文 | PASS | 正式492db55：R88独立原020及hostile20项通过，R89本人资料保护32项通过。普通查询不读、当次明确本人请求才四公开字段、后续普通查询不继承；否定/引用/他人/模糊/editor/history不授资料权限，guest/缺资料澄清、SQL失败无生成、版本/字段在途变化SUPERSEDED，私有background/email不进provider，职业/完成承诺不借昵称绕过guard。复用R85显式编辑器同意回归，未同意不上传；R81修前红保留。；证据 R88-T020, R89-T001, R89-T002, R89-T003, R89-T004, R89-T005, R89-T006, R89-T007, R89-T008, R89-T009, R89-T010, R89-T011, R89-T012, R89-T013, R89-T014, R89-T015, R89-T016, R89-T017, R89-T018, R89-T019, R89-T020, R89-T021, R89-T022, R89-T023, R89-T024, R89-T025, R89-T026, R89-T027, R89-T028, R89-T029, R89-T030, R89-T031, R89-T032, R85-T008 |
| QA-AI-021 · 注入与伪身份 | PASS | 五项真实PG/受控provider矩阵：unknown tool、foreign user额外字段、未知URL拒绝；非成员试图给hidden group起草SUPERSEDED；带ignore-rules标题/描述的公开meal进入第二阶段时，模型额外tool/userId字段仍整轮拒绝。provider捕获输入无数据库中的private_contact秘密或隐藏群正文，生成/查询/拒绝前后application/message/meal计数不变，不扩大DTO或业务权限。；证据 R65-T003, R65-T004, R65-T005, R65-T006, R65-T016 |
| QA-AI-022 · 模型虚构与无效schema | PASS | 五项矩阵：不存在meal ID被事实源拒绝（SUPERSEDED），£30却返回999900金额、extra field、虚构工作/已订位、已付款/已批准等均FAILED且result null，无业务写和可操作残片。每次实际模型调用ai_calls KNOWN20，日/月used金额增量均精确等于调用数×20，包括无效结果，非真实供应商计费验收。；证据 R65-T007, R65-T008, R65-T009, R65-T010, R65-T011 |
| QA-AI-023 · 纯文本输出 | PASS | 三种模型文本script、img/onerror、未知https URL在草稿校验时整轮FAILED/result null，无业务写；未把脚本文字eval，global sentinel不存在。合法解释控制组仅返回已显式供给、源端存在的meal UUID，cards无url/href模型字段。按本条api_db_or_unit方法验证“拒绝”分支，不把服务器拒绝说成浏览器已执行恶意脚本。；证据 R65-T012, R65-T013, R65-T014, R65-T015 |
| QA-AI-024 · 确认记忆与日期排除 | PASS | R75真实PG+受控provider：预算/日期查询、生成提案均保持已存偏好原值；confirmation=false拒绝且下一查询成功，重新生成再显式确认才CAS写入version2。提案过滤日期，直接夹带dates/rawText也拒绝；DB仅六字段偏好，无日期/原查询，申请/消息/meal均无写入。16条其他测试由名称过滤排除，不计本次通过。；证据 R75-T001 |
| QA-AI-025 · 跨设备CAS | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T494 |
| QA-AI-026 · 删除偏好与迟到结果 | PASS | R76真实PG双旧session/挂起provider删除屏障通过；正式ec379b0独立R84原生组件/manager33项及R85 Web定向通过，原R77/R78保持失败历史。原QA foreground probe不改断言转绿：恢复读偏好epoch，变更清旧上下文，未发文字保留；未变epoch可恢复、校验期间隐藏旧值、离线阻请求/转入、晚响应不能覆盖新账号/NEW/再次后台、无activity隐式续TTL。Web visibility/focus同类回归与原QA偏好删除双编辑未发文字通过。组件模拟传输，不授原生设备/真实供应商门槛。；证据 R76-T001, R84-T003, R84-T026, R84-T027, R84-T028, R84-T029, R84-T030, R84-T031, R84-T032, R84-T033, R85-T013, R85-T014, R85-T015, R85-T016, R85-T017, R85-T018, R85-T019, R85-T020, R85-T021, R85-T022, R85-T032 |
| QA-AI-027 · 模型停用仍删偏好 | PASS | 真实server AI_PROVIDER=disabled（实际配置名，不虚构AI_ENABLED），请求503且provider未依赖；A本人偏好可读删，未登录401。B伪造userId仅返回B空偏好、以A版本删得409、猜目标路径404，A偏好不变。合成IOS A/B bearer也按owner隔离；IOS A删除后第二Web cookie视图字段清空且epoch同步，Web本人重新确认/删除仍可用。已提交饭局保留。只核HTTP/PG身份及多端会话语义，不冒称系统浏览器、原生设备或Keychain验证。；证据 R48-T006 |
| QA-AI-028 · 恰好30分钟 | PASS | runtime时钟+真实PG：TTL前1ms可读，恰好1800000ms无需后台timer即失效并abort，临时text/条件/artifact不可恢复；新会话空，保存账号偏好原行不变。Web组件精确TTL保留助手及业务未发文字。；证据 R28-T002, R29-T002 |
| QA-AI-029 · 活动真实性与重放 | PASS | 真实SessionService/PG+受控时钟：SEND/EDIT/显式操作续期；重复eventId、read不续时，HEARTBEAT拒绝；EDIT不足30秒不flush，到30秒写实际观察activityAt及expiry，非flush当前时刻。；证据 R28-T001 |
| QA-AI-030 · NEW与自动到期不同 | PASS | f298048修复：独立Web NEW清助手未发字但不清业务编辑器、不写偏好；恰好TTL保留两类未发字。R29-T003另证删除偏好仍保留两输入；R30 iOS manager17项通过，不是真机。；证据 R29-T002 |
| QA-AI-031 · 刷新与设备隔离 | PASS | 真实SessionService刷新带旧revokeHandle使旧会话失效；新会话及另一设备正文空。仅sessionId或错误device proof拒绝，DB元数据无正文及明文device token。仅本地设备绑定范围。；证据 R28-T003 |
| QA-AI-032 · 退出切账号与账号删除 | PASS | Independent targeted production probes R135 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R135-T001, R135-T002 |
| QA-AI-033 · 游客登录不迁偏好 | PASS | Planned api_db_or_unit method, independent real PG/core HTTP Web-cookie and native bearer/PKCE handoff. Pre-existing account identities and confirmed preferences explicitly seeded through PreferenceService, no OTP cooldown/time edits. Guest submits confirmed soft fields with private marker, completed turn readable before login; login revokes old guest/session410, existing account turns empty and saved fields/version1 unchanged. Native guest remains valid through OTP verification, then revoked atomically by actual handoff exchange. Account logout followed by mint/boot yields different guest token/subject and empty turns; no guest preferences persisted. Native transport API proof only, no running App/Keychain/actual device/UI claim; cross-client journeys remain NOT_RUN.；证据 R111-T001, R111-T002 |
| QA-AI-034 · iOS重装与冷启动 | NOT_RUN | F45 actualold69red retained; official6e actual75/76signed and77/78guest cold explicitContinue same liveID/count verified. Trueuninstall/reinstall oldauth/AI notadopted. F45targetedclosed; no full034PASS because trueAPI-RAMloss/liveunsentretention remainsunexecuted. Partial native assertions0/1 are described with direct B21 evidence only; numeric coveredExpectedIndexes reserved by existing validator for complete-casePASS, so empty until all034expectations complete.；证据 B20-O005, B21-O003, B21-O004 |
| QA-AI-035 · 主体1在途 | PASS | 隔离真实PG+受控provider：账号49成功轮前置，两设备与同会话不同requestId争最后名额，仅一个PENDING；其他AI_CONFLICT，provider只调用一次。NEEDS_INPUT结算后50轮，继续请求AI_QUOTA_EXCEEDED且无新call。；证据 R22-T006 |
| QA-AI-036 · requestId去重 | PASS | 真实HTTP并发同requestId同body均202且provider只调1次，结束后重放不调模型/扣轮；改body409 AI_CONFLICT，显式NEW清RAM后原请求410；Controller另验证runtime.shutdown后不重生成。quota仅successes1/reserved0。；证据 R22-T001, R22-T007 |
| QA-AI-037 · 最后成功轮竞争 | PASS | 真实PG原子预留第50轮，跨设备不超50；受控provider分别NEEDS_INPUT/SUCCEEDED扣1，FAILED与偏好删除导致SUPERSEDED不扣，所有reserved回0。重复finish不重复结算；无真实模型费用调用。；证据 R22-T006, R22-T008, R22-T009, R22-T010 |
| QA-AI-038 · 游客额度主体 | PASS | 真实PG/API和计数provider：同guest已9轮后完成第10轮；第二cookie视图刷新复用guest并保持原expiresAt，bootstrap及NEW重建仍同subject且429，不新增provider调用。DB凭据TTL精确24h；清cookie生成新subject可独立成功一次，明确其可规避匿名额度；合成expiry后旧凭据410并新建主体。错误Origin的创建/AI bootstrap和缺CSRF写均403。保留原subject10轮及新subject1轮记录；不声称真实等待24小时或匿名限额不可规避。；证据 R49-T001 |
| QA-AI-039 · 跨日和DST额度 | PASS | 真实PG生产SQL在隔离qa_clock search_path时钟与同钟RAM下执行：2026-10-24 22:59:59Z（London23:59:59）受理，provider受控暂停至23:00:01Z（次日00:00:01，UTC仍同日）才完成；仅受理日quota成功1/占位0，重复finish false不双扣，费用KNOWN20且callId一次。秋季2026-10-25 00:30Z与01:30Z均为London01:30；49轮后首轮成功至50，第二次新session仍AI_QUOTA_EXCEEDED，provider不增加。未修改生产SQL或宿主时钟，不将DDL默认created_at当虚拟时钟证据。；证据 R50-T001, R50-T002 |
| QA-AI-040 · 第2调用费用预留 | PASS | R25独立controller+真实PG：新增call名额仅1时解析call结算20microCNY、第2call预算拒绝不进入provider且无草稿；另两subject并发争最后3024microCNY最高费用预留，仅一个provider被调用，另一个FAILED，所有账本used+reserved不超cap，解析用量不丢失。；证据 R25-T003, R25-T005 |
| QA-AI-041 · UNKNOWN与失败计费 | PASS | 复用R25已独立失败usage：无usage UNKNOWN保留max3024不重发；已知失败按实际20结算；成功轮和占位0。新增R51真实两个API子进程：第一个buildServer收202、provider IN_FLIGHT后SIGKILL，无graceful onClose且DB仍PENDING；第二个全新API启动自动恢复，旧RAM重放410/provider calls0。请求FAILED RESTART，call UNKNOWN/actualNULL，两个期间预算均reserved3024/used0，quota成功和占位0、active_request null，旧call不能再次dispatch且总call1。只杀本测试创建的进程，不是真实供应商超时/账单验收。；证据 R25-T006, R25-T007, R51-T001 |
| QA-AI-042 · reaper迟到发布竞争 | PASS | 受控provider已在途，真实PG deadline置过去并先运行expireDeadlines将PENDING→FAILED；随后释放成功结果，费用照结算KNOWN但请求仍FAILED、result null、quota successes0/reserved0。迟到finish返回false且不调用publish回调。；证据 R24-T002 |
| QA-AI-043 · 未配置预算和停用 | PASS | R48真实PG/API五种配置：预算全缺、缺日、缺月、调用上限未配置（configure拒绝且不保存）、预算停用，均FAILED/无可用结果且provider计数0，ai_calls0、quota成功/占位0。每种情况下本人偏好GET/DELETE与已建饭局GET/PATCH仍成功。R25在途及结算后停用不发布证据复用，已核8e2b908至739d6da AI生产源码无变化；不重复已通过整套。；证据 R48-T001, R48-T002, R48-T003, R48-T004, R48-T005, R25-T001, R25-T004 |
| QA-AI-044 · 对账权限与幂等 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T490 |
| QA-AI-045 · 长度token及deadline | PASS | F10修复49d22b6正式独立R54原两探针及新增恢复路径3项通过：真实paste2001完整保留、inline报错、空白0请求、原文首尾空白2001不能trim绕过、缩短2000后明确发送一次；R55 iOS manager/widget24项包含原文保留/长度/恢复通过，非真机。R53服务器空白/2000/2001、16001输入token、真实适配器输出2001tokens安全失败且计费、deadline≤30秒；R25超时及迟到不发布复用。R52两项原红永久保留。；证据 R53-T001, R53-T002, R53-T003, R25-T002, R54-T001, R54-T002, R54-T003, R55-T001, R55-T002, R55-T003, R55-T004, R55-T005, R55-T006, R55-T007, R55-T008, R55-T009, R55-T010, R55-T011, R55-T012, R55-T013, R55-T014, R55-T015, R55-T016, R55-T017, R55-T018, R55-T019, R55-T020, R55-T021, R55-T022, R55-T023, R55-T024 |
| QA-CODE-001 · 生产隔离 | PASS | 正式26317f8独立R74通过：生产/staging拒测试适配及固定OTP；AST检查六端与生产包无旧Demo/shared权威、模拟键盘付款依赖。隔离副本语义破坏OpenAPI/SDK均使真实生成检查失败，恢复通过，原artifact字节不变；四端API/Web/iOS/admin typecheck通过，共享workspace client/contracts。；证据 R74-T003, R74-T004 |
| QA-CODE-002 · 数据库真约束 | PASS | R79隔离真实PG直接SQL：活跃申请partial unique拒23505、人数7 CHECK拒23514、非法host FK拒23503、重复message拒23505，原meal不变。空库先首迁移后植入version7用户，升级全部迁移并重跑no-op；附加失败迁移建表/改用户后除零，整迁移回滚，用户仍version7、半表不存在、迁移台账不增、随后正式迁移可重跑。验证失败迁移回滚与前向升级兼容，未声称支持任意生产降级。；证据 R79-T001, R79-T002 |
| QA-CODE-003 · 事务与锁顺序 | PASS | Write/auth/schema source inventory reviewed with original developer, independently corroborated by route sweep, exact current-state/lock-time/provider barriers and repaired F29/F30/F32 original counterexamples. Review PASS is bounded source/test review, not all services or native end-to-end release acceptance.；证据 CR2-O003, R148-T001, R148-T002, R156-T002, R164-T001, R172-T001 |
| QA-CODE-004 · 权限和响应schema | PASS | Write/auth/schema source inventory reviewed with original developer, independently corroborated by route sweep, exact current-state/lock-time/provider barriers and repaired F29/F30/F32 original counterexamples. Review PASS is bounded source/test review, not all services or native end-to-end release acceptance.；证据 CR2-O003, R148-T001, R148-T002, R156-T002, R164-T001, R172-T001 |
| QA-CODE-005 · SDK契约漂移 | PASS | 正式26317f8独立R74通过：生产/staging拒测试适配及固定OTP；AST检查六端与生产包无旧Demo/shared权威、模拟键盘付款依赖。隔离副本语义破坏OpenAPI/SDK均使真实生成检查失败，恢复通过，原artifact字节不变；四端API/Web/iOS/admin typecheck通过，共享workspace client/contracts。；证据 R74-T005 |
| QA-CODE-006 · 日志与存储泄露 | PASS | Independent source inventory of production logging and separate synthetic evaluation artifacts plus actual sentinel logging regressions verified; no real-provider quality gate inferred.；证据 CR2-O001, R74-T001, R74-T002, R143-T001 |
| QA-CODE-007 · 测试可信度 | PASS | Independent trust audit preserves real two-connection counterexamples, scheduling/fixture corrections and all real provider/native boundaries. F32 remains product failure; trust review PASS does not mean all product tests pass.；证据 CR2-O002, R156-T002, R164-T001 |
| QA-GATE-001 · G-AUTH真实三方式 | BLOCKED | 缺真实EMAIL/Google/Apple身份提供方、回调/PKCE及映射联调证据。开发先核对已有配置及本地回调测试，只有确实缺账号/域名配置/凭据时列明用户操作；不发真实身份请求替代授权。 |
| QA-GATE-002 · G-PLACES任意餐厅 | BLOCKED | 缺真实Google Places/地图key与Map ID配置下的placeId、坐标、署名和许可验收证据。开发先做适配及失效/缺配置回退测试，并列出真实配置依赖。 |
| QA-GATE-003 · G-MAIL真实收件箱 | BLOCKED | 缺真实邮件提供方与收件箱接收、去重及渠道矩阵证据。本地outbox/失败恢复可继续测；开发核对发送域/提供方和可用测试收件箱，缺账号配置才列用户依赖。 |
| QA-GATE-004 · G-IOS原生双端 | BLOCKED | Actual isolated iOS27.0 simulator and headless Release/XCUITest available; no missing-runtime/license claim. Formal build hashes and first-screen reviewed, QA OTP/profile actual taps proven. Complete native role journey/keyboard/background/real-device release evidence still pending; Jest/DOM not substituted. B21-O007 actualnativefocusedkeyboard obscuresquestion/Ask(79); F49OPEN. Do not substitute enabled/componentchecks for physicalnativeusability.；证据 B21-O007 |
| QA-GATE-005 · G-PRIVACY保留删除 | BLOCKED | 缺保留期限、备份和供应商删除政策的批准及真实执行证据。故障注入和本地删除屏障不需政策批准可先测；开发整理待批准政策差异与真实适配缺口，不笼统等待。 |
| QA-GATE-006 · G-HOST恢复与负载 | BLOCKED | 实际本地PG恢复闸门及删除台账演练通过；目标托管恢复/持久化独立台账、100并发网络/部署Recreate证据仍缺，不以Fastify inject代表目标环境。 |
| QA-GATE-007 · G-AI-MODEL真实评测 | BLOCKED | R10评测准备13项和60中英固定样本已核验；默认不读Key不联网、无真实捕获时NOT_RUN/BLOCKED。真实DeepSeek质量/人工可用率/延迟未测，不关闭门槛。 |
| QA-GATE-008 · G-AI-DATA供应商边界 | BLOCKED | 已提供官方参数/政策核查ADR并独立复跑本地适配边界；真实账户/留存及第三方数据批准仍缺，不继承其他供应商承诺。 |
| QA-GATE-009 · G-AI-COST实账 | BLOCKED | 缺真实usage/账单与call账本对照证据。并发人民币50预留已有本地通过证据；开发可预备对账脚本，真实账单必须来自已批准配置，不扩大金额或开自动充值。 |
| QA-JOURNEY-001 · 加入者完整闭环 | NOT_RUN | Actual mainM1 Webhost/Nativeguest and reverseM5 Nativehost/Webguest approval/groupmessages, lifecycle, SELFattendance/privateexperience/publicreferences andexplicitreconnect executed with realPG unique facts (B17/B18/B19). Earlier normalnativeApply12 started already authenticated; it does not establish full guestApply→login→profilegate return. KeepNOT_RUN until that prefix is actually replayed per required client/role and sameDBstafftrace is captured; no composition-based wholepathPASS. Native70 normalguest publicOPENfuturemeal has noRequesttojoin (actualAX+publicHTTP), so prefixfails beforeOTP; independentR203emptyactions reproduces. QA-F48 handednativeowner, wholecaseFAIL notNR. B22-O001 formal0a actual80normalguestApply/login/profile/sameoriginaltarget/noautoSend passes F48targetedfix. StillNOT_RUN untilsameenvironmentbothrolefullpath/admintrace; original70red retained.；证据 B7-T001, B7-T002, B7-T003, B7-T004, B8-T002, B9-T001, R93-T001, R93-T002, B10-T002, B19-O001, B19-O007, B19-O008, B20-O006, B22-O001 |
| QA-JOURNEY-002 · 主持者完整闭环 | NOT_RUN | F42targetedclosed formalcd69: originalNative52 missinghostcontrol retained; actual53unknown/no-default/Reviewcancel PG0; actual54HOSTabsent independentlyconfirmed; WebguestSELFpresent then Native55HOSTabsentagain preserves effectiveSELFpresent. R19614/0. Fullbothdirectionjourney still heldNR for thirdprivacyactor/sharedfactsadminprecondition and remainingassertions. B20-O004: sameDBsidecar bootstrap facts verified, but original rig autoexited during legalclockadvance; no sourceadminUI/snapshot/CSV executed. Environmentrecovery developerowned, not user blocker.；证据 B19-O004, B19-O005, B20-O003, B20-O004 |
| QA-JOURNEY-003 · 取消与聊天独立路径 | NOT_RUN | F39/F40 targetedclosed. Native0db35 actualhost Keepgroup preservesdraft/no write, explicitdissolve makesbothreadonly; samePGdissolvedseq8/messageCount3 provesdraftunsent. Native33/36/37 guestold+new/noabsencegap/noeditor passed; Native38 manualInboxpull restoreshostcoldreadonly/noReopen. Webhost independentlydissolvesnativeguest group3870, samePGdissolvedseq9/messageCount4; doesnotcancelmeal/changecurrentseats. FullcaseheldNOT_RUN untilsharedfactsreceipt/adminprecondition, not inflated fromtests. F41generalInboxreturn separate. B20-O004: sameDBsidecar bootstrap facts verified, but original rig autoexited during legalclockadvance; no sourceadminUI/snapshot/CSV executed. Environmentrecovery developerowned, not user blocker.；证据 B18-O001, B18-O002, B20-O003, B20-O004 |
| QA-JOURNEY-004 · 互选私密路径 | NOT_RUN | Original samePG bothrole feedback/mutualDM/withdraw and thirdB privacy retained. F44 native safety gap fixed formal2005991 and actual61–64 independent ownedPG targeted passed; not full original mirroredjourney. SameDBadmintrace still unexecuted; original61973 rig exited during reviewedclockadvance(F47), developer recovery pending. No wholecasepass.；证据 B19-O001, B19-O002, B19-O007, B19-O008, B19-O009, B19-O010, B20-O001 |
| QA-JOURNEY-005 · AI申请路径 | NOT_RUN | 本地生产实现尚需实际执行：显式查找→选明确M→生成申请→转入已有编辑器→本人确认提交。尚缺逐项证据：AI阶段无写；不覆盖未发字；提交时重验名额/截止；服务失败可继续原路径。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 B11 realWeb actualcontrolled-model generate/explicit-transfer/single-request and manual-create confirmations complete with physical write proof. Full failure-recovery/group-send and actual native role swap remain outstanding, so NOT_RUN retained. B21-O007 actualnativefocusedkeyboard obscuresquestion/Ask(79); F49OPEN. Do not substitute enabled/componentchecks for physicalnativeusability.；证据 B11-T001, B11-T002, B21-O007 |
| QA-JOURNEY-006 · AI创建及群草稿路径 | NOT_RUN | 本地生产实现尚需实际执行：生成Create草稿→原四步补选地点/条款→主动发布→群草稿→主动Send。尚缺逐项证据：没有模型代办；所有人工确认实际发生；生成/转入/发送分别授权。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 B11 realWeb actualcontrolled-model generate/explicit-transfer/single-request and manual-create confirmations complete with physical write proof. Full failure-recovery/group-send and actual native role swap remain outstanding, so NOT_RUN retained. B21-O007 actualnativefocusedkeyboard obscuresquestion/Ask(79); F49OPEN. Do not substitute enabled/componentchecks for physicalnativeusability.；证据 B11-T001, B11-T002, B21-O007 |
| QA-JOURNEY-007 · 反馈问卷独立路径 | NOT_RUN | 本地生产实现尚需实际执行：未出席账号填产品问卷 → 合格账号填单场评分 → 后台分别下钻CSV。尚缺逐项证据：问卷不要求资格、不归meal；评分仅合格人次；不混用公开评价或再约。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 |
| QA-JOURNEY-008 · 异常返回路径 | NOT_RUN | F41 targeted closed at042bc79: Native43 repeats originalNative41 read-chat/Back/Inbox probe and automatically restores five groups without pull; R19513/0. Original36/37/41 reds and manual38 recovery retained. F38 real429 visible/recovery also passed. Other full abnormal path assertions remain NOT_RUN.；证据 B18-O007 |
| QA-JOURNEY-009 · 支持删除闭环 | NOT_RUN | 本地生产实现尚需实际执行：举报→查本人回执→support个案→reauth删除→断网丢202→receipt查→后台快照撤销。尚缺逐项证据：受理不称处理完成；202同步屏障；receipt无私密数据；旧导出不可再读。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 |
| QA-API-006 · 重放仍检查授权 | PASS | 独立HTTP+PG：成功缓存响应后撤case grant、撤support角色、撤session family及actor置DELETING均拒绝同key重放，不泄露旧回执/私密内容、不新增举报或重复改case。撤session与DELETING用受控DB夹具，不代替完整退出/删除用户路径。；证据 R17-T002, R17-T003 |
| QA-API-007 · 缺版本与429退避 | PASS | 独立真实PG/API/SDK：编辑缺If-Match得428；真实writes限额得429和正Retry-After，SDK按该秒数退避，受控sleep中仅清合成actor限额模拟下一窗口；同原intent/key及version重试200，同key再重放仍仅一次meal.edited事实。未通过更换key规避限额，不声称等待了真实时长。；证据 R44-T002 |
| QA-API-008 · 五分钟再次认证 | PASS | QA-F03在0518d45修复，修前1秒/299秒HTTP反例已通过；另以可控锁后Tx.effectiveNow和真实HTTP/PG分别验证LINK/DELETE 299999/300000/300001ms及未来authTime，拒绝无删除受理或关联身份写入。未用真实供应商。；证据 R15-T001, R15-T002, R15-T003, R15-T004, R15-T005, R15-T006, R15-T007, R15-T008, R15-T009, R15-T010, R15-T011, R15-T012 |
| QA-API-009 · 空壳身份迁移 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T414 |
| QA-API-010 · 支持CLI回调 | PASS | QA-F06在b76c593修复。独立8auth探针含登记127.0.0.1固定path、非法host/scheme/path/port/query/hash/userinfo拒绝、provider直接/v1核心callback、303原state、60秒PKCE handoff错码/过期/消费拒绝、15min access无refresh；合成CLI凭据每次重查case/MFA/role。R35另独立32项含真实loopback listener联调。非真实浏览器/提供方MFA或上线验收。；证据 R34-T004, R34-T005, R34-T006, R34-T007, R34-T008 |
| QA-DB-012 · 截止字段发布边界 | PASS | Allowed unit variant: actual production validateArrangement supplied effectiveNow close-1ms accepts, exact close rejects error.code VALIDATION_FAILED; start-30min accepts/start-29min rejects. Actual client defaultClose suggests60min and rolls00:30 to previous23:30. No claim DB clock globally frozen or full UI journey; precise function validation only, as planned api_db_or_unit method.；证据 R107-T009, R107-T010 |
| QA-DB-013 · 开始前修改与旧job | PASS | Independent targeted production probes R132 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R132-T001 |
| QA-DB-014 · host不能退本人席位 | PASS | 第二批QA独立探针在04cb601以真实隔离PG执行，完整预期核对通过；消息HTML显示另有B1纯文本浏览器证据。；证据 R6-T005 |
| QA-DB-015 · 状态分区与历史轮次 | PASS | Independent targeted production probes R140 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R140-T001 |
| QA-CHAT-010 · JOIN消息LEAVE提交顺序 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T530, R1-T531, R1-T529 |
| QA-CHAT-011 · 单方同意投影 | PASS | 真实PG双连接及事务barrier：A单方选择在未提交时暂停，B的post-meal/profile/inbox与选择前完全一致；主动回滚后consents为0且投影不变。随后通过真实API提交A选择得WAITING，B仍无变化且DM404，只有A本人selected=true。全库notifications/outbox计数不变。analyst+MFA建立真实snapshot，源facts及supply/非空meal drilldown均不含pairId/selected/reconnect。覆盖本条API/DB方法预期，不涉及真实邮件发送或原生设备。；证据 R47-T001 |
| QA-CHAT-012 · 消息输入边界 | PASS | 第二批QA独立探针在04cb601以真实隔离PG执行，完整预期核对通过；消息HTML显示另有B1纯文本浏览器证据。；证据 R6-T004 |
| QA-AI-046 · 已有申请不再推荐 | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T007, R117-T008, R117-T009, R117-T010 |
| QA-AI-047 · 结果不足三张 | PASS | Independent controlled-provider production controller + real local PG R117; explicit/CLEAR/UNSET/search eligibility and account-state outputs verified per named assertions. Page appliedFilters object remains unchanged. Synthetic provider, no real model-language quality or native UI claim.；证据 R117-T011 |
| QA-AI-048 · 当日与未确认目标 | PASS | Independent targeted production probes R126 and cited UI evidence cover the original expected assertions. Local synthetic environment; real PG/API where stated, controlled clock/provider or component transport explicitly scoped. Historical setup/real failures retained; no native journey or real vendor claim.；证据 R126-T012, R126-T013 |
| QA-AI-049 · 创建与群草稿长度 | PASS | Independent R123 four assertions: application301, create81/1001 and group1001 rejected; exact300/80/1000/1000 allowed in core validator. Failed generation has no transfer artifact or business writes; no editor bypass. Controlled model and real PG for controller cases; pure core group boundary.；证据 R123-T001, R123-T002, R123-T003, R123-T004 |
| QA-JOURNEY-010 · 截止不足通知路径 | NOT_RUN | 本地生产实现尚需实际执行：H创建min3 → 仅A确认 → 到截止 → 查站内及邮件 → 群发消息。尚缺逐项证据：原因insufficient；当前成员通知各一次；群仍可发言；无退款承诺。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 |
| QA-JOURNEY-011 · 支持纠错全路径 | NOT_RUN | 本地生产实现尚需实际执行：CLI OAuth+MFA→授权case→end+7d纠错→新快照→私聊重验→审计。尚缺逐项证据：逐步权限重验；保留原报告；新资格传播，旧普通快照不改；不开放全表/消息正文。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 |
| QA-JOURNEY-012 · 后台分析分类路径 | NOT_RUN | 本地生产实现尚需实际执行：分析者过滤S0下钻CSV → data_admin改分类生成S1 → 显式切换。尚缺逐项证据：旧链路S0一致；分类不改登录权限；新快照排除测试贡献且保留筛选。已有相关自动化只作检索参考，不授予本条PASS；未归外部环境阻塞。 |
| QA-AI-050 · DeepSeek模型替换准入 | BLOCKED | DeepSeek本地适配34项及评测准备13项独立复跑通过；真实样本与延迟门槛尚缺，不能用受控响应关闭真实模型准入。 |
| QA-AI-051 · 人民币50月上限并发预留 | PASS | 按所列实际执行的断言核对完整预期通过；既有测试复跑与QA新探针的作者来源见R1/R3。；证据 R1-T484, R1-T486, R1-T239 |
| QA-AI-052 · 新供应商数据参数兼容 | BLOCKED | DeepSeek仅允许官方JSON/nonthinking白名单、拒store/tools、usage含reasoning计费/token上限等34项受控适配通过；真实账户地区/留存批准证据仍缺。 |

## 下一批执行顺序

1. Independently verify officialF49candidate and actual79keyboardreplay: physicalinput/Ask/header/Close, portrait andscrollablelandscape, controlledmockAsk/result/explicittransfer, preserveoriginalred.
2. Run ownedF46fixed503proxy actualnative logoutnotice, localclear vsremoteunconfirmed, then normal204 path; do not stop old3102/62044 or useDBfamilycleanup.
3. Review retained-parent AI034runner identity/stop/cleanup fixes then genuineAPI-child hardRAMloss andnormalnative410/liveunsentretention; neverrestartold3102.
4. Review unifiedjourney plan then executeH/A/B normalAPI, Web/iOS role swaps, legalworkerclock, notificationoutbox andsameDBadmintrace forremaining001–012; no fragment-to-wholepass.
5. Retain11real-provider/device/policy/deploymentblocked gates; exactCI987success is not releaseapproval.

Claude参与此前测试设计建议；本次动态执行及结论由Codex负责。Claude提出静态发现后由开发筛选复现修复至ac09af4，QA已独立定向复跑28项API/DB通过；不算Claude动态测试或完整交叉签收。
