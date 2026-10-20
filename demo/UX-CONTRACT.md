# UX contract

Business source: [main PRD](../docs/product/PRD.zh-CN.md) §0 and §§3–10. Product brief is background only. All payment, reservation, permissions and lifecycle behavior in this prototype is a local simulation, not a live service.

| Capability     | Canonical owner                                              | Source of truth | Allowed variants                                 | Verification                             |
| -------------- | ------------------------------------------------------------ | --------------- | ------------------------------------------------ | ---------------------------------------- |
| Form           | Field + runtime KeyboardInput/KeyboardTextarea               | PRD §§6–10      | apply/create/profile/message                     | Browser main journeys; domain validation |
| Select/Listbox | Native select for creation; ChoiceGroup radios for discovery | PRD §§6–10      | creation slots; discovery filter chips           | Browser open/select and keyboard         |
| Date           | DateChoices native-radio month/day chooser                   | PRD §§6–10      | October2026 onward; demo past-date boundary16Oct | en-GB London date formatting             |
| Toast          | Prototype notify / single role=status                        | PRD §§6–10      | success/info/error context                       | Browser visible outcome                  |
| Scrollbar      | src/prototype.css                                            | PRD §§6–10      | global application + runtime scroll              | Browser computed styles                  |
| CRUD           | Prototype navigation + domain.ts                             | PRD §§6–10      | local meal creation and applications             | Browser create/read/cancel flow          |

No table selection applies. Local state resets on refresh. No network CRUD, provider calls, session or authentication is built.

Flow ledger: discover retains filters across list/map and back navigation; profile edits opened from application return to the preserved introduction; host approval precedes payment; successful payment only increments attendance once; a confirmed participant may chat; cancellation releases the seat; explicit group departure or dissolution makes earlier authorised history read-only. A paid cancellation displays separate refund state. FR-04's real-time expiry and provider unknown-result handling remain target contracts, not implemented timers/providers. User closes or navigates away from text input by hiding the runtime keyboard. Native inputs are not used for text entry.

Create drafts remain in memory across back navigation. Re-opening creation resumes the draft; refresh/reset intentionally clears the demonstration. Published meals appear in Discover and Hosting. Decisions use immutable local state updates.

Feedback: public references and private reconnect choice are separate. Mutual connection is triggered by an explicit demo action. A block overrides private contact. Reports are recorded locally with an honest result, not sent to a support team.

Permissions/privacy target: profiles are fictional public projections; role switching is not authentication. Never infer production authorization from hidden buttons. User/host actions in this demo deliberately show what future service boundaries must enforce.

Discovery filtering uses pendingFilters separate from applied filters. Closing restores unchanged results; apply commits; clear affects the draft until apply. Quick date/size preserves other fields. Domain grouping counts matching events by area; selection falls back to a remaining area after filtering. Previous/next is bounded and disabled at ends. Whole-card semantic hit button is a sibling of avatar buttons, never nested around interactive content. Scope grip/list/pager controls outside the detail hit target. Source: PRD FR-01a / FR-03a.

## Create meal contract — 2026-10-16
- Four steps: Arrange, Introduce, Costs, Review. Reuse ChoiceGroup and DateChoices; app-owned restaurant cards extend selection without changing the mobile runtime.
- Venue/date/capacity determine fictional availability; invalidate incompatible time and external attestation. Step transitions reset scroll, preserve draft, and dismiss keyboard.
- Budget and charge are distinct. Offline £0 / variable deposit / fixed menu; publishing collects £0. Approval-time amount flows into Meal.deposit and guest payment displays.
- External booking is explicitly a host report, not provider verification. In-app selection is not a reservation hold.
- Publish requires final acknowledgement and revalidation. Success clears the draft; session-only drafts do not survive reload.

## Brand and account entrance
BrandEntrance reuses MobileScroll, keyboard-aware fields, ChoiceGroup and BottomSheet. Startup splash is skippable; guest browsing stays open. go/root guard participation and private destinations and remember afterAuth. New demo identities complete a minimal public profile; returning demo identities bypass setup. OTP is visibly fictional123456, resend30s, expiration5min; Google/Apple are labelled simulations and cancellable. No real authentication, emails, token storage, legal contract acceptance or permission requests. Login state is memory-only; refresh resets it. SelfProfileContext projects selected avatar/name consistently without mutating fixtures.

## Inbox, membership and Settings — 2026-10-16
Inbox contains application next steps and conversations; pending requests must not look like no activity. Shared inboxStage/groupChatAccess derive admission from per-meal membership. Host approval is the sole admission decision; paid meals also require successful payment. Restaurant PENDING/FAILED is independent. Former confirmed guests retain their group membership after cancelling participation; only explicit group departure or dissolution freezes history; never-confirmed requests never receive group access. Composer and list use the same permission helper. countUp records prior admission and avoids duplicates. Demo approval is explicitly labelled on each relevant Inbox card; Track in Inbox links from application status.
Settings lives only on one's own Profile. In-memory switches affect approval banners and Inbox previews. Sign-out confirmation, intro replay and demo reset are distinct. No real push permissions, fake account deletion or inactive language selector.


