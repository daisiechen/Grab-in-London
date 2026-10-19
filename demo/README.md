# Fancy — interactive demo

**Meet new people over a meal.**

English mobile-style prototype with the selected London map direction and prominent bottom-centre Create meal action. Chinese product specification: [PRD](../docs/product/PRD.zh-CN.md).

## Run

Node 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 4173
```

Open the printed local URL. Keep the server running. Choose iPhone or Pixel 10 from the preview menu. No credentials, real payments, reservations or API keys are needed. All data and generated portraits are fictional; changes reset on refresh.

## Current R1 and future scope

Default: D1, everyone pays at the restaurant and the host books externally. This is a local, fictional, in-memory simulation; it is not real login, email, restaurant inventory, messaging delivery or native iOS. The existing public site is unchanged in this work batch.

Use `?review=1` for actor switching, acceptance clock, offline/unavailable previews and sanitized JSON export in Settings. Use `?scope=future&review=1` for the preserved future payment/booking exploration; it is outside R1.

## R1 walkthroughs

1. Explore tables first → open a meal → apply → Log in via a provider preview (or email sample code 123456) → introduction → submit. Inbox shows Application pending, without chat access.
2. Settings → actor maya → the same meal → Manage your table → approve → declare an external booking for the confirmed count. Switch back to alex → Inbox → group chat opens immediately, without a second admission or payment.
3. Create meal → preview restaurant → Use this restaurant (or manual name/address/area) → London date/time and 2–6 people → budget/title/description → review → publish. Selecting a candidate never reserves a table.
4. Meals → A Sunday table → Your shared meal → self attendance → explicit rating and willingness, optional reasons → save. Choose a member privately; switch actor to that member and reciprocate → private chat. Retract/block disables sending and retains read-only history.
5. Settings → advance UTC acceptance clock to verify T−45 application / T−30 approval / T−15 external-booking check. Going backwards is rejected. Reload resets fixtures.
6. Review Settings → Export sanitized admin handoff → import as a **demo** snapshot in the admin. This is manual handoff, not connected production data. See [shared contract](../shared/README.md) and [R1 QA](qa/r1/readiness.md).

## Checks

```sh
pnpm check:runtime
pnpm test:domain
pnpm exec tsc --noEmit
pnpm build
pnpm test:sites
```

The protected mobile runtime owns device frames, keyboards and scrolling. App UI is in `src/Prototype.tsx`, `src/prototype.css`, with pure state rules in `src/domain.ts`. Browser evidence: `qa/browser-results.md`; visual comparison: `design-qa.md`.

`premium-audit.json` records the supplementary static auditor's inherited runtime findings. Review rationale in the browser report; its presence is not a declaration of a clean strict scan.

## Earlier future-scope notes

The notes below describe the earlier exploration. Current R1 rules are authoritative in the PRD and shared contract.

Discovery refinements: date and Table size have dedicated quick selectors. More filters contains all preferences with draft/apply/cancel. Map marker counts are matching events per neighbourhood; Soho has two sample events to try previous/next and View all. Entire cards open details; avatars open profiles independently. A labelled Google Maps link opens the real neighbourhood for fictional venues.

## Public experience build

Live demo: https://grab-in-london-demo.daisie-chen-94.chatgpt.site

Anyone with the link can explore the prototype. Email sign-in is simulated with sample email `alex@example.com` and code `123456`; Google/Apple flows are labelled previews. There are no real accounts, bookings or charges. Data is memory-only, resets on reload and is not shared across browsers. Release details: [中文发布记录](../docs/delivery/demo-release.zh-CN.md). Keep the registered project ID in `.openai/hosting.json` for later updates.

Brand: Fancy (provisional). Invitation: Fancy a bite? / 一起吃点？. Slogan: Meet new people over a meal. / 吃个饭，认识一下。. Existing public URL retains its legacy slug for shared-link continuity.

### Clean product presentation
Default URL shows product UI without implementation notes. Append `?review=1` to expose acceptance-only scenario controls. Authentication code remains `123456`; OAuth, charges, reservations, notifications and report delivery are frontend simulations. No real backend is added by hiding annotations. Use the PRD as the implementation contract.

### Full product audit — 18 October 2026
The route/state audit and acceptance evidence are in `../docs/delivery/full-product-audit.zh-CN.md`; PRD v0.4 records corrected payment/reservation separation, cancellations, refunds, member-specific privacy state, and clean product copy. Normal and review URLs deliberately show different control sets. Prototype dates and external-service responses remain fixtures.


### Meal helper — 18 October 2026
Click the floating green sprite (Ask Fancy), then try “Friday in Soho, table for 4, £35”, “£10”, “any area” or “Help me create a meal”. Open a result and ask for an application, costs or a group-message draft. Draft buttons return to existing editors; publishing, applying, paying and sending still require the user’s action. Unconfirmed users cannot enter chat through the helper.

“Remember Soho, budget £35” proposes preferences; confirm the card to save. My preferences supports replacement and deletion. Everything is session-memory only; refresh and authentication transitions clear the helper. No private chats or third-party application/payment records are consumed.

This is a deterministic frontend interaction prototype with limited English/Chinese request patterns, not a live LLM or autonomous agent. Browser SpeechRecognition, when supported, requires explicit user initiation and may use the browser vendor’s service. Audio recognition defaults to en-GB; text/transcript is editable and never automatically sent. Real microphone recognition is not guaranteed in the embedded browser. See [PRD](../docs/product/PRD.zh-CN.md) FR-12 for scope and data boundaries.

Checks: `pnpm test:domain` includes helper rules. `pnpm exec playwright test tests/assistant.spec.ts --workers=1` verifies helper interactions. When only system Chrome is installed, set `PLAYWRIGHT_CHANNEL=chrome`. Existing `pnpm test:runtime`, `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm test:sites` remain required. The helper and feedback refinements were published as Sites version 7 on 18 October 2026 at the public URL above.


### Helper feedback refinement — 18 October 2026
Drag the sprite vertically or across the phone; release to snap to the nearer edge. Tuck it to leave the little sprite/paws peeking out; tap to open, or use arrow keys when focused to reposition. Each activation starts on the helper home in compact view. Continue conversation resumes the unexpired chat; starting a request from home starts fresh. New conversation keeps approved preferences; My preferences owns deletion and explains context cleanup. Larger view / Compact view replaces the resize arrows.

Messages show London-local times. Conversations restart after 30 minutes without helper activity, retaining approved preferences and unsent chat text. Typing renews activity. This timer does not change meal, payment or chat access rules; current data remains memory-only. Idle acceptance uses a virtual clock. Latest visual/browser evidence is in qa/ai-helper-refinement/ and qa/browser-results.md; original qa/ai-helper/ screenshots remain the earlier baseline.

### Map and compact helper prototype — 18 October 2026
Drag the discovery map, use +/− or pinch to zoom, then Search this area. Reset returns to central London. Create meal now offers restaurant name/area/cuisine search and map pins; review a candidate and select Use this restaurant before continuing. These are local fixture interactions using the existing map artwork, without Google Maps/Places, API keys or real availability. Helper preferences now sit in its top toolbar; dismiss using the sheet grip, outside area or Escape. No size toggle or close cross remains.
