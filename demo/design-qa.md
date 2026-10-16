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
