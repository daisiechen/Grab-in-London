# J04 PM作者自检（产物PM-r02）

需求输入requirementsRevision=PM-r01；Demo候选demoRevision=PM-r02；产物revision=PM-r02。本轮仅修复窄屏表达缺陷，PRD与coverage业务输入仍为PM-r01，未改业务逻辑。合成内存原型，不是独立QA。

运行：`python3 -m unittest discover -s tests -p test_pm_j04.py -v`。5项覆盖出席来源/窗口/私评分/公评发布、组合保存失败/未知/409与仅失败重试、OPEN撤回先确认/七天后撤回/拉黑不复活/其他有效依据、jsdom实际出席评分→部分保存→重试→互选→实际私信→撤回只读，以及文件哈希/自包含。本轮结果5/5 PASS（Node v24.22.1、jsdom30.1.2）。

完整浏览器视觉验收、原生iOS、真实双账号/后端事务/消息/独立支持纠错/统计传播、真实身份与政策：NOT_RUN。外部写入0；UX/RD/QA未启动。


## J04 窄屏溢出定向修订（PM-r02候选作者修订）

PJ实际Chromium复核发现390px视口的document.scrollWidth为629px，phone/content被撑到440px。根因是CSS Grid单列`1fr`默认auto最小尺寸受到review-state无空格JSON词串的min-content约束；同类flex/grid子项也可能被长内容撑开。

本次仅调整J04自包含HTML的CSS：布局列使用`minmax(0,1fr)`、phone及布局/flex/grid子项明确`min-width:0`，评审列在窄屏按100%可用宽度布局，状态与产品长内容以`overflow-wrap:anywhere`完整换行。没有新增overflow裁剪、没有删减状态文字或改变业务逻辑；原PRD、coverage及model未改。

实际执行（隔离、无登录、file原型）：`FANCY_PM_LAYOUT_BROWSER=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/fancy-browser-binaries LD_LIBRARY_PATH=/tmp/taskboard-pm-browser/libs/extracted/usr/lib/x86_64-linux-gnu FONTCONFIG_FILE=/tmp/fancy-browser-fonts.conf python3 -m unittest discover -s tests -p test_pm_j04.py -v`，结果6/6 PASS，包括原5项模型/DOM/哈希检查及新增真实Chromium布局回归。

布局回归覆盖320/390/480/720/1440五档视口，每档分别检查出席初始页、500字符反馈、2000字符连续无空格私信、撤回确认和只读历史共25组：document.scrollWidth不超过视口，phone/app/review/status均在视口内，按钮及输入不越右边界，review-state全文仍含末尾状态，pageerror为空。390px五状态截图在本次运行的`/tmp/fancy-j04-mobile-layout-repair/`供PJ读取，不作为仓库永久证据或线上已部署证明。

默认仓库测试不强依赖本机临时Chromium安装，新增布局用例显式开启时运行；本轮已实际开启通过。该检查是PM作者定向验证，不是UX、RD或独立QA启动，也不能外推完整无障碍、所有设备或真实服务验收。上线预览更新及线上复核由PJ另行记录。
