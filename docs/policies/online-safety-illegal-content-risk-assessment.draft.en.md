# Fancy: Illegal Content Risk Assessment (Online Safety Act 2023)

> **Draft — not legal advice.** Owner-review draft prepared on 2026-10-29 from the current code and Ofcom's published guidance. It becomes Fancy's record under OSA s.23 only once {{OPERATOR_NAME}} has reviewed it, decided the open points in §8, and signed and dated §10. See the [policy review checklist](README.md).

| Field | Value |
| --- | --- |
| Service | Fancy: iOS app and web app at fancyabite.uk (same API and accounts) |
| Provider | {{OPERATOR_NAME}}, sole operator (individual) |
| Service type | User-to-user (Part 3) service. Not search. No pornographic content, so Part 5 does not apply |
| Size (Ofcom Codes) | Smaller service: well under the 7 million average monthly UK users threshold for "large". Pre-launch, no live users yet |
| Named accountable person (Codes ICU A2) | {{OPERATOR_NAME}} |
| Assessment date | 2026-10-29 (draft) |
| Proposed outcome | **Multi-risk (provisional).** Medium for two kinds (harassment, stalking, threats and abuse; CSEA grooming); low or negligible for the rest. See §6 |
| Next review | Before launch, then within 3 months of launch, then at least every 12 months, and before any significant change (§9) |

## 1. Legal basis and guidance used

