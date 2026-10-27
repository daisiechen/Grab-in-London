# J06 PM作者验证

PM-r01／IOS-0.1.0，输入e7f2b895/r07。[PRD](requirements.zh-CN.md)与[自包含Demo](../../../../demo/journeys/j06/index.html)成对交付，待用户审阅；UX/RD/独立QA未启动。

## 实际执行

`python3 -m unittest discover -s tests -p test_pm_j06.py -v`：4项作者检查通过，使用既有Node24/jsdom，不安装环境。

- 模型：默认null、七原因、至少答一项、只答reason/只答again、清除again、失败保选择/不覆盖已保存版、同人更新版本且无mealId；未出席且超过7天仍可保存。
- DOM事件：设置入口→空提交错误→选择原因保存→返回找回→更新Yes→故障保选择→重试成功→清除again后再次保存，读取实际可见结果。
- 精确J06＋IOS-0.1.0原单元/原AC到PRD与场景或documented-only映射，保留分析端/隐私/真实合同约束，不在本包伪造统计页。
- 内嵌入口与源逐字节一致，无网络/浏览器持久化，manifest产物SHA256准确。

## 未执行与限制

真实浏览器视觉/键盘/读屏、原生iOS、真实身份/服务端upsert/持久化/异步/跨账号/删除传播、后台asOf查询与实际采集均NOT_RUN。jsdom不等于实际浏览器；本地“保存”只是合成账号当前页内存，不表示服务器已收到。J12分析后置，但本首发问卷不因其后置而被取消。

直接file打开index.html可看；源变更用`node demo/journeys/j06/build.mjs`重建。候选仅供产品查看，不自动派发后续专业或实际用户问卷。

## Demo PM-r02 评审链接修正

仅当非file协议且路径精确为托管根/j06/或/j06/index.html时，评审区PRD链接指向../#prd-j06；真实仓库file路径及仓库/demo/journeys路径保留原相对Markdown链接，无私有地址或业务改动。新增jsdom实际点击事件检查托管两入口、file路径、仓库HTTP路径及嵌套路径，验证解析后的目标；拦截默认导航，因此不声称已测试真实托管阅读器加载。保持自包含，无真实浏览器或后端新测试。

本轮 `python3 -m unittest discover -s tests -p test_pm_j06.py -v`：5项作者检查通过，包含原有流程、链接点击、最终文件哈希和自包含一致性。
