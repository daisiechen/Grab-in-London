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
Published revision2 at the existing public URL. Live smoke: simulated returning login→main meal application→Track in Inbox showed Waiting for host approval; Profile→Settings had2 preference switches. Console error check empty. Public screenshot:inbox-settings/live.png. Local cancellation/history and settings flows are described above; no new full live payment regression claimed.

## Welcome headline — 2026-10-16
User-approved exact welcome heading: “There’s a seat for you here.” Removed forced JSX line break to keep a single accessible phrase and allow wrapping. Live version3 exact heading locator matched; inspected qa/brand-review/welcome-seat.png and confirmed two-line layout without truncation. Slogan remains unchanged. Build/runtime,5 packaging and3 root checks passed.

## Fancy brand migration — 2026-10-18
Local UI: precise Fancy a bite? headings matched on welcome and Discover; wordmarks expose Fancy accessible name, browser title Fancy — Meet new people over a meal. Guest exploration and account gate/back remain operational.393×852 welcome/account/discover and427×952 Pixel welcome screenshots inspected: wordmark, invitation, slogan and buttons remain legible, no truncation observed. Legacy .grab-app selectors and public URL intentionally retained.23 domain +6 build/packaging +13 root tests pass, TypeScript/build and28-file runtime integrity pass. Advisory JS chunk557.40kB. This revision does not revalidate all payment/chat flows; their behavior was unchanged.
Fancy release4 live smoke: title Fancy — Meet new people over a meal.; accessible wordmark Fancy, visible fancy; exact Fancy a bite? heading matched on welcome and Discover. Find your people opened the account page with new wordmark; guest explore still works. Console error check empty. live-welcome.png saved from actual public site; existing URL unchanged.

## 2026-10-18 Clean product presentation
- Default welcome: capital Fancy wordmark, no prototype ribbon/city marginalia/replay button.
- Account: standard email/Google/Apple labels, no implementation annotation.
- Guest discovery: no demo ribbon/map note; cards and navigation retained.
- Explicit `?review=1`: acceptance annotations and Replay intro remain available.
- Published Sites version 5; no backend integration added.

## 2026-10-18 Full product audit
Current-run audit covers all17 app routes plus6 entrance/auth stages. See `../../docs/delivery/full-product-audit.zh-CN.md` for numbered paths, issues, screenshots and evidence limits. Product-copy leftovers, independent payment/restaurant state, cancellation/refund state, per-member blocking, self-profile navigation, menu pricing, create metadata and feedback context corrected. Pending/paid/offline/declined/withdrawn/archived paths exercised; review-only external events retained. iPhone and Pixel creation/profile/settings reviewed.34 domain +6 packaging +17 repository checks pass;28 runtime files unchanged. No claim of real service integration or exhaustive touch/accessibility coverage.
Final targeted checks: Garden Kitchen lunch12:30 failed→alternative13:00→confirmed; host post-meal feedback shows the actual meal and Emma. Live version6: clean welcome, invalid code uses product error and hides keyboard, returning email login, Cancelled category, clean Settings; console errors empty. Evidence full-audit/26–28. Preserved existing unrelated research edits.


## 2026-10-18 Floating meal helper (PRD v0.5)

Local prototype only; public Sites remains unchanged. Baseline checked before implementation: `5495fa1d6bcdaf4d6e5f54c1c8dccd34a2de4357` existed on GitHub; later unrelated documentation/admin commits were preserved. No original history was reset.

Acceptance uses system Chrome via `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --workers=1` (bundled Playwright browser is not installed). Test server uses pnpm; predev/prebuild invoke the runtime integrity script directly, so npm is not required. TS noEmit permits explicit .ts imports for the Node24 rules tests. No runtime integrity hashes were changed.

- Nine helper scenarios: tuck/restore, constrained search and no-results refinement, close/reopen/history/detail navigation, explicit preference approval/correction/deletion, application/create editor handoff without submission, locked chat denial, confirmed offline guest message draft without sending, iPhone/Pixel expanded-sheet keyboard bounds, unavailable/denied speech recovery, synthetic speech disclosure and editable transcript (the speech cases span three tests).
- Eight existing mobile-runtime scenarios pass: carousel gestures/momentum, sheet exit, keyboard/footer synchronization, Pixel navigation and FlowStack. The overlay regression test now taps inside the rounded screen rather than its clipped 8px corner; the exit-animation assertion is retained. No protected runtime source was edited.
- 48 pure domain/helper tests, 6 worker/packaging tests, 29 repository tests, TypeScript and build passed. Runtime integrity: 28 protected files unchanged. Build retains an advisory >500kB main-chunk warning; no new dependency was added.
- Corrected an actual preference-save click lost when keyboard blur moved its button. Helper buttons now preserve pointer focus until their action, matching Primary. Corrected transcript autoscroll to affect only the conversation instead of scrolling the entire device/page; browser test asserts window.scrollY stays zero. Closed and expanded keyboard states respect device safe areas.
- In-app-browser manual check: sprite opens the panel, Friday search returns the two expected public meals; checked warning/error logs empty. Screenshot review covers factual meal cards, editable preferences and both devices. Other payment, refund and private-reconnect journeys were not comprehensively repeated; their domain rules and guarded transitions remain covered by the existing suite.

