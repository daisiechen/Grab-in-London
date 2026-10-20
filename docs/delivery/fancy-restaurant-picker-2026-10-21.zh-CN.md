# 创建饭局：餐厅搜索、计划时间与导航修订

日期：2026-10-21。基线：App `24e9c8b`、线上v11。范围为现有Demo及主PRD v0.7；用户确认暂不提供Google配置、不接真实API。保留四步创建、Ask Fancy及其他主页面布局。

## 用户批注与实现

| 批注 | 实现 | 验证 |
| --- | --- | --- |
| 选店不能只限3家 | 恢复示意地图拖动/缩放、当前区域搜索、本地搜索、候选预览及Use this restaurant；原3家只作样例。Add a restaurant接受任意名字/完整地址/区域，先Preview再确认；取消不覆盖原选店 | 地图候选/取消、搜索、拖动及缩放浏览器测试 |
| 真实Google Maps选店 | PRD明确正式产品使用Maps/Places、分店placeId与地址/坐标，非合作店白名单。当前Demo提供真正Google Maps搜索外链；返回不自动导入，可手动填写；不伪造Google结果/ID/坐标 | URL编码、手填校验、同名样例不覆盖手填地址的领域测试 |
| 时间不能只有3个点 | 所有餐厅统一Time原生下拉，00:00–23:30共48个半小时时刻；是计划时间，不代表营业或供应商库存 | 选择22:00完成发布；域测试验证23:30、半小时间隔与旧供应商限制分开 |
| terms应可点 | Review确认文字的cancellation terms链接打开条款页，按所选费用模式展示；返回保持Review和原勾选状态，不自动同意 | 浏览器点击、阅读、返回未勾选及正常发布 |
| Profile缺返回 | 左上返回、右侧Settings；从头像进入返回来源，从主导航进入返回前一个主页面，缺省Discover | 从Meals→Profile→返回Meals浏览器断言 |
| host名字旁箭头 | 去掉装饰箭头，保留头像/姓名查看主页 | 已发布饭局host行无svg断言 |
| 发布后返回不应再进Create | 发布/保存后详情父级固定Meals/Hosting；返回可见刚发布的饭局，不回已完成向导 | 完整发布→返回Hosting列表，校验新卡片与无Publish按钮 |

任意餐厅名称、完整地址和区域贯穿Review、发布详情及无人获准前的编辑。手填餐厅必须外部订位；不推断餐价或饮食保证，预算由发起人填写。新区域没有可用位置时只在发现列表展示，不伪造地图pin。更换选店清空时间、预约声明与最终核对，其他草稿保留。

## 验证

- App领域/助手64项、Sites6项、仓库Python46项、完整浏览器32项全部通过。
- TypeScript、生产构建与28个受保护运行时文件完整性通过；保留既有>500kB构建提示。
- 地图首次回归暴露通用button按下缩放覆盖pin的translate定位，使pin移出点击点；添加局部active定位覆盖，拖动达到阈值后才捕获指针。修复后真实点击、地图拖动和全量回归通过，未强制点击或跳过场景。
- 一条新增返回测试误用旧版Meals标题，按实际“Your next good meal.”修正；随后全量32项通过。调试输出已移除。
- 浏览器截图：[地图候选](../../demo/qa/restaurant-picker-2026-10-21/map-selection.png)、[任意餐厅发布](../../demo/qa/restaurant-picker-2026-10-21/arbitrary-restaurant-published.png)、[发布后Meals列表](../../demo/qa/restaurant-picker-2026-10-21/publish-back-to-meals.png)。

## 实现与接入边界

`RestaurantPicker.tsx`复用历史DemoMap，`domain.ts`分别保存RestaurantChoice、计划时间及历史供应商样例算法；`Prototype.tsx`只接线及局部路由变更，受保护运行时未修改。新建、编辑、详情与地图外链使用同一所选餐厅资料。

当前没有Google Maps/Places API、真实库存、订位、地理验证或跨设备持久化。示意地图与样例结果有可见标识；外链使用[Google官方Maps URL格式](https://developers.google.com/maps/documentation/urls/get-started)，不需API密钥但不能把选择自动带回。真实[Places接入](https://developers.google.com/maps/documentation/javascript/place-get-started)仍待配置和研发；本轮不创建Google项目、不启用计费或索要聊天中的密钥。

PRD/原型验证不等于真实研发完成，也不自动关闭此前双端研发准入报告中的其他阻塞。发布版本、源码比对和线上截图见本批QA的release.json及下方记录。

## 已发布

Sites v12状态succeeded：[手机Demo](https://grab-in-london-demo.daisie-chen-94.chatgpt.site/)。App提交`68ed7a808244c52a360d4eaf78cb52ecf18ca5b0`，Sites源码`116a70a72590cbedfab6799bf227110907878d49`，74个Demo源文件逐字节相同。线上已打开创建页并点击Casa Evening地图标记，确认候选预览与Use this restaurant、原选店未覆盖；Time包含全天48个时刻。见[release.json](../../demo/qa/restaurant-picker-2026-10-21/release.json)和[线上截图](../../demo/qa/restaurant-picker-2026-10-21/live-picker.jpg)。