## Current brand copy — 2026-10-18
BRAND in src/brand.ts owns Fancy name, lowercase wordmark, invitation, supporting welcome sentence and bilingual slogan. Welcome/discovery use Fancy a bite? as the main invitation; account and splash share the revised wordmark. Keep HTML browser/social metadata aligned. PRD brand migration status must describe actual UI. Legacy technical selectors, repository and URL do not imply old product branding.

## Product presentation, 18 October 2026
Use the capitalized Fancy wordmark. Default product screens omit prototype annotations, city marginalia and scenario/replay/reset controls. Acceptance tools are opt-in at `?review=1`; costs, cancellation terms and membership permissions remain visible. No live backend integrations were added.

## Full-flow consistency — 2026-10-18
- Payment confirms membership without confirming the restaurant; only hosts change reservations. Failed bookings retain confirmed group access; cancelled participants retain read-only history.
- Keep Cancelled separate from Upcoming. Store refund values per meal, blocks per member, and direct messages per contact. Self-avatar navigation uses current profile data.
- Normal product errors and pending-state copy contain no implementation remarks. Keep simulation controls in explicit acceptance mode. See PRD v0.4 and full-product-audit report for evidence and limitations.

## Current first release — 20 October 2026
Business source: [PRD v0.6](../docs/product/PRD.zh-CN.md) §0. This section replaces earlier membership/cancellation statements. Preserve all established screen layouts and shared primitives.

- Canonical business owners: `domain.ts` handles existing payment/reference paths; `readiness.ts` owns custom group minimum, deadline/formation, application rounds and independent group departure; `postMeal.ts` owns attendance precedence, feedback window and contact consent.
- Creation retains four steps. Existing ChoiceGroup owns minimum/capacity and selection; Field owns deadline date/time inputs. Default costs are offline and external booking. Existing simulated payment/provider choices remain future references.
- Host approval is the only admission decision; first release has no payment step. Applicant progress and group access are separate. Cancelling a place or an entire meal does not remove group membership. Explicit group departure or dissolution requires a scoped confirmation and leaves earlier authorised history read-only.
- Host cancellation and arrangement editing reuse Primary, Field, ChoiceGroup and runtime BottomSheet. Critical edits remain locked after first approval, even when someone later leaves. Booking failure does not silently reschedule everyone.
- The original post-meal page adds attendance and a separate private meal-experience section. Existing public references remain per meal/person; reconnect choices and direct messages remain per person. No self-rating, fabricated other-party consent, or feedback without qualifying attendance.
- Production must enforce clock, immutable start membership, message visibility intervals, notification delivery and audited late corrections server-side; current state is local and resets on refresh. Real support, deletion, analytics SDK and iOS implementation remain development work.
- Verification: `tests/readiness.test.ts`, `tests/readiness.spec.ts`, existing domain/runtime/Sites checks. Browser automation may select an installed Chrome via `PLAYWRIGHT_CHANNEL=chrome`; default Playwright behaviour is unchanged.

## October 20 browser feedback and AI restoration
- Keep the existing MealHelper launcher, drag/snap/tuck, compact BottomSheet, home/preferences/conversation navigation, explicit preference confirmation and 30-minute idle reset. Restore the original parser; no remote AI dependency or automatic application, publish or send. Existing login, recruitment cutoff and chat authorization still gate drafts.
- Discovery dates use checkbox semantics and OR within the selected dates; other filters intersect. Creation stays a single date. Dismiss discards pending changes.
- Inbox has Chats/Applications tabs with counts and independent empty states. Active main icons are filled and declare aria-current. Avatar profile navigation returns to the source chat.
- Group settings holds the roster and Host/Member/You roles. Only host sees meal-management/dissolution; other current members see Leave group. Read-only settings expose no new destructive action. Participation and group membership remain separate.
- Meal experience is score-only. Settings Product survey is per user, optional, and separate from attendance, mealId, the seven-day window, and per-person reconnect consent. Null is not No; at least one answer/factor before save. Backend latest-version/date semantics are in PRD §0.5.
- Supporting descriptions use information buttons with hover, keyboard focus and tap; Escape/outside dismiss. Keep actionable permission/status/errors visible. Remove the actionless large heart and repeated attendance heading. Past feedback button clears avatar row by20px.
- Signup and profile edit share London-life radio tags, one full-name language selection, and interest checkboxes. Save applies; back cancels the draft. Session reset also clears survey/helper state.
