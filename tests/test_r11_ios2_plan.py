"""I2-only source facts, terminal paths, review address and consent geometry."""
import json
import re
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]

class IOS2DesignCounterexamples(unittest.TestCase):
    def setUp(self):
        data=json.loads((R/'docs/design/r10/ios-0.1.0-dev.2/figma-readback.json').read_text())
        self.roots={r['id']:r for r in data['roots']}
        self.nodes={n['id']:n for r in self.roots.values() for n in r['actions']}
    def text(self,id):return re.sub(r'\s+',' ',''.join(n['text'] for n in self.roots[id]['text']))
    def destinations(self,id):return {a.get('destinationId') for r in self.nodes[id]['reactions'] for a in r.get('actions',[]) if a.get('type')=='NODE'}
    def test_source_facts_and_terminal_return(self):
        self.assertEqual(self.destinations('1:853'),{'19:1152'})
        self.assertNotIn('Emma',self.text('19:1152'))
        self.assertIn('Current confirmed party: 1',self.text('19:1152'))
        self.assertNotIn('permanently locked',self.text('19:1152'))
        self.assertEqual(self.destinations('1:948'),{'19:650'})
        self.assertNotIn('Confirmed',self.text('19:650'))
        self.assertNotIn('permanently locked',self.text('19:650'))
        self.assertEqual(self.destinations('6:236'),{'19:765'})
        self.assertIn('Declined',self.text('19:765'))
        self.assertIn('Host-reported booking · 2 people',self.text('19:875'))
        self.assertNotIn('Needs update',self.text('19:875'))
        self.assertEqual(self.destinations('6:245'),{'19:241'})
        self.assertEqual(self.destinations('3:4389'),{'6:185'})
        self.assertEqual(self.destinations('3:4295'),{'19:211'})
        self.assertIn('Cancelled · Minimum not met',self.text('19:548'))
        self.assertNotIn('Cancelled · Host reason',self.text('19:548'))
        for id in ['3:4233','19:271','19:365','19:453','19:548']:
            self.assertFalse(any(a.get('type')=='BACK' for n in self.roots[id]['actions'] for r in n['reactions'] for a in r.get('actions',[])),id)
    def test_full_address_and_nonoverlapping_consent(self):
        for id in ['1:594','3:2365','3:3113','3:3248','3:3387']:
            self.assertIn('14 Sample Lane, London W1',self.text(id))
            for row in self.roots[id]['consentLayouts']:
                for span in row['spans']:
                    items=span['text']
                    self.assertEqual(len(items),2)
                    ordered=sorted(items,key=lambda x:x['y'])
                    self.assertLessEqual(ordered[0]['y']+ordered[0]['height'],ordered[1]['y'])
                    self.assertGreaterEqual(ordered[1]['height'],44)
        for id in ['1:449','4:164']:
            rows=self.roots[id]['consentLayouts']
            self.assertEqual(len(rows),1)
            self.assertEqual(len(rows[0]['spans'][0]['text']),1)
            self.assertGreaterEqual(rows[0]['height'],84)
        self.assertNotIn('1:694',self.nodes)




