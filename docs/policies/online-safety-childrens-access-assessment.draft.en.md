# Fancy: Children's Access Assessment (Online Safety Act 2023)

> **Draft — not legal advice.** Owner-review draft prepared on 2026-10-29. It becomes Fancy's children's access assessment record (OSA ss.35–37, s.23) only once {{OPERATOR_NAME}} has chosen between the options in §5 and signed §7. See the [policy review checklist](README.md) and the companion [illegal content risk assessment](online-safety-illegal-content-risk-assessment.draft.en.md).

| Field | Value |
| --- | --- |
| Service | Fancy: iOS app and web app at fancyabite.uk (user-to-user service) |
| Provider / responsible person | {{OPERATOR_NAME}} |
| Assessment date | 2026-10-29 (draft, pre-launch) |
| Stage 1 result | **Yes. Children can access the service.** Self-declaration is not highly effective age assurance, and parts of the service need no sign-in at all |
| Stage 2 result | **Child user condition: provisionally not met, low confidence.** No usage data yet; must be re-tested with launch data |
| What follows | No children's risk assessment is required **if** the owner accepts the provisional stage 2 result and its monitoring conditions. Otherwise (option B or C in §5), a children's risk assessment and the Protection of Children Code measures apply |

## 1. Legal test and guidance

