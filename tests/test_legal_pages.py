"""Legal drafts, their published HTML and the App Store materials stay consistent and public-safe."""
from pathlib import Path
import importlib.util
import re
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
POLICIES = ROOT / 'docs/policies'
DRAFTS = ['privacy-notice.draft.en.md', 'terms-of-use.draft.en.md', 'community-guidelines.draft.en.md', 'support.draft.en.md']
PUBLIC = ROOT / 'apps/web/public'
PLACEHOLDER = re.compile(r'\{\{([A-Z0-9_]+)\}\}')


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LegalPagesTest(unittest.TestCase):
    def test_published_pages_are_generated_from_the_drafts(self):
        builder = load('build_legal_pages', ROOT / 'scripts/build_legal_pages.py')
        for path, text in builder.outputs().items():
            with self.subTest(page=path.relative_to(ROOT)):
                self.assertTrue(path.exists(), 'run python3 scripts/build_legal_pages.py')
                self.assertEqual(path.read_text(), text, 'run python3 scripts/build_legal_pages.py')
        self.assertEqual(set(builder.PAGES), {'privacy', 'terms', 'guidelines', 'support'})

    def test_drafts_are_marked_pending_review_and_pages_stay_unindexed(self):
        for name in DRAFTS:
            with self.subTest(draft=name):
                text = (POLICIES / name).read_text()
                self.assertIn('Draft — pending owner and legal review. Not yet in effect.', text)
        for slug in ('privacy', 'terms', 'guidelines', 'support'):
            page = (PUBLIC / slug / 'index.html').read_text()
            self.assertIn('class="draft"', page)
            self.assertIn('<meta name="robots" content="noindex">', page)

    def test_every_placeholder_is_listed_for_the_owner(self):
        readme = (POLICIES / 'README.md').read_text()
        listed = set(re.findall(r'`\{\{([A-Z0-9_]+)\}\}`', readme))
        used = set()
        for name in DRAFTS:
            used |= set(PLACEHOLDER.findall((POLICIES / name).read_text()))
        self.assertEqual(used, listed)
        self.assertTrue({'OPERATOR_NAME', 'SUPPORT_EMAIL', 'EFFECTIVE_DATE'} <= used)

    def test_public_texts_carry_no_personal_contact_data_or_secrets(self):
        files = [POLICIES / n for n in DRAFTS] + [POLICIES / 'README.md']
        files += list(PUBLIC.rglob('*.html')) + [PUBLIC / 'legal/legal.css']
        files += [ROOT / 'docs/delivery/app-store-submission.zh-CN.md', ROOT / 'docs/delivery/app-store-listing.en.md']
        email = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}')
        allowed = {'appreview@mail.fancyabite.uk', 'noreply@mail.fancyabite.uk'}
        secret = re.compile(r'(AIza[0-9A-Za-z_-]{20,}|re_[0-9A-Za-z]{20,}|sk-[0-9A-Za-z]{20,}|-----BEGIN)')
        for path in files:
            with self.subTest(file=path.relative_to(ROOT)):
                text = path.read_text()
                self.assertEqual(set(email.findall(text)) - allowed, set())
                self.assertIsNone(secret.search(text))

    def test_privacy_notice_matches_owner_hosting_decision_and_code(self):
        text = (POLICIES / 'privacy-notice.draft.en.md').read_text()
        for fact in ('Seoul, Republic of Korea', 'Data Protection (Adequacy) (Republic of Korea) Regulations 2022',
                     'Tencent Cloud', 'Cloudflare', 'Auth0', 'Resend', 'Google Maps Platform', 'Ireland',
                     'switched off in this release', 'Settings → Delete account', 'ico.org.uk', '18 or over'):
            with self.subTest(fact=fact):
                self.assertIn(fact, text)
        self.assertNotIn('DeepSeek', text, 'AI is disabled; name the provider only when it is enabled')

    def test_terms_cover_app_store_and_uk_requirements(self):
        text = (POLICIES / 'terms-of-use.draft.en.md').read_text()
        for fact in ('at least 18', 'zero tolerance', 'Fancy does not take payments', 'responsible for making, changing and cancelling',
                     'licence', 'Suspension', 'law of England and Wales', 'third-party beneficiaries', 'death or personal injury',
                     'Open Government Licence v3.0', 'Open Parliament Licence v3.0'):
            with self.subTest(fact=fact):
                self.assertIn(fact, text)

    def test_submission_doc_names_bundle_id_and_privacy_answers(self):
        doc = (ROOT / 'docs/delivery/app-store-submission.zh-CN.md').read_text()
        for fact in ('uk.fancyabite.app', 'com.example.fancy.dev', 'APP_VARIANT=production', 'Age Rating Override',
                     'usesNonExemptEncryption', 'Tracking', 'Search History', '6.9"', '6.5"'):
            with self.subTest(fact=fact):
                self.assertIn(fact, doc)
        config = (ROOT / 'apps/ios/app.config.js').read_text()
        self.assertIn("production: { bundleIdentifier: 'uk.fancyabite.app' }", config)

    def test_app_icon_is_opaque_square_and_matches_its_source(self):
        renderer = load('render_app_icon', ROOT / 'scripts/render_app_icon.py')
        self.assertEqual((ROOT / 'apps/ios/assets/brand/app-icon.svg').read_text(), renderer.svg())
        data = (ROOT / 'apps/ios/assets/images/icon.png').read_bytes()
        self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
        width, height, depth, colour = struct.unpack('>IIBB', data[16:26])
        self.assertEqual((width, height, depth, colour), (1024, 1024, 8, 2), 'RGB without alpha')
        self.assertEqual((PUBLIC / 'legal/fancy-icon.svg').read_text(), renderer.svg())


if __name__ == '__main__':
    unittest.main()
