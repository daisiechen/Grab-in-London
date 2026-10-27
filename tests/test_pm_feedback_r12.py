"""Validate the authored r12 product delta, not a rejection-reason implementation."""
from pathlib import Path
import hashlib
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
DELTA = ROOT / 'docs/product/r12/ios-feedback-requirements-2026-10-28.json'
DOC = ROOT / 'docs/product/r12/ios-feedback-requirements-2026-10-28.zh-CN.md'


class PMFeedbackR12Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.delta = json.loads(DELTA.read_text())
        cls.reason = cls.delta['C20']
        cls.document = DOC.read_text()

    def test_optional_presets_are_unselected_and_not_free_text(self):
        r = self.reason
        self.assertEqual(r['field'], 'declineReasonCode')
        self.assertEqual(r['presets'], [
            {'code': 'PLANS_NOT_ALIGNED', 'label': 'The plans aren’t quite a fit.',
             'semantic': 'host-subjective-arrangement-choice'},
            {'code': 'KEEPING_GROUP_SMALL', 'label': 'I’m keeping this group small.',
             'semantic': 'host-subjective-group-size-choice-not-MEAL_FULL'},
        ])
        self.assertEqual(r['nullOption'], {'code': None, 'label': 'No reason'})
        self.assertEqual(r['initialSelection'],
                         {'reasonTouched': False, 'value': None, 'checkedOption': None})
        self.assertFalse(r['reasonRequired'])
        self.assertFalse(r['allowFreeText'])
        self.assertFalse(r['reasonTouchedInWirePayload'])
        for item in r['presets']:
            self.assertIn(item['code'], self.document)
            self.assertIn(item['label'], self.document)
        self.assertIn('不选择也能确认拒绝', self.document)

    def test_confirm_cancel_unknown_and_terminal_rules_are_explicit(self):
        c, intent, rules = self.reason['confirmation'], self.reason['intent'], self.reason['invariants']
        self.assertTrue(c['preConfirmSwitchAllowed'])
        self.assertEqual(c['cancelPreservesApplicationState'], 'PENDING')
        self.assertTrue(c['cancelResetsReasonDraft'])
        self.assertTrue(c['saveLocksSelection'])
        self.assertFalse(c['reasonEditableAfterDeclined'])
        self.assertEqual(set(intent['binds']), {'actorId', 'mealId', 'applicationId', 'expectedVersion',
                                               'decision', 'declineReasonCode', 'idempotencyKey'})
        self.assertTrue(intent['unknownPreservesPayload'])
        self.assertFalse(intent['unknownMayChangeReason'])
        self.assertFalse(intent['unknownMayCreateNewIntent'])
        self.assertTrue(intent['closeWaitingDoesNotCancelRequest'])
        self.assertTrue(intent['conflictRequiresReloadAndExplicitConfirmation'])
        for key in ['declinedCannotReapply', 'pendingDoesNotOccupySeat', 'declineDoesNotGrantSeatOrRoster',
                    'declineDoesNotGrantGroup', 'declineDoesNotTriggerApprovalLock',
                    'mealCapacityRosterGroupUnchanged', 'noBackfillInferredReason']:
            self.assertTrue(rules[key], key)
        self.assertIsNone(rules['legacyMissingReason'])
        self.assertEqual(self.reason['copy']['nullOrLegacyReason'], 'No reason provided.')

    def test_private_reason_and_existing_notification_channels_only(self):
        r = self.reason
        self.assertEqual(set(r['visibility']['allowed']), {'meal-host', 'application-owner'})
        self.assertTrue({'other-applicants', 'group-members', 'public-meal', 'ordinary-analytics'}
                        <= set(r['visibility']['denied']))
        n = r['notifications']
        self.assertEqual(n['recipients'], ['application-owner'])
        self.assertEqual(set(n['channels']), {'IN_APP', 'EMAIL'})
        self.assertFalse(n['newHostOrGroupNotification'])
        self.assertEqual(n['newChannels'], [])
        self.assertEqual(n['reasonSource'], 'accepted-authoritative-decline-result')
        self.assertTrue(n['bodyIncludesSelectedPreset'])
        self.assertTrue(n['nullOmitsReasonSentence'])
        self.assertFalse(n['freeTextAllowed'])
        self.assertFalse(n['otherMemberDataAllowed'])
        self.assertFalse(n['providerAcceptedIsDelivered'])
        self.assertEqual(set(n['refs']), {'mealId', 'applicationId'})

    def test_proposed_contract_is_not_false_current_implementation(self):
        c = self.reason['contractDelta']
        self.assertEqual(c['status'], 'proposed-not-implemented')
        self.assertEqual(c['currentRequestFields'], ['decision'])
        self.assertFalse(c['currentApplicationHasReason'])
        self.assertFalse(c['currentStoreHasReason'])
        self.assertTrue(c['doNotSendReasonToOldApi'])
        self.assertTrue(c['doNotDropReasonAndShowSaved'])
        self.assertTrue(c['productionEnablementRequiresReasonCapableService'])
        self.assertTrue(c['futureRequest']['approveNonNullReasonRejected'])
        self.assertTrue(c['futureRequest']['unknownCodesAndFreeTextRejected'])
        self.assertEqual(c['legacyBackfill'], 'null-only')
        self.assertFalse(self.delta['implementationAuthorized'])
        self.assertFalse(self.delta['productionImplemented'])
        operations = (ROOT / 'packages/contracts/src/operations/meals.ts').read_text()
        decision_body = operations.split("operationId: 'decideApplication'", 1)[1].split("op({", 1)[0]
        self.assertIn("body: Obj({ decision: Enum(['APPROVE', 'DECLINE'] as const) })", decision_body)
        self.assertNotIn('declineReasonCode', decision_body)
        dto = (ROOT / 'packages/contracts/src/dto.ts').read_text()
        application = dto.split('export const Application = Obj({', 1)[1].split('\n});', 1)[0]
        self.assertNotIn('declineReasonCode', application)

    def test_language_party_range_and_scope_are_not_expanded(self):
        language, people = self.delta['C12'], self.delta['C15']
        self.assertEqual(language['interfaceLocale'], 'en')
        self.assertFalse(language['localeSwitchImplemented'])
        self.assertEqual(language['conversationLanguageDestination'], 'existing Edit profile')
        self.assertTrue(language['openingDoesNotSave'])
        self.assertTrue(people['presentationOnly'])
        self.assertEqual((people['minimum'], people['maximum']), (2, 6))
        self.assertEqual(people['defaultRange'], [3, 4])
        self.assertTrue(people['includesHost'])
        self.assertTrue(people['firstGuestApprovalLocksArrangements'])
        self.assertTrue(people['formationAndDeadlineUnchanged'])
        v = self.delta['verification']
        self.assertFalse(v['RDStartedByThisDelta'])
        self.assertFalse(v['QAStartedByThisDelta'])
        self.assertIn('prototype-clicks', v['doesNotProve'])

    def test_acceptance_and_frozen_inputs_are_traceable(self):
        ids = {item['id'] for item in self.delta['acceptance']}
        self.assertEqual(ids, {f'C20-AC{i:02}' for i in range(1, 7)} | {'C12-AC01', 'C15-AC01'})
        for item in self.delta['acceptance']:
            self.assertIn(item['id'], self.document)
            self.assertEqual(item['status'], 'specified-not-verified')
        self.assertFalse(self.delta['authority']['frozenPrdDemoRewriteAllowed'])
        for source in self.delta['inputs']:
            self.assertTrue((ROOT / source['path']).is_file(), source['path'])
        for source in self.delta['frozenArtifacts']:
            actual = hashlib.sha256((ROOT / source['path']).read_bytes()).hexdigest()
            self.assertEqual(actual, source['sha256'], source['path'])
        for link in re.findall(r'\]\(([^)]+)\)', self.document):
            self.assertTrue((DOC.parent / link.split('#', 1)[0]).resolve().exists(), link)


if __name__ == '__main__':
    unittest.main()
