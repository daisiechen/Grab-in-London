# J03 PM作者自检

PM-r01，合成内存原型，不是独立QA。

运行：`python3 -m unittest discover -s tests -p test_pm_j03.py -v`，模型检查三种退出/区间空档/解散终态、断网保稿/读位独立/AI重验，jsdom实际点击发送失败恢复→发送→退群只读无名册，及文件哈希/自包含。本轮结果4/4 PASS（Node v24.22.1、jsdom30.1.2）。

真实浏览器视觉/原生iOS/真实双账号传输/邮件/服务端鉴权/多设备/后台同步/真实AI及费用：NOT_RUN。数据均为合成，外发0；UX/RD/QA未启动。
