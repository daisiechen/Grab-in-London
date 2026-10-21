"""Validate AI specification traceability; does not certify model behavior."""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
PRD = ROOT / 'docs/product/PRD.zh-CN.md'


class AIRequirementsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = PRD.read_text()
        cls.ai = cls.text.split('### FR-13 ', 1)[1].split('## 7.', 1)[0]

    def test_one_specification_with_complete_acceptance_ids(self):
        self.assertEqual(len(re.findall(r'^### FR-13 ', self.text, re.M)), 1)
        headings = re.findall(r'^#### 13\.(\d+) ', self.ai, re.M)
        self.assertEqual(headings, [str(n) for n in range(1, 11)])
        ids = re.findall(r'^\| (AC-AI\d+) \|', self.ai, re.M)
        self.assertEqual(ids, ['AC-AI%02d' % n for n in range(1, 16)])
        self.assertIn('fe-ai-helper', self.text)
        self.assertIn('ai-assistance', self.text)

    def test_scope_stays_a_design_and_review_is_not_self_closed(self):
        scope = self.text.split('### 0.1', 1)[1].split('### 0.2', 1)[0]
        self.assertIn('建议纳入MVP', scope)
        self.assertIn('仍待产品负责人确认', scope)
        for boundary in ('不改Demo源码', '不修改原独立评审结论',
                         '不计入已批准开发包', 'N-02时间策略',
                         '不接真实模型', '规则单测只能证明模拟行为'):
            self.assertIn(boundary, self.ai)

    def test_context_and_draft_contracts_cover_real_authorization(self):
        for boundary in ('服务端先按公开权限查询', '不读群聊/私聊正文',
                         '不采信输入里的userId', '不拥有席位',
                         '本次明确修改 > 本会话已确认条件',
                         '不自动修改Discover筛选或地图位置',
                         '最高预算以预计区间上限比较',
                         '转入前若目标编辑器有未发送内容',
                         '未知placeId不伪造', '发送时再次鉴权',
                         '预约失败不等于不能招募', '不产生申请、席位、饭局、消息或通知'):
            self.assertIn(boundary, self.ai)

    def test_memory_errors_and_usage_have_separate_lifecycles(self):
        for contract in ('Confirm and remember', 'version', '版本检查',
                         '不自动迁入账号', 'now ≥ lastActivity+30分钟',
                         'New conversation', 'SUPERSEDED', 'FAILED',
                         '同一会话最多一个在途请求', '30秒硬超时',
                         '不循环自动重试', '不落长期聊天档案',
                         '默认30天后清理', '费用硬限额',
                         '失败/超时不扣成功轮额度', '不改后台指标算法'):
            self.assertIn(contract, self.ai)


if __name__ == '__main__':
    unittest.main()
