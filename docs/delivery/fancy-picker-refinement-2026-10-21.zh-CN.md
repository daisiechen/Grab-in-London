# 选店、时间菜单、Profile与图片来源修订

2026-10-21；基线为v12 / `388a05e`。本轮以用户最新批注覆盖同日先前的手动新增与Profile返回设计；保留四步创建、条款阅读、发起人行去箭头和发布→Meals/Hosting。

- **选店**：去掉Add a restaurant、手填表单和无结果后的新增回退，只接受地图/搜索候选预览与确认。无结果不覆盖原选店；旧manual记录可读，但安排提交校验明确拒绝，不作为新建入口。正式产品从Google Places选店；未配置API时Demo仍为标明的本地示例。
- **Time**：复用已安装Radix，在手机portal内渲染紧凑菜单，触发器/菜单160px、箭头内缩16px、菜单最高224px，约5行、内部滚动。保持48个半小时时刻，打开定位已选值；新选店清空时间后从00:00开始，支持方向键/Home/End、Enter、Escape和外部关闭。菜单不超出手机边界，不修改受保护运行时。
- **Profile**：作为底部导航根页取消返回按钮，不再返回Meals。Settings、Edit等子页继续返回父级。
- **图片来源**：当前饭局卡片/详情统一使用本地`/images/restaurant.png`示意素材，并非用户上传或Google商家实拍。主PRD v0.8已确认正式图片从所选placeId对应Google Places照片取得，无图/失败用默认占位，更新餐厅同步换图。按返回的authorAttributions保留署名；依据[Google Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)。本轮只修改规则说明，未连接真实Google服务或替换为所谓Google照片。

## 验证

App领域/助手63项、Sites6项、仓库Python47项、最终完整浏览器33项通过。生产构建、TypeScript、28个运行时文件完整性和git diff --check通过；既有bundle>500kB提示保留。

新增验证：无手动入口、无结果保留选择、手动对象提交被拒绝；时间菜单与触发器同宽、最高224px、手机内边界、已选聚焦、方向键/Enter、Escape/外部点击；新选店后空值聚焦及End→23:30；Profile根页无返回、Settings子页仍可返回。原有申请/审批、出席、饭后、群聊、助手等完整回归保留。

第一次定向验证菜单定位误用aria-label“Choose a time”，实际继承触发器名称“Time”；修正断言。随后发现手机portal下方向键未推进选项，补充显式键盘移动与滚动保持，最终全量33项通过，未跳过失败场景。

截图：[紧凑时间菜单](../../demo/qa/picker-refinement-2026-10-21/compact-time.png)、[只有地图候选的选店页](../../demo/qa/picker-refinement-2026-10-21/map-selection.png)。Google API/照片、持久化和真实预约仍未接入；此验证不替代研发准入复评。发布版本与源码核对由本批QA的release.json和线上截图登记。