- OSA s.35: a service is "likely to be accessed by children" if (1) it is possible for children to access it, and (2) the **child user condition** is met. The condition is met when the service has a significant number of child users in the UK, **or** is of a kind likely to attract a significant number of child users. A provider may conclude that children cannot access the service **only** if it uses age verification or age estimation such that children are not normally able to access it. s.36 requires the assessment and its repetition. s.37 treats a provider that fails to carry one out as likely to be accessed by children.
- Ofcom, Children's Access Assessments Guidance (January 2025) and the quick guide, [Children's access assessment duties](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act) / [quick guide](https://www.ofcom.org.uk/online-safety/information-for-industry/guide-for-services/quick-guide-to-childrens-access-assessments):
  - **Stage 1.** Children "cannot normally access" a service only where highly effective age assurance (HEAA) is in place **with access controls**, so that users not confirmed as adults are kept out.
  - **Stage 2.** "Significant number" is not defined in the Act. Ofcom reads it as a number or proportion that is material in the context of the service, so even a relatively small percentage could be significant. Providers should "err on the side of caution". Without HEAA it is hard to count child users, so providers may focus on whether the service is **likely to attract** children.
  - **Repetition.** Repeat at least every 12 months, and earlier after significant changes or evidence that age assurance has become less effective.
- Ofcom, Guidance on highly effective age assurance (Part 3, January 2025). Methods that can be highly effective include photo-ID matching, facial age estimation, open banking, mobile network operator checks, credit card checks, digital identity services and email-based age estimation. **Self-declaration of age and contractual age limits in terms of service are not capable of being highly effective.** Ofcom's [2026 report on the use of age assurance](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/age-assurance-report-2026/report-on-the-use-of-age-assurance.pdf) gives context on current practice.
- If the condition is met: Ofcom [Children's Risk Assessment Guidance (24 April 2025)](https://www.ofcom.org.uk/siteassets/resources/documents/consultations/category-1-10-weeks/statement-protecting-children-from-harms-online/main-document/childrens-risk-assessment-guidance-and-childrens-risk-profiles.pdf) and the Protection of Children Codes (duties in force 25 July 2025).

**Research limit.** Ofcom's site could not be fetched directly when this draft was written. The points above come from search results quoting Ofcom's guidance pages. Check the quoted tests against the guidance PDFs before signing.

## 2. Stage 1: is it possible for children to access the service?

**Conclusion: yes.**

| Factor | Finding (code evidence) |
| --- | --- |
| Age gate | Profile setup asks members to tick "I'm 18 or older and I'll keep this community welcoming, respectful and friendship-first." (`apps/ios/src/features/profile/screens/ProfileSetupScreen.tsx`). The server will not let a member apply to or host a meal until this is ticked (`requireProfile` in `apps/api/src/meals/commands.ts`; `identity/me.ts`). This is **self-declaration**, which Ofcom says cannot be highly effective |
| Other checks | No ID, facial estimation or third-party age check. Sign-in uses an email code or Google/Apple sign-in; neither proves age. The App Store age rating is overridden to 18+ (`docs/delivery/app-store-submission.zh-CN.md` §3, answer "Age Assurance: No"). That rating is a store setting, not age assurance by the service |
| Parts with no sign-in | Meal discovery, meal detail and public profiles with published references can be read **without an account** in the app and on the web (`discoverMeals`, `getMeal` public; `getPublicProfile` optional session). Children can therefore access these parts whatever the gate does |
| Access controls | Apart from the self-declaration gate before applying or hosting, there are none. Group chat and DMs require a confirmed seat, which requires the gate |

## 3. Stage 2: is the child user condition met?

### 3.1 Significant number of child users

There is **no data**: Fancy has not launched and collects no birth date. Fancy cannot show the number is not significant, and it cannot show it is. Ofcom expects this situation without HEAA, and points providers to the "likely to attract" limb.

### 3.2 Is the service of a kind likely to attract a significant number of children?

| Factor (Ofcom guidance considerations) | Points against attracting children | Points towards attracting children |
| --- | --- | --- |
| Purpose and content | Group meals at London restaurants with an expected budget per person; friendship between adults; the host books and everyone pays the restaurant | Making friends and meeting people is attractive to older teenagers. Group activities with peers are part of teen social life |
| Design and presentation | Adult tone. No games, rewards, streaks, characters or school-related features. Profile fields include work and education as an adult would list them | Clean consumer-app look. No feature *repels* children either |
| Users targeted | Adults living in London, including newcomers and international residents (PRD r07). Terms, Guidelines and sign-in copy say 18+ | Students aged 16–17 new to London fit the "newcomer" story. 18-year-old students will be present, and their younger peers could follow |
| Marketing | Planned launch marketing is aimed at adults (owner to confirm: no school, campus-under-18 or youth-platform channels) | Social media marketing on platforms with many teenage users would reach children |
| Distribution | App Store 18+ rating. Under Apple's age-rating and parental-control system, child accounts with restrictions cannot download it | Many teenagers use Apple IDs with a false or unrestricted age. The web app has no store gate |
| Commercial | No payments; no business model needing children | — |
| Comparable services | Adult meet-up and group-dining services are generally positioned 18+. No evidence found of large child user bases | Ofcom has noted that services aimed at adults are still used by children where nothing stops them |

### 3.3 Reasoning

- On the evidence available before launch, Fancy is **not, by its nature, a service likely to attract a significant number of children**. Its purpose, cost of taking part (restaurant meals), adult framing, 18+ store rating and adult-only marketing all point away from children.
- The honest weaknesses are:
  1. Self-declaration is the only barrier, and public pages need no account.
  2. Ofcom says a relatively small proportion can be significant and asks for caution.
  3. Making friends in person appeals to 16- and 17-year-olds.
  4. There is no data, and no reporting route yet for a member who seems under 18.
- Because this condition is the gate to children's safety duties, and the harm in question is serious (adults meeting children offline), the "not met" result is recorded as **provisional with conditions**, not as a settled conclusion.

**Stage 2 result (provisional): child user condition not met**, on these conditions:

1. Before launch, add a way to flag a member who may be under 18 (a report reason, or at least a written handling rule), with a rule to suspend pending checks and close the account if the member is under 18.
2. Count and record every under-18 signal (report, admission in chat or bio, support contact) from launch.
3. Re-run this assessment within 3 months of launch with real data. Re-run it immediately if any under-18 account is confirmed, if signals keep repeating, or if marketing or features change in a way that could attract children (§6).
4. Marketing stays aimed at adults and avoids youth channels.

## 4. What follows from the result

- **If the provisional result stands (option A in §5):**
  - No children's risk assessment and no Protection of Children Code duties are required for now. HEAA is **not legally required**: Fancy publishes no pornographic content (Part 5 does not apply) and has concluded that the child user condition is not met.
  - The illegal content duties still apply in full. That assessment rates CSEA grooming **medium** because children can get past self-declaration.
- **If the condition is met (now or on re-assessment):**
  - Fancy is treated as likely to be accessed by children. A **children's risk assessment** must be done (Ofcom guidance and timing to verify), and the Protection of Children Codes apply to all parts of the service children can access.
  - Fancy does not by design host primary priority content (pornography, suicide, self-harm, eating-disorder content). The Codes measures that *require* HEAA mainly target services at medium or high risk of that content.
  - However, the children's risk profile for a service built around meeting strangers and making contact would need serious work. The cleaner route at that point is usually to add HEAA with access controls, which keeps children out and lets a new stage 1 conclude "not possible".

## 5. Owner decision

| Option | What it means | Pros | Cons |
| --- | --- | --- | --- |
| **A. Accept provisional "not met"** (draft recommendation for launch) | Launch with self-declaration plus the four conditions in §3.3 | No sign-up friction; no third-party age-check cost or extra personal data | Rests on a judgement with no data. Grooming stays medium, so the service stays multi-risk. Must re-assess at 3 months |
| B. Add HEAA at sign-up (for example, facial age estimation or ID check through a third-party provider) with access controls on applying, hosting and chat | Stage 1 can conclude "not possible" for the signed-in parts | Strongest protection given offline meetings. Grooming can fall to low, and Fancy may become specific-risk with fewer Codes measures | Cost per check, sign-up drop-off, new processor and privacy notice changes (biometric or ID data, likely needing a DPIA). Public pages stay viewable but carry little risk |
| C. Treat as likely accessed by children | Do a children's risk assessment and apply the Protection of Children Codes | Most cautious on paper | Large compliance load for a one-person service whose design does not suit children; in practice leads back to B |

## 6. Review triggers

- Scheduled: within 3 months of launch, then at least every 12 months (Ofcom: repeat annually).
- Immediately on:
  - any confirmed under-18 member;
  - repeated under-18 signals;
  - a change to the age gate (removing it, or adding or removing age assurance);
  - new features that appeal to younger users (games, rewards, school or university communities, events not tied to restaurants);
  - marketing in youth channels or with youth influencers;
  - evidence that age assurance is less effective (if option B is adopted);
  - Ofcom updating its guidance.

## 7. Sign-off

| Responsible person | Option chosen | Date |
| --- | --- | --- |
| {{OPERATOR_NAME}} | A / B / C | |

Review log:

| Date | Reviewer | Trigger | Result |
| --- | --- | --- | --- |
| 2026-10-29 | Draft (agent) | Initial draft before launch | Stage 1 yes; stage 2 provisionally not met |