Evidence: [launcher](ai-helper/launcher.png), [search](ai-helper/search-iphone.png), [preferences](ai-helper/preferences.png), [iPhone keyboard](ai-helper/keyboard-iphone.png), [Pixel keyboard](ai-helper/keyboard-pixel.png), [message draft](ai-helper/message-draft.png). Synthetic tests use fictional data and a fixed London date; the helper itself resolves current London date.

Limits: local deterministic rules and templates, not a live LLM, real inventory, remote agent or production authorization. Speech tests use synthetic browser-recognition events; they do not prove real microphone permission, recognition quality or vendor-service availability. Real speech is optional, user-initiated, disclosed before start and never automatically sends. Conversation/private-message ingestion is absent. Preferences and chat are in-memory and clear at refresh/authentication transition. No claim of a full accessibility audit, real accounts, bookings, charges or live human messages.


## 2026-10-18 Helper browser-feedback refinement (PRD v0.6)

Five user comments are resolved: draggable edge-docking sprite/paws; distinct New conversation versus preference deletion; reopen on helper home with explicit Continue conversation; Larger view / Compact view text; London timestamps and a 30-minute inactivity default. Closed-panel expiry retains approved preferences and unsent chat text, and rechecks before resuming/submitting when background timers are delayed. Home requests start fresh instead of inheriting the previous temporary budget/date.

Validation: 51 domain/helper rules, 21 browser cases (13 helper +8 existing runtime), 6 worker/packaging cases, 30 repository cases, TypeScript/build and the 28-file runtime-integrity check. Browser invocation: `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --workers=1`. No protected runtime source changed. The existing main-chunk size advisory remains (~583kB before gzip); no dependency was added.

Specific evidence:
- Mouse-pointer drag crosses to either side, snaps without opening, tucks and restores; the gesture uses pointer capture and normalizes by device scale. Direction keys offer an accessible repositioning path. Actual touch hardware is not certified by this mouse-driven acceptance test.
- Reopen from both preference and chat views shows home/compact mode; Continue conversation is explicit. New conversation preserves saved preferences, while deletion explains its contextual cleanup.
- Virtual-clock tests cover the 30-minute boundary, renewed activity from typing, active-panel timeout, retained unsent text, and stale background timers with both closed panel and visible home. London formatter is tested in summer and winter. These are simulated time advances, not a measured 30-minute live service trial.
- Corrected activity tracking so controlled-input changes and activity updates share the input handler; updating state in input capture could reset the text before its change handler under a progressing clock. Corrected a pre-existing runtime-test gesture: it now waits for the entering keyboard to settle and drags blank footer padding, because dragging an input is intentionally ignored by the protected runtime. Original synchronization assertions remain.
- Preview on 4173 was restarted after its old process stopped. Local build and GitHub sync do not publish Sites. The public Sites version remains unchanged, with local deterministic replies and optional browser speech still bounded by FR-12.

Latest screenshots: [left edge](ai-helper-refinement/edge-left.png), [right edge](ai-helper-refinement/edge-right.png), [home and resume](ai-helper-refinement/home-resume.png), [timestamps](ai-helper-refinement/timestamps.png), [expiry notice](ai-helper-refinement/expired.png), [search](ai-helper-refinement/search-iphone.png), [preferences](ai-helper-refinement/preferences.png), [iPhone keyboard](ai-helper-refinement/keyboard-iphone.png), [Pixel keyboard](ai-helper-refinement/keyboard-pixel.png), [message draft](ai-helper-refinement/message-draft.png), [launcher](ai-helper-refinement/launcher.png). Prior ai-helper screenshots remain baseline evidence. Captures wait for sheet/edge/keyboard animation to settle.

## 2026-10-18 Compact helper and interactive map prototype
Latest feedback replaces the earlier size-control/close-cross design: My preferences is in the top toolbar; existing sheet drag, overlay and Escape close the panel. Sprite Pointer Events are now covered by Chromium touch dispatch as well as the existing mouse drag tests. Map fixture artwork pans, supports two-finger pinch and zoom buttons, resets and explicitly searches visible areas, including no-result recovery. Restaurant map/search candidates require Use this restaurant before updating the draft; confirmation continues into the original Introduce step.

Regression fixes: shared button active transforms displaced map pins on pointer-down, causing a visible target to move away before pointer-up. Marker-specific transforms preserve centering; the centered Search this area control also preserves its transform. A completed touch pinch can omit a synthetic click, so a new pointer-down resets stale drag-click suppression before a toolbar action.

Evidence: qa/map-helper-update/ contains current helper, discovery, restaurant selection and helper-flow captures. Touch tests use browser-dispatched touch input, not a physical handset. Maps/Places, geolocation and real restaurant availability remain unconnected. Validation results and exact publication IDs are recorded in the release log after deployment.

Final validation: 114 tests passed (51 domain/helper, 25 browser including 4 new map/touch cases, 6 worker/packaging, 32 repository checks). TypeScript/production build, diff whitespace and all 28 protected runtime files passed. No dependencies added; inherited bundle-size advisory remains (~587kB minified). Screenshots were visually reviewed after sheet/keyboard animation settling.
