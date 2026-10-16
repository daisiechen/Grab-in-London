# Visual and interaction QA

final result: passed

## Visual truth and evidence

- Source: `qa/selected-reference.png`, the user-selected map design revised with bottom-centre Create meal. Source853×1844px, normalized to393×852 only for comparison density (minor ratio difference under0.3%).
- Implementation: `qa/discover.png`, actual browser screen crop393×852px; CSS screen393×852 measured; browser viewport1400×1200, scale1. Screenshot buffer dimensions verified. Density1.
- State: initial Discover map, Soho selected,3 of4 confirmed, all filters clear, English, light theme.
- Full comparison: `qa/comparison.png`; opened as a single side-by-side image and visually reviewed.
- Focused bottom comparison: `qa/comparison-bottom.png`; inspected View meal, avatars and five-item nav, including raised Create meal.
- Other rendered states: `qa/booking.png`, `qa/direct-chat.png`, `qa/desktop-preview.png`.

## Required surfaces

- Typography: simple sans-serif hierarchy, forest headline27px, meal title17px, metadata11px. Headline wording preserved; confirmed slogan replaces provisional descriptive line. Controls use readable live text rather than screenshot overlays. System chrome typography is template-owned.
- Spacing: header→map→meal preview→bottom nav preserved. iPhone status/safe-area chrome takes extra space versus bezel-free source; map flexes to fit, while View meal and centre creation remain visible and separate. This is the mobile runtime exception, not an accidental hidden region.
- Colors: forest#123f35, peach#ffb49b selected location, white base, pale parks/blue Thames. Supporting surfaces share the same tokens across detail, forms, booking and chat.
- Images: generated original London illustration, warm restaurant photo and three independently generated fictional portraits. No flattened UI screenshot used as the app. Map and restaurant crops differ in fine detail from the concept; appropriate matching art direction, honestly illustrative not navigation data.
- Content: primary title/meal/Soho/date/price/count preserved. Defaults Any date/Budget provide full discovery rather than prefiltering; selected slogan confirmed by user. Four demo meals include an intentional two-person case; pin numbers mean total capacity. No simulated charge or booking is presented as real.

## Comparison history

1. Initial browser capture found P2: View meal overlapped by the nav because safe-area variable was not inherited in the app root. Fixed app-owned safe-area token and verified button bottom909px versus nav top925.5px at scale1. Final screenshot and bottom comparison show separation.
2. P2: portaled sheets lacked inherited app color variables. Added device-screen token scope and sheet typography/button ownership in app CSS; no runtime file edits.
3. P2: checkout headline implied confirmation before payment. Changed to Make this seat yours; domain/visual status remains approval pending payment until success.
4. P2: keyboard motion could move Send message during pointer interaction. Kept pointer focus on send, verified settled-keyboard click produces the sent message; keyboard navigation supported.
5. Final side-by-side review: no remaining actionable P0/P1/P2 visual differences. Device chrome, illustrative imagery and slogan change are intentional, documented exceptions.

## Interaction evidence and remaining polish

See `qa/browser-results.md` for browser journeys, console inspection and check results. Minor P3: richer restaurant-specific imagery and map detail can be refined in future; native selection styling is platform-owned. No real integrations or complete production accessibility certification claimed. Generic static audit's inherited runtime findings are documented separately and not represented as a clean strict scan.

## Latest discovery review — 2026-10-16

Latest source: ten user browser annotations against the previous demo, plus established forest-green design. Baseline `qa/discover.png` (393×852) and revised `qa/discovery-review/home.png` (393×852) were opened together in `qa/discovery-review/comparison.png`. Current date and all-filter states were reviewed together in `qa/discovery-review/screens.png`; all phone-screen captures were393×852 CSS/pixel dimensions at scale1, viewport1400×1200. Region-list evidence: `qa/discovery-review/area-list.png`.

Intentional changes: date + Table size shortcuts replace date + budget; map numbers now count meals per neighbourhood; area count/View all/pagination replace redundant View meal; restaurant and neighbourhood separated; entire cards are the semantic detail action with independent avatars. Existing palette, image assets, header, device runtime and central creation action preserved. These supersede obsolete source elements, not fidelity defects.

Required surfaces checked: same sans typography and density; forest/peach tokens maintained; map/meal/nav proportions stable; existing raster images retained; new copy states map-count and table-size semantics explicitly. Date/size/all-filter controls share radio-chip states, visible keyboard focus and footer controls.

Findings/fixes:
- P2: long all-filter content initially pushed Apply below view. Scoped app sheet layout now has a bounded internal scroll and fixed footer; browser bounds and screenshot confirm footer within sheet.
- P2: native radio focus could scroll the outer clipped device screen, visually exposing offscreen keyboard assets. App-owned scroll containment now anchors only the outer portal, preserving MobileScroll and filter scrolling. Post-fix browser measurement: scrollTop0, keyboard-visible=false, date radio selected=true. Revised date capture shows intact chrome and no keyboard.
- Final before/after and three-state comparisons were opened and inspected after fixes. No actionable P0/P1/P2 mismatch remains for the scoped comments. Existing prototype integration limits remain as documented; Google redirect is an external access condition.

Validation: see the latest browser-results section and updated domain tests. No template-owned runtime files were changed.

## Create meal refinement — 2026-10-16
Preserved the established forest/white visual system, runtime and central Create entry. Reused calendar and radio chips; added restaurant cards, receipt and review groups. Inspected actual393×852 screen crops in `qa/create-review/arrange.png`, `costs.png`, `review.png`. Found and fixed low contrast receipt small print and step transitions retaining the previous scroll position. No overflow was observed in the inspected iPhone views; long content scrolls above the home area. Pixel-specific revalidation was not performed in this revision.

## Brand entrance refinement — 2026-10-16
Compared the built entrance against the independently specified brand direction in docs/brand-direction.zh-CN.md and inspected welcome/account/splash in qa/brand-review. Existing forest map system remains the application interior. Different typography, palette, artwork, composition and controls distinguish Grab from the supplied video; no visual-copy claim or trademark-clearance claim. Fixed caption spacing and missing provider borders after screenshots. iPhone393×852 and Pixel427×952 account layouts inspected.18 domain +4 worker +2 root tests pass; runtime unchanged.

## Inbox and Settings review — 2026-10-16
Inspected393×852 pending/payment-needed/settings/archive screenshots. Retained forest/white components; added an application progress card and grouped settings. Real UI walkthroughs cover paid and offline approval-to-chat, successful send, hidden Inbox preview, prior-member cancellation archive with zero composer controls, sign-out cancellation/confirmation and intro replay retaining the session. Shared permission matrix is in PRD FR-09; frontend checks do not replace future backend enforcement. No Pixel rerun for this revision.
