# Browser validation — 2026-10-16

Tool: Codex in-app browser (real rendered page at local port4173), not HTTP-only validation. Main visual QA viewport1400×1200, iPhone screen measured393×852 CSS px at scale1. Pixel10 preview also inspected. Default small desktop viewport641×609 inspected with template scaling; all five navigation actions and View meal remain visible after safe-area fix.

## Observed journeys

- Discovery: map pins and card selection, list with four meals, shared filters, budget£10 no-result state and clear/recovery.
- Guest: Soho detail, Maya public profile and return, prefilled introduction, application pending, explicit demo approval, payment pending, terms checkbox, simulated declined payment, retry success,4/4 confirmed and£10 paid.
- Booking: confirmed receipt; scenario changes to failed reservation; alternative slot entry present; cancellation sheet displays full£10 refund for booking failure; seat count returns3/4 and refund is separately pending/needs-attention. Refund completion control also available. These are simulation outcomes.
- Messaging: confirmed meal chat and private chat have text composer; keyboard shown; a private message was sent and appeared with Sent · Demo. Fast automated clicks during keyboard/sheet animations sometimes required retry after the visible state settled. No synthetic app-state injection was used.
- Host: create a two-person meal; blank content shows validation; fill title/description, inspect date/slot and payment choices, publish; new meal detail; approve Emma, preview guest payment and confirm2/2; group chat accessible. Final two-person host run also confirmed the restaurant through Manage reservation, producing Confirmed · GRB-1023 (`host-reservation.png`).
- Feedback: Meals→Past→Leave feedback; private reconnect choice, saved before mutual, explicit mutual preview unlocks Maya private chat.
- Device picker: iPhone and Pixel10 actually switched; Android nav bar and app nav remain separate. Frame/keyboard runtime preserved.
- Console errors/warnings: browser log inspection returned none at the checked main-flow checkpoints. No claim of exhaustive browser/device coverage.

## Automated checks run

- Root Python unittest:2 passed (collaboration rules and PRD references).
- Domain tests:8 passed (application/payment states, duplicate success, full/invalid/forbidden states, offline approval, filter intersection, refunds, group minimum, creation validation).
- TypeScript: passed.
- Mobile protected-runtime integrity: passed,28 files.
- Production build: passed; advisory519.95kB JS chunk warning (gzip161.71kB), no build error.
- Sites packaging/worker checks:4 passed; no deployment performed.

## Supplementary static audit

The strict generic auditor retains three inherited-runtime findings in `premium-audit.json`. They are reviewed false positives/ownership limitations, not silently suppressed:

1. `Device.tsx` trigger has no inline onClick: Radix DropdownMenu.Trigger owns the action; actual device switching was verified.
2. `Keyboard.tsx` textarea has no inline resize:none: app `.field textarea` owns resize:none; runtime file remains unchanged.
3. `styles.css` includes WebKit scrollbar styling: application supplies standards-based scrollbar-color/width in `prototype.css`; computed root value verified as rgb(154,169,159) rgb(241,244,239).

Do not claim a clean strict static audit. App-owned findings and canonical-map gap were fixed. No failing test was removed, and no protected runtime check was weakened.

## Limits

No real APIs, money, booking, multi-user authentication, persistence, timed seat expiry or support delivery. See PRD§12 for precise target-versus-demo coverage. No public hosting or production readiness is claimed.
