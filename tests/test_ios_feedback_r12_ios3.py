"""C21 scoped layout/evidence invariants, not browser or real QA replacement."""
import json,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
class C21Evidence(unittest.TestCase):
    def test_all_i3_nav_derivatives_and_readonly_destinations(self):
        x=json.loads((R/'docs/design/r12/ios-0.1.0-dev.3/evidence/c21-navigation-readback.json').read_text())
        self.assertEqual(x['pageScan'],{'0:1':3,'1:2':0,'1:3':0})
        expected={'13:14':'2:2','30:14':'6:252','30:399':'30:307'}
        for root in x['roots']:
            self.assertFalse(root['navClips'])
            self.assertEqual(root['row']['layout'],'HORIZONTAL')
            self.assertEqual(root['row']['width'],375)
            self.assertEqual(len(root['labels']),5)
            self.assertTrue(all(n['width']==75 and n['height']==15 for n in root['labels']))
            self.assertLess(root['labelBottom'],root['safeAreaStart'])
            dest={a.get('destinationId') for n in root['existingRootActions'] for rx in n['reactions'] for a in rx['actions'] if a['type']=='NODE'}
            self.assertEqual(dest,{expected[root['root']]})
    def test_browser_claim_boundaries(self):
        x=json.loads((R/'docs/reviews/r12/ios3-user-feedback-2026-10-28.json').read_text())
        for c in x['cases']:
            self.assertIn(c['status'],['PASS','FAIL','BLOCKED','NOT_RUN'])
            if c['status']=='PASS':
                self.assertEqual(c['method'],'browser-click')
                self.assertTrue(c['steps'])
