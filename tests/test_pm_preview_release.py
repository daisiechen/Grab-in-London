"""Pin the private review deployment to exact authored candidate artifacts."""
from pathlib import Path
import hashlib
import json
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]


class PMPreviewReleaseTest(unittest.TestCase):
    def test_private_release_points_to_exact_candidate_and_all_eleven_pairs(self):
        record=json.loads((ROOT/'docs/delivery/pm-preview-release.json').read_text())
        self.assertEqual(record['deploymentStatus'],'succeeded')
        self.assertEqual(record['audience'],'owner-private')
        self.assertTrue(record['userAuthorizedPrivatePreview'])
        self.assertEqual(record['professionalStagesStarted'],['PM'])
        self.assertEqual(record['professionalStagesNotStarted'],['UX','RD','QA'])
        self.assertTrue(record['privateMetadataExcluded'])
        for private_field in ('url','siteProjectId','siteSourceCommit','siteVersionId','deploymentId'):
            self.assertNotIn(private_field, record)
        self.assertNotIn('.chatgpt.site',json.dumps(record))
        self.assertNotIn('appgprj_',json.dumps(record))
        self.assertNotIn('appgdep_',json.dumps(record))
        for field,template in [('prototypeHashes','demo/journeys/{slug}/index.html'),
                               ('requirementHashes','docs/product/journeys/{slug}/requirements.zh-CN.md')]:
            self.assertEqual(set(record[field]),{f'J{n:02}' for n in range(1,12)})
            for journey,sha in record[field].items():
                path=template.format(slug=journey.lower())
                source=subprocess.run(['git','show',record['candidateCommit']+':'+path],cwd=ROOT,capture_output=True,check=True).stdout
                self.assertEqual(hashlib.sha256(source).hexdigest(),sha,path)


if __name__=='__main__':unittest.main()