class IOS2EngineeringPlan(unittest.TestCase):
    def setUp(self):
        self.directory=R/'docs/engineering/r11/ios-0.1.0-dev.2'
        self.plan=json.loads((self.directory/'work-packages.json').read_text())
        self.inputs=json.loads((self.directory/'input-manifest.json').read_text())

    def test_registered_operations_methods_protocols_and_real_candidate_paths(self):
        import hashlib
        for op in self.plan['existingOperations']:
            source=(R/op['source']).read_text()
            self.assertEqual(hashlib.sha256(source.encode()).hexdigest(),op['sourceSHA256'])
            pattern=r"operationId\s*:\s*['\"]"+re.escape(op['id'])+r"['\"]\s*,\s*method\s*:\s*['\"]"+op['method']+r"['\"]\s*,\s*path\s*:\s*['\"]"+re.escape(op['path'].removeprefix('/v1'))+r"['\"]"
            self.assertRegex(source,pattern)
        registered={o['id']for o in self.plan['existingOperations']}
        for work in self.plan['workPackages']:
            self.assertTrue(set(work['operations'])<=registered)
            self.assertLessEqual(len(work['candidatePaths']),5)
            for path in work['candidatePaths']+work['verification']:
                self.assertTrue((R/path).is_file(),path)
            for proposal in work['proposedPaths']:
                self.assertEqual(proposal['status'],'not-created')
                self.assertFalse((R/proposal['path']).exists())
            for execution in work.get('executionSlices',[]):
                self.assertLessEqual(len(execution['files']),5)
                self.assertTrue(execution['writerRole'])

    def test_all_frozen_acceptance_items_have_actor_observable_unrun_cases(self):
        prd=(R/'docs/product/journeys/j02/requirements.zh-CN.md').read_text()
        required=set(re.findall(r'J02-AC\d{2}',prd))
        matrix=json.loads((self.directory/'test-matrix.json').read_text())
        cases=matrix['cases']
        self.assertEqual({a for c in cases for a in c['requirements']},required)
        self.assertEqual(len({c['id']for c in cases}),len(cases))
        for c in cases:
            self.assertEqual(c['run'],'NOT_RUN')
            self.assertIsNone(c['evidence'])
            self.assertGreater(len(c['expected']),35)
        text='\n'.join(c['expected']for c in cases)
        for critical in ['attemptId','If-Match','BST/GMT','confirmed party','insufficient','NOT_RUN']:
            if critical!='NOT_RUN':self.assertIn(critical,text)

    def test_dependency_graph_and_single_writer_deltas_do_not_wait_whole_other_versions(self):
        packages={w['id']:w for w in self.plan['workPackages']}
        self.assertFalse(self.plan['waitsForAllVersions'])
        visiting=set();done=set()
        def visit(key):
            self.assertNotIn(key,visiting)
            if key in done:return
            visiting.add(key)
            for other in packages[key]['dependsOn']:
                self.assertIn(other,packages);visit(other)
            visiting.remove(key);done.add(key)
        for key in packages:visit(key)
        self.assertEqual(packages['I2-P01']['dependsOn'],[])
        self.assertEqual(packages['I2-P06']['dependsOn'],[])
        self.assertEqual(set(packages['I2-P07']['dependsOn']),set(packages)-{'I2-P07'})
        for dependency in self.plan['integrationDependencies']:
            self.assertFalse(dependency['blocksWholeVersionPlanning'])
        gap={g['id']:g for g in self.plan['localGaps']}
        self.assertEqual(gap['I2-C01']['blocksOnly'],['I2-P01','I2-P07'])
        self.assertEqual(gap['I2-C03']['blocksOnly'],['I2-P04','I2-P07'])
        leases=self.plan['sharedWriteLeases']
        self.assertTrue(any('apps/api/src/meals/commands.ts'in x['paths']for x in leases))
        for work in packages.values():
            self.assertIsNone(work['assignedPerson']);self.assertEqual(work['exactWriteLease'],[])
            self.assertFalse(work['implementationStarted']);self.assertTrue(work['PRRequired'])

    def test_unknown_freezes_original_application_or_meal_version_and_separates_credentials(self):
        u=self.plan['unknownRecovery'];write=u['ordinaryWrite']
        self.assertIn('original If-Match or null',write['frozen'])
        self.assertTrue(write['currentReadIsNotIntentProof'])
        self.assertEqual(write['versionSource']['decideApplication'],'Application.version')
        self.assertEqual(write['versionSource']['editMeal/declareBooking/cancelMeal'],'Meal.version')
        self.assertIn('Do not silently substitute',write['onDefinite409'])
        self.assertIn('single-use',u['identity']);self.assertIn('never blind',u['identity'])
        self.assertIn('resourceKey/CAS',u['assistant'])
        self.assertIn('No invented GET /commands',write['mechanism'])

    def test_selected_inputs_and_outputs_are_exact_without_claiming_visual_repair_or_real_qa(self):
        import hashlib
        for path,digest in self.inputs['sourceSHA256'].items():
            self.assertEqual(hashlib.sha256((R/path).read_bytes()).hexdigest(),digest,path)
        for path,digest in self.inputs['outputSHA256'].items():
            self.assertEqual(hashlib.sha256((R/path).read_bytes()).hexdigest(),digest,path)
        status=json.loads((R/'docs/delivery/versions/ios-0.1.0-dev.2/status.json').read_text())
        self.assertEqual(status['pj'],'PJ-IOS-DEV2')
        self.assertFalse(status['implementationStarted']);self.assertFalse(status['QAStarted'])
        self.assertFalse(self.plan['implementationAuthorized'])
        self.assertTrue(status['engineeringApproved'])
        self.assertEqual(status['developmentPlan'],'plan-approved-with-issuance-gates')
        signature=status['independentEngineeringReview']
        independent=json.loads((R/signature['reviewFile']).read_text())
        self.assertEqual(independent['status'],'plan-approved-with-issuance-gates')
        self.assertEqual(hashlib.sha256((R/signature['reviewFile']).read_bytes()).hexdigest(),signature['reviewSHA256'])
        self.assertEqual(hashlib.sha256((R/signature['reviewMarkdown']).read_bytes()).hexdigest(),signature['reviewMarkdownSHA256'])
        self.assertEqual(signature['reviewedInputSHA256'],independent['inputSHA256'])
        package_path='docs/engineering/r11/ios-0.1.0-dev.2/work-packages.json'
        self.assertEqual(hashlib.sha256((R/package_path).read_bytes()).hexdigest(),independent['inputSHA256'][package_path])
        for path,digest in status['currentPlanSHA256'].items():
            self.assertEqual(hashlib.sha256((R/path).read_bytes()).hexdigest(),digest,path)
        self.assertTrue(all(g['status']=='not-issued'for g in status['issuanceGates']))
        binding=self.inputs['designSnapshot']
        if binding['visualRepairRebindRequired']:
            self.assertEqual(binding['unclosedVisualIssue'],'R11-I2-05')
            self.assertEqual(status['developmentPlan'],'candidate-awaiting-independent-RD-review-and-visual-rebind')
        else:
            for path,digest in binding['SHA256'].items():
                self.assertEqual(hashlib.sha256((R/path).read_bytes()).hexdigest(),digest,path)


if __name__=='__main__':unittest.main()
