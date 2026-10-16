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

## Discovery review revision — 2026-10-16

This revision supersedes the earlier discovery/filter descriptions. The ten user browser comments are the new interaction source of truth.

- Comment1: date shortcut opens only the dedicated month/day chooser; selected24Oct was applied, then preserved when table size changed. Native-radio keyboard Space selected23Oct; frame scroll remained0 and keyboard-visible=false after the app focus containment fix.
- Comment2: second shortcut is Table size, with dedicated2–6/group choices. Date24Oct + size2 produced exactly the StJames’s lunch.
- Comment3: all filters use shared styled radio chips, expandable date options, independent draft/apply/cancel, clear-all, result count and a fixed footer. A£10 draft was cancelled and the original two filters/results remained. Clear all + Show5 restored all meals. The filter scroll's content exceeded its viewport while footer stayed inside the sheet (footer bottom1002, sheet bottom1026 at scale1).
- Comments4–5: marker counts are filtered events per area. Soho has2; next produced Saturday event/Meal2of2 with next disabled. View all opened a two-meal Soho list. Filtering changes groups/counts, with fallback to an available area.
- Comment6: each card now names the restaurant and separately displays Soho, London (a neighbourhood).
- Comments7/9/10: semantic whole-card targets cover photos/text/blank space; avatar buttons are independent siblings. Five list cards had five detail targets and zero duplicate row buttons. A card opened the correct detail, and an avatar opened Maya's profile. Redundant View meal and row arrows removed from discovery.
- Comment8: actual Google Maps link launched a new tab using the encoded Soho,London query; original detail remained. Google redirected to its own sign-in page in this environment. No login was attempted; map destination precision beyond the area was not verified. Fictional venues explicitly link to the neighbourhood.

Evidence: `discovery-review/home.png`, `date.png`, `filters.png`, `area-list.png`, `screens.png`, `comparison.png`. Main final capture viewport1400×1200; device screen measured393×852; saved images393×852px at scale1. Auxiliary hidden QA tab used1280×720 for functional checks, not1:1 visual assertions.

Checks for this revision:13 domain tests +4 worker/packaging tests +2 root tests; TypeScript/build/runtime integrity passed. Browser console errors/warnings returned none at the checked final checkpoint. Supplementary static scan still has exactly the three previously documented protected-runtime findings, no unresolved contracts. Build retains an advisory530.69kB JS chunk warning (gzip165.03kB), not an error.

## Create meal — 2026-10-16
Verified in IAB using actual UI controls (mouse and keyboard):
- Venue change from dinner to Garden Kitchen invalidates the old time; Continue shows an error. Monday produces no-times state, changing date restores lunch slots; two people can choose12:30.
- Title/description entry proceeds with runtime keyboard. £40 deposit against £25 minimum is blocked; £12.50 succeeds and the published detail retains£12.50,1of4 confirmed and pending reservation.
- Fixed menu £40, two people, external reservation: missing host declaration blocks; checking it then reviewing/acknowledging publishes correct Garden Kitchen/24Oct/12:30/1of2/£40/menu/confirmed state. External report disclosure was added to avoid implying provider verification.
- Publish without final acknowledgement is blocked. Success resets the draft. Mouse creation/venue/date/size/slot/payment choices and publishing worked in a fresh QA tab. The older attached tab had stale pointer targeting after viewport changes; keyboard worked, and a fresh tab restored mouse testing without app changes.
- Actual full-size393×852 screen captures reviewed: `create-review/arrange.png`, `costs.png`, `review.png`. Costs/review captures verify step changes start at the top; receipt text contrast was corrected.
-16 domain tests,2 root tests,4 worker tests; TypeScript, build and28-file protected runtime integrity pass. Build has an advisory536.51kB JS chunk warning. No real restaurant or payment provider is connected. No Pixel recheck in this revision.

## Brand and authentication — 2026-10-16
- Read the supplied19.57s video via local extracted frames; used only the high-level brand→account→profile pacing. No user video, its private account strings, or reference frames were copied into the repository.
- Original wordmark/forest-citrus-ivory direction and separately generated table artwork implemented. Inspected full-size393×852 welcome/account captures; corrected artwork/caption overlap and provider button borders after the first visual pass. Splash is skippable and welcome can replay it.
- Mouse-tested guest browsing→Create gate→new-account entry; invalid email and wrong code block with recoverable errors. Correct123456 opens setup. Missing name/bio blocks. Filled fictional Alex, selected Maya demo portrait, acknowledged sample age/community notice; completion returned to Create as originally requested. Profile then used/images/maya.png with Alex's entered name, verifying selected portrait propagation.
- Google preview cancelled back to account. Apple preview continued into setup. Both are clearly simulated; no provider navigation or actual OAuth consent occurred.
- Returning login with email and valid code bypassed setup and opened Discover. Explicit expired-code scenario rejected even the correct code; changing email and requesting a fresh code recovered.30s resend cooldown was visible;5min expiry is timer-based and covered by the expired validation test, not a five-minute browser soak.
- Inspected Pixel427×952 account layout, retained runtime device status/navigation. Saved pixel-account.png. No console error logs at the checked checkpoint. Full cross-platform authentication regression is not claimed.
- Evidence:brand-review/splash.png,welcome.png,account.png,code-expired.png,pixel-account.png. All screenshots contain fictional sample data only. Main preview kept on welcome; memory-only demo login, no real emails/authentication/provider backend.

## Inbox membership and Settings — 2026-10-16
Browser-tested on local393×852 iPhone screen:
- Returning demo login→apply main paid meal→Inbox waiting-host card, not empty state. Preview approval transitions same card to£10 due; checkout consent/payment confirms. Inbox group opens; sent “Looking forward to dinner!” successfully.
- Settings appears on own Profile; message previews off replaced Inbox text with hidden-preview notice. Sign-out opens confirmation and Stay signed in cancels. Removed combined sign-out/replay and profile reset panel. Fixed an initial placement error that put Settings on the other-member screen before verification.
- Final permission rule tested through offline Ramen: apply→Track in Inbox→host approval opens chat. Sent “See you at ramen night.”, cancelled participation, returned via Inbox: history visible, read-only notice present, zero Send message controls.
- Shared tests reject pending/declined/withdrawn/payment-pending even with confirmed restaurant; confirmed users can chat while booking pending/failed. Cancelled users get history only if previously confirmed. Local demonstrations, not server authorization.
Evidence:inbox-settings/{pending,payment-needed,chat,settings,preview-hidden,archive}.png.23 domain +5 worker/packaging +2 root tests pass; TypeScript/build and28-file runtime check pass. Chunk557.37kB remains advisory. No Pixel rerun in this revision.
Additional final check: Replay brand intro→Explore tables first→Profile opened Alex directly, confirming the session remained signed in. Sign out confirmation then returned to Good to meet you account screen. Settings switches rendered with distinct on/off controls after visual review.
