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

## Walkthroughs

1. Select the Soho area marker → click the meal card → view Maya’s profile → apply → Preview host approval → Pay £10 deposit → accept sample terms. Try the failure checkbox, then retry without it → booking → meal chat.
2. Booking → Explore demo outcomes → reservation failure → alternative slot, or cancel and inspect refund states. Outcomes are explicitly simulated.
3. Create meal → choose 2–6 people, restaurant and slot → add name/description → select payment/reservation → publish → Manage applications → approve Emma → Preview guest payment → back to meal → Manage reservation.
4. Meals → Past → Leave feedback → privately choose to share a table again → Preview mutual connection → private chat.
5. More filters → budget up to £10 → apply to show no matches → clear filters. List and map share query state.

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

Discovery refinements: date and Table size have dedicated quick selectors. More filters contains all preferences with draft/apply/cancel. Map marker counts are matching events per neighbourhood; Soho has two sample events to try previous/next and View all. Entire cards open details; avatars open profiles independently. A labelled Google Maps link opens the real neighbourhood for fictional venues.

## Public experience build

Live demo: https://grab-in-london-demo.daisie-chen-94.chatgpt.site

Anyone with the link can explore the prototype. Email sign-in is simulated with sample email `alex@example.com` and code `123456`; Google/Apple flows are labelled previews. There are no real accounts, bookings or charges. Data is memory-only, resets on reload and is not shared across browsers. Release details: [中文发布记录](../docs/delivery/demo-release.zh-CN.md). Keep the registered project ID in `.openai/hosting.json` for later updates.

Brand: Fancy (provisional). Invitation: Fancy a bite? / 一起吃点？. Slogan: Meet new people over a meal. / 吃个饭，认识一下。. Existing public URL retains its legacy slug for shared-link continuity.

### Clean product presentation
Default URL shows product UI without implementation notes. Append `?review=1` to expose acceptance-only scenario controls. Authentication code remains `123456`; OAuth, charges, reservations, notifications and report delivery are frontend simulations. No real backend is added by hiding annotations. Use the PRD as the implementation contract.

### Full product audit — 18 October 2026
The route/state audit and acceptance evidence are in `../docs/qa/full-product-audit.zh-CN.md`; PRD v0.4 records corrected payment/reservation separation, cancellations, refunds, member-specific privacy state, and clean product copy. Normal and review URLs deliberately show different control sets. Prototype dates and external-service responses remain fixtures.

## 20 October 2026 readiness revision

Current requirements: [PRD v0.6](../docs/product/PRD.zh-CN.md) §0. Mobile Web and iOS are the intended first-release clients; this repository supplies a local web interaction prototype, not a native iOS build. Existing layouts and full payment/booking reference journeys remain. New default creation uses external booking/offline payment, a custom 2–6 minimum/capacity range and a host-set deadline. Attendance, private whole-meal experience and contact/group lifecycle changes are tested separately.

`?review=1` exposes simulated approval and clock progression; normal UI keeps these tools hidden. `pnpm test:domain` covers domain/readiness rules; `PLAYWRIGHT_CHANNEL=chrome pnpm test:runtime` can use an installed Chrome. No actual reports, deletion requests, messages, payments or reservations are transmitted.

## October 20 comments and Ask Fancy restoration
The existing floating Ask Fancy assistant is restored from its approved implementation: search/compare local meals, explain costs, draft an application/message/meal, and review saved preferences. Drafts enter existing editors; the user still submits. It is a deterministic prototype, not a live model integration. Browser speech is optional, consented, editable, and never auto-sends.

Discover supports multiple nonconsecutive dates. Inbox separates Chats and Applications; chat avatars open profiles and group settings contain the roster and role-specific leave/dissolve actions. Settings now has an independent voluntary Product survey. Meal experience stores only this meal's 1–5 score; public references and personal reconnection stay separate. Profile onboarding/editing share single-choice London-life tags, a language dropdown and multiple interest tags. All state is session-only.
