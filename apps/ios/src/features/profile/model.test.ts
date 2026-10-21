import { buildPatch, formFromMe, languageChoiceCodes, languageChoiceFor, validateProfile, type ProfileForm } from './model.ts';
import { incompleteMe, me } from '../../test/fixtures.ts';

const valid = (): ProfileForm => ({ ...formFromMe(me()), displayName: 'Al', bio: 'x'.repeat(20) });
const check = (patch: Partial<ProfileForm>, consent = true) => validateProfile({ ...valid(), ...patch }, { requireConsent: true, consent });

describe('profile validation boundaries (QA-INPUT-001..008, QA-AUTH-005)', () => {
  it.each([
    ['A', 'displayName'],
    ['A'.repeat(41), 'displayName'],
    ['  A  ', 'displayName'],
  ])('rejects name %j', (displayName, field) => {
    expect(check({ displayName })?.field).toBe(field);
  });

  it.each(['Al', 'A'.repeat(40)])('accepts name of boundary length %#', (displayName) => {
    expect(check({ displayName })).toBeNull();
  });

  it('rejects bio of 19 and 1001 characters, accepts 20 and 1000', () => {
    expect(check({ bio: 'x'.repeat(19) })?.field).toBe('bio');
    expect(check({ bio: 'x'.repeat(1001) })?.field).toBe('bio');
    expect(check({ bio: 'x'.repeat(20) })).toBeNull();
    expect(check({ bio: 'x'.repeat(1000) })).toBeNull();
  });

  it('reports each missing gate item in place, consent last', () => {
    expect(check({ lifeStatus: null })?.field).toBe('lifeStatus');
    expect(check({ languages: [] })?.field).toBe('languages');
    expect(check({ interests: [] })?.field).toBe('interests');
    expect(check({}, false)).toEqual({ field: 'consent', message: 'Confirm the age and community acknowledgement to continue.' });
  });

  it('an empty profile fails on the first field', () => {
    expect(validateProfile(formFromMe(incompleteMe()), { requireConsent: true, consent: false })?.field).toBe('displayName');
  });
});

describe('PATCH /me body', () => {
  it('trims text, omits empty background and adds policy versions only when acknowledged', () => {
    const form = { ...valid(), displayName: '  Alex ', work: ' Designer ', school: '' };
    expect(buildPatch(form, { policyVersion: null })).toEqual({
      displayName: 'Alex', bio: 'x'.repeat(20), languages: ['en'], interests: ['FOOD'], lifeStatus: 'NEW_TO_LONDON', background: { work: 'Designer' },
    });
    expect(buildPatch(form, { policyVersion: '2026-10-21' })).toMatchObject({ ageConfirmedVersion: '2026-10-21', communityAcceptedVersion: '2026-10-21' });
  });

  it('maps prototype language labels to contract codes and back', () => {
    expect(languageChoiceCodes('English & Mandarin')).toEqual(['en', 'zh']);
    expect(languageChoiceFor(['zh', 'en'])).toBe('English & Mandarin');
    expect(languageChoiceFor(['fr', 'hi'])).toBeNull();
  });
});
