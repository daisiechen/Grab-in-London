# r11 J02定向修复交接（待独立复验）

01来源保持：Published1:719→Host statement19:1152/确认19:1324，背景始终仅host1/4；Confirm后19:997仍1/4，未替用户Approve。已更新host-only再次打开用19:1518/19:1692，Cancel回19:997。原Approved2人3:3907/5:188不改；已经更新2人3:4021打开新19:1888/19:1995，取消回同更新态，不退Needs update。Pending/Declined/Updated分别取消确认19:650/19:765/19:875，Keep各回原源事实；只有显式Approve变Confirmed。

02地址：Review及Ready/Terms/失败/未知衍生态原Place & time内显示The Little Table · 14 Sample Lane, London W1，卡片/下组/确认区已随长文重排。该地址来自冻结PM sample-place-soho-01的合成候选；旧v13视觉店名The Little Table作为该演示候选的视觉别名，非真实provider许可/分店验证。生产由已选placeId许可displayName/address提供，不硬编码别名或样例街道。

03终态：取消5种来源各自最新详情，Back→19:211 Cancelled父级，卡片用5个互斥二分条件回本次真实终态；不返回旧确认/已完成草稿。拒绝后6:185 Back→19:241 Hosting父级→同Declined详情；旧回执3:4329 Back也回6:185，不能靠BACK复活Approve。系统minimum不足明确Cancelled · Minimum not met，不写Host reason。真实服务器事实/幂等仍须实现验证。

04长确认：Costs与Confirmed的碎片字符串重组为单一322宽/84高段落；Review与Ready重组为完整安排核对句＋分离44pt下划线Read cancellation terms，打开条款不勾选本人确认，父级原生checkbox反应不等子链接反应。下游卡片/动作跟随重排，未缩字凑屏。未勾选Publish沿原禁用反馈，原无reaction保留。

原生完整读回与布局框在figma-readback.json；全图仍可变，无命名版本API。固定样例/条件导航是设计原型，未声称真实服务、任意输入或新Presentation全链通过。原作者只修，不自签；PJ-ADMIN独立复验后才本版开发方案。

截图边界：Review整屏用contentsOnly隔离导出以排除画布浮层干扰；表单滚动下方的单行节点导出受祖先clip无法作为视觉证据，已弃用空白crop，长确认区域以实际原生边界与独立Presentation滚动复验为准，不冒称已看不可见截图。

## R11-I2-05 Costs 助手避让

只改 Costs `1:449` 与本人已确认 `4:164`：复用v13原Tuck Fancy to edge样式（64px白色圆角外形、48px原SVG、原paw；右侧x349），默认边缘折叠。原helperDockPosition允许fraction=1，此处固定原底部停靠y678；点击折叠入口展开原助手，原hide再折叠（原生可编辑bool变量动作，非服务AI）。未删助手、未改品牌。两个状态独立变量，不改变本人确认门槛。

读回金额底边最大655.54 < 助手顶部678；任何正向页面滚动s使金额y减s，因此折叠和展开均不遮预算。新入口36:293/36:308，原展开1:577/4:269，hide1:589/4:281。`evidence/r11-costs-helper-readback.json`记录真值/绑定/动作/bbox；前后原生截图及scroll420截图已保存。滚动截图是临时原生content平移−420截图后恢复y0，不冒称Presentation实点。原助手在底部可能覆盖右侧空白触区边缘，但Continue文字/主点击中心保持可见；自由拖动与真实助手服务未验证。

原v13对照：既有old-costs.png + prototype.css helper-launch/is-tucked/paws与assistant.ts helperDockPosition。自有Playwright本轮启动EPERM立即退出，未新增环境；未伪称新源浏览器截图。独立复验待PJ-ADMIN，尚未自签05关闭。
