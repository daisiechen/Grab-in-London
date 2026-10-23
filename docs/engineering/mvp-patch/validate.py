"""Document-only checks; never starts services or reads secrets."""
import json,pathlib,re,unittest
BASE=pathlib.Path(__file__).resolve().parent
ROOT=BASE.parents[2]
class PatchPlanChecks(unittest.TestCase):
 def test_tasks_and_dag(self):
  tasks=json.loads((BASE/'tasks.json').read_text())['tasks']; indexed={t['id']:t for t in tasks}
  self.assertEqual(len(indexed),len(tasks)); done=set()
  for t in tasks:
   self.assertTrue(set(t['dependsOn'])<=done,t['id']);done.add(t['id'])
   for field in ('owner','status','acceptance','verification','files'): self.assertTrue(t[field],(t['id'],field))
  self.assertEqual({f'PATCH-{i:03}' for i in range(1,9)},set().union(*(set(t['patches']) for t in tasks)))
 def test_exact_inheritance(self):
  data=json.loads((BASE/'inheritance.json').read_text()); src=(ROOT/data['source']).read_text()
  original=dict(re.findall(r'\| (QA-(?:GATE|JOURNEY|AI)-\d+).*? / (BLOCKED|NOT_RUN) \|',src))
  self.assertEqual(15,len(original));self.assertEqual(original,{c['originalId']:c['originalStatus'] for c in data['cases']})
  ids={t['id'] for t in json.loads((BASE/'tasks.json').read_text())['tasks']}
  for item in data['cases']+data['risks']: self.assertTrue(set(item['taskIds'])<=ids); self.assertTrue(item['requiredEvidence'])
  self.assertEqual({'PASS':202,'NOT_RUN':4,'BLOCKED':11},data['counts'])
 def test_release_metadata(self):
  import hashlib
  data=json.loads((BASE/'release.json').read_text())
  self.assertEqual('P1.1',data['productVersion'])
  self.assertFalse(data['releaseApproved'])
  self.assertEqual(data['reviewedPlanSha256'],hashlib.sha256((BASE/'plan.zh-CN.md').read_bytes()).hexdigest())
 def test_local_links(self):
  for file in BASE.glob('*.md'):
   for link in re.findall(r'\]\(([^)]+)\)',file.read_text()):
    if not re.match(r'https?://',link): self.assertTrue((file.parent/link.split('#')[0]).exists(),(file.name,link))
if __name__=='__main__':unittest.main()
