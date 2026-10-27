"""R12 I2 source/intent and layout invariants; not a browser or service QA claim."""
import hashlib,json,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
D=R/'docs/design/r12/ios-0.1.0-dev.2'
def read(name):return json.loads((D/'evidence'/name).read_text())
def actions(n):return [a for r in n.get('reactions',[]) for a in r.get('actions',[])]
def writes(seq):
    out=[]
    for a in seq:
        if a['type']=='SET_VARIABLE':out.append(a['variableId'])
        for b in a.get('conditionalBlocks',[]):out+=writes(b['actions'])
    return out
class I2R12Feedback(unittest.TestCase):
    def test_place_pin_semantics_and_single_range_field(self):
        x=read('visual-readback.json')
        self.assertGreaterEqual(len(x['pins']),15)
        for p in x['pins']:
            self.assertEqual(p['texts'],[])
            self.assertLessEqual(p['width'],28);self.assertLessEqual(p['height'],34)
            self.assertTrue(p['reactions'])
        self.assertEqual(len(x['range']),2)
        for group in x['range']:
            self.assertEqual(group['height'],100)
            labels=[t['text'] for t in group['texts']]
            self.assertEqual(labels.count('Group size'),1)
            self.assertEqual(labels.count('People, including you'),1)
            self.assertNotIn('People, including you',labels[:1])
            self.assertNotIn('Minimum people, including you',labels)
    def test_min_max_guard_uses_other_endpoint_and_keeps_valid_draft(self):
        proof=read('range-readback.json');meta=read('interaction-nodes.json')['range']
        nodes={n['id']:n for n in proof['nodes']}
        self.assertEqual(sorted(c['value'] for c in meta['chips'] if c['key']=='min'),[2,3,4,5,6])
        self.assertEqual(sorted(c['value'] for c in meta['chips'] if c['key']=='max'),[2,3,4,5,6])
        for chip in meta['chips']:
            conditional=actions(nodes[chip['id']])[0]
            yes,no=conditional['conditionalBlocks']
            expr=yes['condition']['value']
            self.assertEqual(expr['expressionFunction'],'LESS_THAN_OR_EQUAL' if chip['key']=='min' else 'GREATER_THAN_OR_EQUAL')
            self.assertEqual(expr['expressionArguments'][0]['value'],chip['value'])
            other=meta['variables']['picker']['max' if chip['key']=='min' else 'min']
            self.assertEqual(expr['expressionArguments'][1]['value']['id'],other)
            self.assertNotIn(meta['variables']['picker'][chip['key']],writes(no['actions']))
            self.assertEqual(writes(no['actions']),[meta['error']])
            for endpoint in range(2,7):
                accepted=chip['value']<=endpoint if chip['key']=='min' else chip['value']>=endpoint
                if accepted:self.assertIn(meta['variables']['picker'][chip['key']],writes(yes['actions']))
    def test_range_cancel_and_edit_draft_do_not_commit_published_snapshot(self):
        meta=read('interaction-nodes.json')['range'];apply=actions(read('range-apply-readback.json'))[0]
        branches=apply['conditionalBlocks']
        pub=set(meta['variables']['published'].values())
        for branch,target in zip(branches,['56:290','1:24']):
            self.assertEqual(branch['actions'][-1]['destinationId'],target)
            self.assertFalse(pub.intersection(writes(branch['actions'])))
        proof=read('range-readback.json');nodes={n['id']:n for n in proof['nodes']}
        cancel=actions(nodes[meta['cancel']])[0]
        self.assertEqual(writes([cancel]),[])
        self.assertTrue(all(n['opacity']<0.5 and n['reactions']==[] for n in proof['locked']))
        save=next(n for n in read('visual-readback.json')['save'] if n['button']=='56:1194')
        self.assertTrue(pub.issubset(writes(actions(save))))
        self.assertEqual(actions(save)[-1]['destinationId'],'1:719')
    def test_padding_checkmarks_save_and_fixed_device_viewports(self):
        x=read('visual-readback.json')
        self.assertEqual(len(x['receipts']),4)
        self.assertTrue(all(n['rightPadding']==18 and n['rowWidth']==315 for n in x['receipts']))
        self.assertGreaterEqual(len(x['checks']),6)
        for c in x['checks']:
            self.assertEqual((c['x'],c['y'],c['width'],c['height']),(0,0,19,19))
            self.assertEqual((c['alignH'],c['alignV']),('CENTER','CENTER'))
        for b in x['save']:
            t=b['label'];self.assertEqual(b['layout'],'NONE')
            self.assertEqual((b['width'],b['height']),(351,45))
            self.assertEqual(t['height'],19);self.assertGreaterEqual(t['width'],200)
            self.assertLessEqual(t['x']+t['width'],b['width'])
            self.assertLessEqual(t['y']+t['height'],b['height'])
        v=read('viewport-readback.json')
        self.assertGreaterEqual(len(v['audit']),200)
        self.assertTrue(all(n['height']==n['expected'] for n in v['audit']))
        self.assertTrue(all(n['y']==0 for n in x['scrollOrigins']))
    def test_shared_detail_layout_keeps_dynamic_minimum_and_state_routes(self):
        p=read('shared-detail-final-readback.json');mut=read('shared-detail-mutations.json')
        self.assertEqual(len(p['details']),6);self.assertGreaterEqual(len(mut['cards']),21)
        for d in p['details']:
            self.assertEqual(d['bodyY'],0)
            self.assertEqual((d['hero']['width'],d['hero']['height']),(351,110))
            self.assertLess(d['facts']['y']+d['facts']['height'],d['host']['y'])
            self.assertLess(d['host']['y']+d['host']['height'],d['hero']['y'])
            self.assertEqual(d['minimum']['bound']['characters']['id'],'VariableID:90:369')
            self.assertEqual(d['deadline']['text'],['Applications close ','23 Oct, 18:00'])
            self.assertEqual(d['content']['y'],0)
        self.assertEqual(p['viewportMismatches'],[])
        n={n['id']:n for n in p['existingActionTargets']}
        self.assertEqual(actions(n['1:849'])[-1]['destinationId'],'1:880')
        self.assertEqual(actions(n['1:853'])[-1]['destinationId'],'19:1152')
        self.assertEqual(actions(n['3:3858']),[]);self.assertEqual(actions(n['3:4068']),[])
        layout=p['receiptLayout'];self.assertGreaterEqual(layout['notice']['y'],layout['card']['y']+layout['card']['height']+20)
        icon=read('shared-money-icon-source.json');self.assertEqual(icon['sourceNode'],'93:178')
        self.assertEqual((icon['width'],icon['height']),(14,14))
    def test_attendee_profile_and_optional_reason_do_not_leak_private_context(self):
        x=read('visual-readback.json')
        self.assertGreaterEqual(len(x['attendees']),6)
        self.assertTrue(all(n['width']==32 and n['height']==32 for n in x['attendees']))
        p=read('decline-readback.json');m=read('interaction-nodes.json')['decline'];nodes={n['id']:n for n in p['nodes']}
        touched=next(v for v in p['variables'] if v['id']==m['variables']['touched'])
        self.assertEqual(list(touched['values'].values()),[False])
        self.assertEqual([c['code'] for c in m['choices']],[None,'PLANS_NOT_ALIGNED','KEEPING_GROUP_SMALL'])
        self.assertEqual(actions(nodes[m['cancel']])[-1]['destinationId'],'1:880')
        self.assertEqual(actions(nodes[m['confirm']])[-1]['destinationId'],'6:185')
        self.assertNotIn('CONDITIONAL',[a['type'] for a in actions(nodes[m['confirm']])])
        final=read('final-consistency-readback.json')
        ids={v['id'] for v in final['radioVariables']}
        self.assertEqual(len(ids),3)
        self.assertTrue(all(list(v['values'].values())==[False] for v in final['radioVariables']))
        for row in final['radioRows']:
            outer,dot=row['markers']
            self.assertEqual((outer['type'],outer['width'],outer['height']),('ELLIPSE',14,14))
            self.assertEqual((dot['type'],dot['width'],dot['height']),('ELLIPSE',6,6))
            self.assertEqual(outer['x']+7,dot['x']+3);self.assertEqual(outer['y']+7,dot['y']+3)
            self.assertFalse(dot['visible'])
            self.assertNotIn('○',row['text']);self.assertNotIn('●',row['text'])
            values=[a['variableValue']['value'] for a in actions(row) if a.get('variableId') in ids]
            self.assertEqual(values.count(True),1);self.assertEqual(values.count(False),2)
        for id in ['1:931','94:493']:
            route=next(n for n in final['radioRoutes'] if n['id']==id)
            self.assertEqual([a['variableValue']['value'] for a in actions(route) if a.get('variableId') in ids],[False,False,False])
        self.assertEqual(len(p['applicantSamples']),2)
        self.assertTrue(all(s['actions']==[] for s in p['applicantSamples']))
        texts=['\n'.join(t['text'] for t in s['texts']) for s in p['applicantSamples']]
        self.assertIn('Host’s reason: The plans aren’t quite a fit.',texts[0]);self.assertIn('No reason provided.',texts[1])
        self.assertTrue(all('Application to this meal:' not in t for t in texts))
        self.assertIn('proposed-not-implemented',p['existingAPI'])
        source=(R/'packages/contracts/src/operations/meals.ts').read_text().split("operationId: 'decideApplication'",1)[1].split("operationId: 'withdrawApplication'",1)[0]
        self.assertNotIn('declineReasonCode',source)
    def test_frozen_inputs_claim_boundaries_and_label_consistency(self):
        m=json.loads((D/'artifact-manifest.json').read_text())
        for path,h in m['inputSHA256'].items():self.assertEqual(hashlib.sha256((R/path).read_bytes()).hexdigest(),h)
        for path,h in m['filesSHA256'].items():self.assertEqual(hashlib.sha256((D/path).read_bytes()).hexdigest(),h,path)
        self.assertFalse(m['realAPIReasonImplemented']);self.assertFalse(m['ownerApproved']);self.assertIsNone(m['namedVersionId'])
        c=read('c13-label-readback.json');self.assertEqual(len(c['changes']),12)
        self.assertTrue(all('optional' not in n['after'] for n in c['changes']))
        report=json.loads((R/'docs/reviews/r12/ios2-user-feedback-2026-10-28.json').read_text())
        self.assertEqual({c['id'] for c in report['cases']},{'C14','C15','C16','C17','C18','C19','C20'})
        for c in report['cases']:
            if c['status']=='PASS':self.assertEqual(c['method'],'browser-click');self.assertTrue(c['steps'])

    def test_public_data_privacy_copy_and_shadow_boundaries(self):
        p=read('final-consistency-readback.json');profile=p['publicProfile']
        public=[n['text'] for n in profile['texts']]
        bio='I moved to London recently and would love to meet people beyond my work bubble. Good food and easy conversation are my kind of evening.'
        self.assertIn(bio,public);self.assertIn(bio,(R/'demo/src/domain.ts').read_text())
        self.assertTrue({'Food','Photography','Travel','New to London','English'}.issubset(set(public)))
        self.assertNotIn('No public introduction provided.',public)
        self.assertNotIn('No public interests provided.',public)
        self.assertFalse(any('Application to this meal:' in x for x in public))
        self.assertEqual(profile['body']['primaryAxisSizing'],'AUTO');self.assertGreaterEqual(profile['body']['height'],500)
        self.assertEqual(profile['scroll']['height'],750)
        self.assertEqual(p['privacy']['text'],'Only you and Emma can see this reason.')
        self.assertEqual(p['privacy']['bound'],{});self.assertEqual(p['privacy']['height'],17)
        self.assertEqual(p['oldLargeMinimumFieldCount'],0)
        self.assertEqual(len(p['shadows']),3)
        self.assertTrue(all(n['actions']==[] and n['height']==100 for n in p['shadows']))

    def test_range_context_caption_is_only_a_ui_label_change(self):
        p=read('range-title-readback.json')
        self.assertEqual(p['header']['bound']['characters']['id'],p['titleVariable'])
        self.assertEqual(p['untouchedNodes'],['90:705','90:667','56:1194','3:2447'])
        for node in p['open']:
            before=node['before'][0]['actions'];after=node['after'][0]['actions']
            label=after[1]
            self.assertEqual(label['variableId'],p['titleVariable'])
            expected='Create a meal' if node['id'] in ['90:380','90:381'] else 'Edit meal'
            self.assertEqual(label['variableValue']['value'],expected)
            self.assertEqual(after[:1]+after[2:],before)
            self.assertEqual(after[-1]['destinationId'],'90:399')
