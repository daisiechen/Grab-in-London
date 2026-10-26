# J02 PM作者自检

版本PM-r01，内存模拟原型，不是独立QA。

运行：`python3 -m unittest discover -s tests -p test_pm_j02.py -v`。4项检查覆盖模型DST/名额/锁定/声明/取消/截止、发布失败/未知及AI无自动业务写、jsdom实际点击四步发布→审批→锁定、入口自包含及哈希。本轮执行结果：4/4 PASS（Node v24.22.1、jsdom 30.1.2）。

真实浏览器视觉、真机iOS、OTP/OAuth、Places/照片、真实AI/费用与邮件/调度/跨账号消息：NOT_RUN。DOM执行不证明浏览器渲染或真实外部服务。所有数据为合成，网络/外发0，UX/RD/QA未启动。
