# Grab in London — interactive demo

**Meet new people over a meal.**

English mobile-style prototype with the selected London map direction and prominent bottom-centre Create meal action. Chinese product specification: [PRD](../docs/PRD.zh-CN.md).

## Run

Node 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 4173
```

Open the printed local URL. Keep the server running. Choose iPhone or Pixel 10 from the preview menu. No credentials, real payments, reservations or API keys are needed. All data and generated portraits are fictional; changes reset on refresh.

## Walkthroughs

1. Select the Soho pin → View meal → view Maya’s profile → apply → Preview host approval → Pay £10 deposit → accept sample terms. Try the failure checkbox, then retry without it → booking → meal chat.
2. Booking → Explore demo outcomes → reservation failure → alternative slot, or cancel and inspect refund states. Outcomes are explicitly simulated.
3. Create meal → choose 2–6 people, restaurant and slot → add name/description → select payment/reservation → publish → Manage applications → approve Emma → Preview guest payment → back to meal → Manage reservation.
4. Meals → Past → Leave feedback → privately choose to share a table again → Preview mutual connection → private chat.
5. More filters → budget up to £10 → show no matches → clear filters. List and map share query state.

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