- Online Safety Act 2023 ([legislation.gov.uk](https://www.legislation.gov.uk/ukpga/2023/50)): s.9 (illegal content risk assessment), s.10 (illegal content safety duties), s.20 (content reporting), s.21 (complaints), s.23 (record-keeping and review), s.59 and Schedules 5–7 (illegal content and priority offences).
- Ofcom, [Risk Assessment Guidance and Risk Profiles, v2.0 (25 June 2026)](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/updates/risk-assessment-guidance-and-risk-profiles.pdf). It uses a four-step method: (1) understand the kinds of illegal content, (2) assess the risk, (3) decide measures, implement and record, (4) report, review and update. Each kind gets a risk level of negligible, low, medium or high from likelihood and impact, using the General Risk Level Table and the specific tables for CSAM images, CSAM URLs and grooming. The guidance says the tables should not be applied mechanically and puts weight on evidence of actual harm.
- Ofcom, Register of Risks and the User-to-User Risk Profile, published with the [Illegal Harms statement](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/statement-protecting-people-from-illegal-harms-online) and updated by the [new priority offences statement (25 June 2026)](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/new-priority-offences-serious-self-harm-and-cyberflashing) ([table of document updates](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/statement-new-priority-offences-serious-self-harm-and-cyberflashing/table-showing-updates-to-illegal-harms-regulatory-documents-and-guidance.pdf)).
- Ofcom, Illegal content Codes of Practice for user-to-user services: [version incorporating amendments issued 9 September 2026](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/detecting-intimate-image-abuse/illegal-content-codes-of-practice-for-user-to-user-services-9sep2026.pdf), which replaced the [February 2025 Code](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/detecting-intimate-image-abuse/illegal-content-code-of-practice-for-user-to-user-services-superseded.pdf). Ofcom's [regulatory documents index](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-regulatory-documents) also lists a further version issued 12 October 2026, which brings in the self-harm and cyberflashing changes (secondary sources give 2 November 2026 as the in-force date). **Before signing, check measure scope against whichever version is in force on that day.**
- Ofcom, [Summary of decisions (who each measure applies to)](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/summary-of-our-decisions.pdf) and [Online Safety Act Explained Q&A](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/other/online-safety-act-explained-qa-web.pdf). The Q&A says small services that assess themselves low risk for all harms are expected to have only basic measures to remove illegal content when they become aware of it.
- Ofcom, [Record-keeping and review guidance](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/updates/record-keeping-and-review-guidance.pdf), and the Illegal Content Judgements Guidance (ICJG, published with the statement) for deciding whether a given item is illegal.

**Research limit.** Ofcom's site could not be fetched directly from the environment that wrote this draft. Facts about Ofcom documents come from search results that quote them and from the Codes' known structure. Measure codes, scopes and table criteria marked "verify" must be checked against the PDFs above before this record is signed.

## 2. Service description (evidence from the code, 2026-10-29)

| Functionality (Ofcom risk-profile term) | What Fancy does | Code evidence |
| --- | --- | --- |
| User profiles | First name or known name, optional photo, bio, interests, languages and similar fields. Public profile and published references can be read **without signing in** (`getPublicProfile`, optionalSession) | `packages/contracts/src/operations/people.ts`, `dto.ts` `PublicProfile` |
| Posting images | Profile photo only. Uploaded **without pre-moderation**. The server re-encodes it as JPEG, strips all metadata (EXIF/GPS, comments, ICC) and limits it to 1024 px. Limit of 20 uploads per hour. A photo hidden by moderation or belonging to a non-ACTIVE account returns 404. No images in chat | `apps/api/src/profiles/avatar.ts`, `avatar-image.ts`, `http/rate-limit.ts` |
| Posting content (listings) | Hosts publish meal listings: title 5–80 characters, description 20–1000, a restaurant chosen from Google Places, 2–6 seats. Discovery and meal detail are public (no sign-in) | `operations/meals.ts` |
| Group messaging | One group chat per meal, limited to the host and confirmed guests (at most 6 people). Text only, up to 2000 characters. Members see only messages from their membership interval | `apps/api/src/conversations/routes.ts` |
| Direct messaging | 1:1 chat opens **only** when both members attended the same meal **and** both chose to reconnect, while neither has blocked the other and both accounts are active. Otherwise the chat is read-only | `apps/api/src/connections/service.ts` `assertDirectAuthorized` |
| User connections | Mutual "reconnect" after a shared meal only. There is no follower graph, no search for people and no friend suggestions | `connections/` |
| Commenting / reviews | Public references (text up to 500 characters) about people you ate with, published when both have written one or after 7 days. Application notes to hosts | `operations/social.ts` `reviewPerson` |
| Offline meeting | Core purpose. Strangers meet at a restaurant the host booked off-platform. Fancy takes no payments | PRD r07, Terms |
| Age | Self-declaration only: the setup checkbox "I'm 18 or older…". The server refuses applying and hosting until this is ticked (`requireProfile`). No age assurance | `ProfileSetupScreen.tsx`, `apps/api/src/meals/commands.ts`, `identity/me.ts` |
| Not present | Livestreaming, file sharing, public feed, content recommender, anonymous posting, payments, user search, images or links previewed in chat, AI features (AI is switched off) | — |

**Controls already in place:**

- **Reporting.** Members can report a member, a meal or a message (`USER`/`MEAL`/`MESSAGE`). The form asks for 1–1000 characters, sends the report idempotently and returns a reference number and a status check (`ReportScreen.tsx`; the web equivalent is in `apps/web/src/features/reports`). Today iOS can report profiles and meals. A separate change is adding message-level reporting in the iOS group chat in parallel; the API already accepts `MESSAGE`.
- **Automated moderation** (`apps/api/src/moderation/policy.ts`, takeover plan §8):
  - A reported item is hidden from the reporter immediately.
  - Once ≥2 distinct reporters (configurable 1–20) report the same item within 7 days, it is limited for everyone: messages are masked, meals leave discovery and stop taking applications, and a profile's bio and photo are hidden. Every limit can be reversed.
  - The reporter gets an automatic acknowledgement.
  - A case with no staff action closes after 30 days, and any limit stays in place.
  - A daily digest email goes to the operator from 08:00 London time.
- **Staff actions** (`apps/api/src/moderation/routes.ts`, admin console, support role + MFA): uphold, restore, hide content, cancel meal, reset profile text, remove photo, suspend and unsuspend. Each action needs an internal note, and every claim, view and action is audited (`audit_events`, `moderation_actions`). A suspended account cannot sign in (403 `ACCOUNT_SUSPENDED`), cannot sign back in with the same verified email through another sign-in method, and its public content is hidden.
- **Blocking.** Blocking stops direct messages and connection. It does not remove either member from a shared group chat.
- **Rate limits.** 30 messages per minute, 60 writes per minute, a burst limit of 10 per second, and 20 photo uploads per hour.
- **Terms and guidelines.** Terms §7 cover illegal content and complaints. Community Guidelines set zero tolerance for abuse, say content is not checked before posting, describe the automatic limits, give a 24-hour review aim, and offer appeal by email within 30 days.

## 3. Evidence considered

| Source | Finding |
| --- | --- |
| Own data | None yet: pre-launch, no reports, no users. **This is the main weakness of this assessment.** It has to be repeated with real data (§9) |
| Ofcom User-to-User Risk Profile | Fancy has these risk factors: user profiles, user connections, direct messaging, group messaging, posting images (profile photo), posting text (listings, references), and a service where children can join by lying about their age. It lacks the highest-risk factors for several harms: no livestreaming, no file sharing, no large public groups, no anonymous posting, no recommender feed, no payments |
| Ofcom Register of Risks | Services that bring strangers together to meet offline (comparable to dating and meet-up services) carry heightened risk of harassment, stalking and threats, and of romance-style fraud. Profiles + connections + DMs are the key grooming functionalities |
| Product design | Small groups (≤6) in public restaurants. No DMs before a meal has actually been attended by both members, and DMs need consent from both. Text-only chat. These reduce the likelihood of grooming, intimate image abuse, cyberflashing and fraud |
| Comparable services | Group-dining and meet-up apps mostly report safety incidents offline (unwanted contact afterwards, harassment), not illegal content hosted at scale. Treat this as qualitative only; there is no data for Fancy yet |

## 4. Risk method

Following the guidance, each kind is rated on **likelihood** (the chance users meet the content, or that Fancy is used to commit or facilitate the offence, after current controls) and **impact** (how severe the harm is and how many people it could reach). Risk levels are negligible, low, medium or high. For CSEA the grooming and CSAM-specific tables are used. Where there is no evidence, the more cautious level is chosen; Ofcom asks for caution, and Fancy's core function is meeting strangers in person.

## 5. Risk assessment by kind of illegal content

The 2026 updates change the old "17 kinds" into **18 kinds** of priority illegal content. Encouraging or assisting serious self-harm is merged into one "suicide and self-harm" kind, and cyberflashing is added as a separate kind. The priority offences took effect 8 January 2026. Ofcom's v2.0 guidance and Risk Profile include both changes.

| # | Kind | Likelihood (why) | Impact | Risk level |
| --- | --- | --- | --- | --- |
| 1 | Terrorism | Low. No broadcast reach, no public feed. Text reaches ≤6 people or appears in a meal listing | High severity, tiny reach | **Low** |
| 2a | CSEA: grooming | Low, not negligible. Children can join by ticking 18+. A host chooses guests and then shares a group chat with them before the meal. Profiles and the purpose of meeting in person are risk factors. Mitigation: DMs only after a shared, attended meal plus mutual opt-in; meals happen in public with other adults; text only | Severe | **Medium** (provisional; see §8 D1–D2) |
| 2b | CSEA: image-based CSAM | Low. The only image is the profile photo, which other members see, so it is quickly reportable. No chat images, no file sharing | Severe | **Low** (verify against the CSAM image table) |
| 2c | CSEA: CSAM URLs | Low. URLs can be typed into bios, listings or chat. Small closed groups, no link previews | Severe | **Low** |
| 3 | Hate | Low to medium. Free text in listings, bios, references and chat. Diverse international user base. Small audiences | Medium | **Low** |
| 4 | Harassment, stalking, threats and abuse | Medium. Strangers meet in person and learn each other's first name, photo and face. Members can keep contacting each other through group chats and references after the meal. Offline harassment can follow online contact | Medium to high | **Medium** |
| 5 | Controlling or coercive behaviour | Negligible to low. This offence needs a personal connection (intimate or family). Fancy's purpose is new friendships | Medium | **Low** |
| 6 | Intimate image abuse | Low. Only a profile photo, visible to other members and reportable. No image messaging | High | **Low** |
| 7 | Cyberflashing (new 2026) | Low. Images cannot be sent in chat or DMs. A sexual profile photo is technically possible and would be shown to group members | Medium | **Low** |
| 8 | Extreme pornography | Low. Profile photo only | Medium | **Low** |
| 9 | Sexual exploitation of adults | Low. Meal listings could be misused to advertise sexual services. Guidelines prohibit this | Medium | **Low** |
| 10 | Human trafficking | Negligible to low. No job or accommodation listings, no payments | High | **Low** |
| 11 | Unlawful immigration | Negligible. No relevant features | — | **Negligible** |
| 12 | Fraud and financial offences | Low. No payments in the app. The risk is "asking for money", fake listings and investment pitches in group chats. Meeting in person makes fake identities harder to keep up | Medium | **Low** |
| 13 | Proceeds of crime | Negligible. No money flows | — | **Negligible** |
| 14 | Drugs and psychoactive substances | Low. Supply could be arranged through chat with people met at a meal | Medium | **Low** |
| 15 | Firearms, knives and other weapons | Negligible to low. No marketplace | Medium | **Low** |
| 16 | Suicide and self-harm (merged 2026) | Low. No public content feed, small groups | High | **Low** |
| 17 | Foreign interference | Negligible. No public reach or political features | — | **Negligible** |
| 18 | Animal cruelty | Negligible. No video, image only in profile | — | **Negligible** |
| — | Other (non-priority) illegal content: threatening, false or harmful communications offences (OSA ss.179–183), epilepsy trolling, other offences with individual victims | Low to medium. Mostly overlaps with #4 | Medium | **Low** (handled with #4) |

**Outside the Act but recorded.** The Online Safety Act covers content on the service. It does not cover what happens at the restaurant, such as assault, theft or a no-show host. Those risks are handled by the Community Guidelines' safety advice, reports, suspension, and a police route for emergencies (999). They also inform the harassment rating above.

## 6. Overall service risk

- **Provisional outcome: multi-risk.** Two kinds are medium (harassment/stalking/threats/abuse, and CSEA grooming). In Ofcom's Codes, a multi-risk service is one at medium or high risk for at least two kinds.
- If the grooming rating falls to **low**, Fancy would be **specific-risk** (harassment only). That could happen through highly effective age assurance, or through launch evidence that no children are using the service together with a defensible reading of the grooming table. Fewer Codes measures would then apply.
- This judgement, and the children's access assessment (`online-safety-childrens-access-assessment.draft.en.md`), are the two decisions {{OPERATOR_NAME}} must make before launch.

## 7. Codes of Practice measures: applicability and what Fancy does

The scope column follows the Codes' index of measures as published in February 2025 (**verify against the version in force**). "All" means every user-to-user service. "Multi" means large **or** multi-risk unless noted. Fancy follows the Codes, which gives it the "safe harbour" of being treated as compliant (OSA s.49). Where Fancy does something different, it must record an alternative measure under s.23.

| Measure | Scope | Fancy now | Status |
| --- | --- | --- | --- |
| ICU A2 Named person accountable for the illegal content safety duties and the reporting and complaints duties | All | {{OPERATOR_NAME}} (sole operator) | Met once named and signed |
| ICU A3 Written statement of responsibilities | Multi | Sole operator. A one-line statement in this record is enough | Action (§8 A3) |
| ICU A5 Track evidence of new and increasing illegal harm | Multi | Report data, digest and auto-limit audit exist. No periodic review yet | Action |
| ICU A1, A4, A6, A7 (annual board review, internal assurance, code of conduct, compliance training) | Large, or large **and** multi-risk | — | Not applicable |
| ICU C1 Content moderation function to review and assess suspected illegal content | All | Admin moderation queue with claim, detail and minimal context. Operator reviews against ICJG | Met (resourcing caveat below) |
| ICU C2 Swift takedown of illegal content | All | Automatic limit at 2 reporters; staff hide, remove photo, reset profile text, cancel meal, suspend | Met. The 24-hour aim depends on one person |
| ICU C3 Internal content policies | Multi | Community Guidelines are public. There is no internal policy covering ICJG judgements, CSAM handling or proscribed organisations | **Gap** |
| ICU C4 Performance targets | Multi | 24-hour review aim shown in the queue | Partly met. Targets need writing down and measuring |
| ICU C5 Prioritisation | Multi | Reports carry one of five reasons (personal safety or threats / harassment or hate / scam, spam or advertising / may be under 18 / other). Safety, harassment and under-18 reports are listed first and flagged urgent, and trigger an immediate email and assistant alert (coalesced, at most one per 10 minutes); the rest are oldest first, with an auto-limited flag | Met (2026-10-29) |
| ICU C6 Resourcing | Multi | One person plus a daily digest. No cover for holidays or illness | **Gap** |
| ICU C7 Training and materials for moderators | Multi | None written | Gap (self-training record on ICJG) |
| ICU C9 / C10 CSAM hash matching / CSAM URL detection | High risk of CSAM with size or file-sharing conditions | CSAM rated low; no file sharing | Not applicable (re-check if images are ever allowed in chat) |
| Intimate image abuse hash matching (2026 amendment, in force 30 September 2026) | High risk of intimate image abuse **and** porn or file-sharing services | Neither | Not applicable |
| ICU D1 Enable complaints (users and affected people) | All | In-app reports for signed-in members. Email to the public support address for anyone | Met for members. **Gap:** signed-out visitors and non-users can only use email, and the public meal and profile pages do not point to it |
| ICU D2 Complaints easy to find, access and use | All | Report buttons on profile and meal; press and hold a chat message to report it (group and private chats) | Partly met. **Public references cannot be reported directly** |
| ICU D3–D6 Information before a complaint, indicative timeframes, information on handling, opt-out from updates | Multi (verify) | Report form explains privacy. Receipt reference and status check; automatic acknowledgement | Partly met. No timeframe shown to reporters; no opt-out |
| ICU D7 Action on complaints about suspected illegal content | All | Treated as reports; auto-limit + review | Met. Needs an "illegal content" path (see C5) |
| ICU D8–D10 Appeals: determine and act | D8 Multi; D9–D10 All (verify) | Appeal by email within 30 days (Guidelines). Unsuspend/restore actions exist | Partly met. **No written appeal procedure, timeframe or log** |
| ICU D11 Complaints about proactive technology | All | No proactive technology used | Not applicable (state in the terms) |
| ICU D12 Other relevant complaints (for example, about Fancy's compliance) | All | Terms §7 accepts them by email | Partly met. Needs an acknowledgement and handling log |
| ICU D13 Manifestly unfounded complaints | All | — | Optional; document if used |
| ICU D14 Dedicated reporting channel (trusted flaggers, fraud) | Large, fraud risk | — | Not applicable |
| ICU E1 Recommender system testing | Large/multi-risk with recommender feeds | Discovery filters and lists meals; there is no personalised content recommender | Not applicable (re-check if ranking is added) |
| ICU F1/F2 Safety defaults and support for child users | High risk of grooming | Grooming medium, not high. By design: no DMs without a shared meal and mutual consent; no people search; no friend suggestions | Not applicable at medium. Applies if grooming becomes high |
| ICU G1 Terms: substance (how users are protected from illegal content, complaints, proactive technology) | All | Terms §7 and Guidelines "What happens when something is reported" | Partly met. Add a plain statement: no proactive technology; how illegal content is handled |
| ICU G3 Terms: clear and accessible | All | Public pages at fancyabite.uk/terms and /guidelines, linked in the app before posting | Met (after owner and legal review) |
| ICU H1 Remove accounts of proscribed organisations | All (verify) | Suspension exists; no written rule | Gap: add to the internal policy |
| ICU J1–J3 Blocking/muting, disabling comments, verification | Large with specific risks | Blocking exists anyway | Not applicable (blocking already in place) |

## 8. Gaps and actions

Owner = {{OPERATOR_NAME}} unless stated. "Launch" means public App Store release.

| ID | Gap | Action | Product change? | When |
| --- | --- | --- | --- | --- |
| D1 | Grooming rating rests on self-declared age | Decide: (a) accept medium with the controls above and launch monitoring, or (b) add highly effective age assurance at sign-up, which would allow low and change the access assessment | (b) yes | Before launch |
| D2 | No way to flag a suspected under-18 member, and no written handling rule | Done 2026-10-29: "May be under 18" report reason in the app; it counts as urgent (immediate alert, top of the queue). Written rule in the moderation runbook: a person suspends pending checks and closes the account if under 18 (no automatic suspension); the admin shows the rule and a preset note | Done | — |
| C5 | One report reason only; cannot prioritise | Done 2026-10-29: five report reasons (personal safety or threats / harassment or hate / scam, spam or advertising / may be under 18 / other). Safety, harassment and under-18 reports go first in the queue and are emailed to support and pushed to the operator's assistant straight away (coalesced to one alert per 10 minutes), not only in the daily digest | Done | — |
| D2b | Message-level reporting missing in the iOS group chat | Done 2026-10-29: press and hold a message → "Report message" in group and private chats; Guidelines, Terms and Support wording updated | Done | — |
| D2c | Public references (reviews) cannot be reported directly | Add a report target for references, or document that reporting the author covers it and that staff can remove a reference | Yes, or documented workaround | Within 3 months |
| D1b | Signed-out visitors cannot use in-app reporting | Add "Report a concern: email support" to public meal and profile pages on web and iOS, and to the support page | Small UI change | Before launch |
| C3/H1 | No internal content policy | Write a one-page internal moderation policy: ICJG test ("reasonable grounds to infer" illegal), the action for each category, CSAM handling (do not download or forward; preserve; report to IWF/NCA/police), proscribed organisations, threats to life (call 999 / police) | No | Before launch |
| C4/C6 | 24-hour aim depends on one person; no cover | Turn on phone alerts for new reports; define absence cover (a trusted second support user, or pausing new meal creation during long absences); record monthly the median and maximum time to first review | Possibly (pause switch) | Before launch |
| C7 | No training record | Operator reads ICJG and the Register of Risks chapters for harassment, grooming and fraud; record the date | No | Before launch |
| D3–D6, D8–D10, D12 | Complaints and appeals procedure not written | Write the procedure: acknowledge within 2 working days, indicative decision time, how to appeal a suspension or removal, who decides, and an outcome log. Show the timeframe on the report receipt | Copy change in app (timeframe) | Before launch |
| R1 | Evidence purge on account deletion: a reported member could erase the report text and moderation notes about them by deleting their account | Done 2026-10-29 (owner decision: keep safety records for 12 months, then delete). On deletion, every support case about or reported by the member is held (`safety_record_holds`) instead of redacted: report text, case, staff notes with before/after state and audit reasons, plus a copy of the reported profile text, meal details or the member's own messages around a reported message (never the photo). Only support staff with a case grant can read them. The worker redacts a case 12 months after the later of the deletion and the case closure (`RETENTION_POLICY_JSON.safetyRecordDays`, default 365); open cases are not purged. Privacy Notice updated | Done | — |
| G1 | Terms do not say whether proactive technology is used | Add one sentence to Terms §7: no proactive technology; reports plus human review; automatic limits are reversible | Text (Terms are being edited in parallel; apply after) | Before launch |
| A3/A5 | Responsibilities and harm tracking not recorded | §10 sign-off covers A3. Quarterly 15-minute review of report counts by category, auto-limits, suspensions and appeals; note new harm patterns | No | Quarterly |
| REC | Records | Keep this assessment, each review, the internal policy, complaint and appeal logs, and the Codes measures followed (OSA s.23) for the retention period in Ofcom's Record-keeping and review guidance (verify the period; secondary sources cite at least three years) | No | Ongoing |

## 9. Review date and triggers

- **Scheduled.** Before launch (sign-off), within 3 months of launch with real data, then at least every 12 months.
- **Timing rule.** For a new service, OSA Schedule 3 sets a deadline for the first assessment after the service starts (verify the period). Ofcom's practical expectation is to have it done before launch. **Treat sign-off as a launch gate.**
- **Before a significant change** (OSA s.9(4)), carry out a new assessment for any of these:
  - images, links previews or voice notes in chat;
  - DMs without a shared meal;
  - people search or friend suggestions;
  - larger groups or public events;
  - payments or tips;
  - turning AI features on;
  - expanding beyond London or opening to under-18s;
  - removing or weakening the 18+ gate.
- **Evidence triggers:**
  - any report of CSAM or grooming, or any confirmed under-18 account;
  - a police or Ofcom contact;
  - a sustained rise in harassment reports (for example, more than 5 in a month);
  - a media report about Fancy;
  - Ofcom changing the Register, Risk Profiles or Codes (the 12 October 2026 Code version is the current watch item).

## 10. Sign-off

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Named accountable person (ICU A2) and sole operator; responsible for moderation, complaints and this record (ICU A3) | {{OPERATOR_NAME}} | | Approved / approved with actions §8 |

Review log:

| Date | Reviewer | Trigger | Changes |
| --- | --- | --- | --- |
| 2026-10-29 | Draft (agent) | Initial draft before launch | — |
| 2026-10-29 | Draft (agent) | Owner decision: report reasons and urgent alerts | C5 and D2 marked done; ICU C5 met |
