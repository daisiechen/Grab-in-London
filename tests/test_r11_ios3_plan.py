"""I3-only native design counterexamples. Real service/device QA remains NOT_RUN."""
import json
from pathlib import Path
import unittest
R = Path(__file__).resolve().parents[1]

class IOS3DesignCounterexamples(unittest.TestCase):
    def test_terminals_and_seat_actions_are_independent(self):
        d = json.loads((R/'docs/design/r10/ios-0.1.0-dev.3/figma-readback.json').read_text())
        nodes = {n['id']:n for p in d['pages'] for r in p['roots'] for n in r['nodes']}
        roots = {r['id']:r for p in d['pages'] for r in p['roots']}
        def targets(n):
            return {a.get('destinationId') for r in n.get('reactions', []) for a in r.get('actions', []) if a.get('type')=='NODE'}
        self.assertEqual(targets(nodes['6:264']), {'30:14'})
        self.assertEqual(targets(nodes['6:294']), {'6:252'})
        self.assertEqual(targets(nodes['7:919']), {'32:898'})
        self.assertEqual(targets(nodes['30:221']), {'38:34'})
        self.assertEqual(targets(nodes['32:985']), {'32:682'})
        confirm = nodes['30:158']['reactions'][0]['actions']
        self.assertEqual(confirm[0]['type'], 'SET_VARIABLE')
        self.assertIs(confirm[0]['variableValue']['value'], True)
        self.assertFalse(nodes['30:144'].get('reactions'))
        self.assertTrue(any(n.get('text')=='Open meal group' for n in roots['30:161']['nodes']))
        self.assertTrue(any(n.get('text','').startswith('This group is dissolved') for n in roots['30:307']['nodes']))
        self.assertEqual(nodes['6:423']['text'], nodes['6:544']['text'])
        self.assertEqual(nodes['6:423']['text'], nodes['10:80']['text'])
        self.assertIn('Please let the host know', nodes['10:80']['text'])
        condition = nodes['6:152']['reactions'][0]['actions'][0]
        self.assertEqual(condition['type'], 'CONDITIONAL')
        self.assertEqual({a['destinationId'] for b in condition['conditionalBlocks'] for a in b['actions']}, {'30:83','30:161'})
        contract=(R/'docs/design/r10/ios-0.1.0-dev.3/state-contracts.zh-CN.md').read_text()
        self.assertNotIn('离群/饭局终态不发新消息', contract)
        self.assertIn('取消/结束',contract)

    def test_public_edit_does_not_select_reconnect_and_update_does_not_answer(self):
        data=json.loads((R/'docs/design/r10/ios-0.1.0-dev.3/figma-readback.json').read_text())
        roots={r['id']:r for p in data['pages'] for r in p['roots']}
        nodes={n['id']:n for r in roots.values() for n in r['nodes']}
        def targets(n):return {a.get('destinationId') for r in n.get('reactions',[]) for a in r.get('actions',[]) if a.get('type')=='NODE'}
        self.assertEqual(targets(nodes['7:304']), {'7:334'})
        self.assertEqual(targets(nodes['7:425']), {'32:682'})
        self.assertEqual(targets(nodes['7:310']), {'32:576'})
        self.assertEqual(targets(nodes['7:417']), {'32:470'})
        color=nodes['7:418']['fills'][0]['color']
        self.assertGreater(color['r'],.99)
        self.assertGreater(color['g'],.99)
        self.assertEqual(targets(nodes['8:277']), {'8:133'})
        for root in ('8:63','8:133','8:279','33:46','33:243','33:437'):
            reactions=[n for n in roots[root]['nodes'] if n.get('reactions')]
            guards=[n for n in reactions if n['name']=='Original SVG / source node 3']
            self.assertEqual(len(guards),1)
            actions=guards[0]['reactions'][0]['actions']
            expected={'none':'8:14','reason':'8:424','yesReason':'8:473','noReason':'33:191','yesOnly':'33:388','noOnly':'33:582'}
            actual={a['conditionalBlocks'][0]['condition']['value']['expressionArguments'][1]['value']:a['conditionalBlocks'][0]['actions'][0]['destinationId'] for a in actions}
            self.assertEqual(actual,expected,root)
            self.assertTrue(all(a['conditionalBlocks'][1]['actions']==[] for a in actions))
        for root in ('8:133','8:63'):
            self.assertTrue(any(n['name']=='Choice / Yes' and n.get('reactions') for n in roots[root]['nodes']))
            self.assertTrue(any(n['name']=='Choice / No' and n.get('reactions') for n in roots[root]['nodes']))

class IOS3DevelopmentPlan(unittest.TestCase):
    def test_independent_version_plan_registry_and_leases(self):
        import re
        p=R/'docs/engineering/r11/ios-0.1.0-dev.3'
        plan=json.loads((p/'work-packages.json').read_text())
        matrix=json.loads((p/'test-matrix.json').read_text())
        self.assertFalse(plan['waitsForAllVersions'])
        self.assertFalse(plan['implementationAuthorized'])
        self.assertEqual(plan['journeys'],['J03','J04','J06'])
        registry='\n'.join(f.read_text() for f in (R/'packages/contracts/src/operations').glob('*.ts'))
        for op in plan['registeredOperations']:
            self.assertRegex(registry,r"operationId:\s*['\"]"+op+r"['\"]")
        self.assertEqual(len(matrix['cases']),22)
        self.assertEqual(plan['dependencyPropagation']['blocks'],['P02 real current-group roster projection integration'])
        self.assertTrue(all(w['dependsOn']==[] for w in plan['workPackages']))
        self.assertIn('original If-Match',plan['unknownAndVersionAuthority']['ordinaryWrites']['retry'])
        self.assertIn('no-record version 0',plan['unknownAndVersionAuthority']['objectVersions']['rule'])
        self.assertTrue(all(c['run']=='NOT_RUN' for c in matrix['cases']))
        self.assertTrue(any(d['id']=='I3-C01' and d['status']=='shared-writer-contract-delta-required' for d in plan['interfaceDeltas']))
        for w in plan['workPackages']:
            self.assertIsNone(w['assignedPerson'])
            self.assertEqual(w['exactWriteLease'],[])
            self.assertFalse(w['implementationStarted'])
            self.assertTrue(w['PRRequired'])
            self.assertTrue(w['independentCodeReviewRequired'])
            for path in w['candidatePaths']:
                self.assertTrue((R/path).exists(),path)
        survey=next(w for w in plan['workPackages'] if w['id']=='I3-P06')
        self.assertEqual(survey['dependsOn'],[])
        status=json.loads((R/'docs/delivery/versions/ios-0.1.0-dev.3/status.json').read_text())
        self.assertEqual(status['engineeringReview']['status'],'plan-approved-with-issuance-gates')
        self.assertTrue(status['engineeringReview']['metadataOnlyAfterReview'])
        self.assertFalse(status['implementationStarted'])
        self.assertFalse(status['QAStarted'])
        self.assertEqual(len(status['engineeringReview']['reviewedInputSHA256']),4)

if __name__=='__main__':unittest.main()
